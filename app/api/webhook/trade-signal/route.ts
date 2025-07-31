import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { decisionTree, calculateValue, calculateValueWithCostAdjustment } from "@/lib/decision-tree"
import { tradingPlatform } from "@/lib/trading-platform-service"
import { brokerCostService } from "@/lib/broker-cost-service"
import { exceptionHandler } from "@/lib/exception-handler"
import { alertService } from "@/lib/alert-service"
import { signalProcessor } from "@/lib/signal-processor"
import { overnightTradeManager } from "@/lib/overnight-trade-manager"
import type { TradeSignal, ProcessedTradeSignal, ValidationResult, CachedSessionData } from "@/lib/types"

// Signal validation function
function validateTradeSignal(signal: any): ValidationResult {
  const errors: string[] = []

  // Check required fields
  const requiredFields = ['action', 'symbol', 'timeframe', 'time', 'entry', 'target', 'stop', 'id', 'rr', 'risk']
  
  for (const field of requiredFields) {
    if (!signal[field] || signal[field] === '') {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Validate TradeID uniqueness (should be unique)
  if (signal.id && typeof signal.id !== 'string') {
    errors.push('TradeID must be a string')
  }

  // Validate risk is numeric
  if (signal.risk && isNaN(Number(signal.risk))) {
    errors.push('Risk must be a numeric value')
  }

  // Validate entry, target, stop are numeric
  const priceFields = ['entry', 'target', 'stop']
  for (const field of priceFields) {
    if (signal[field] && isNaN(Number(signal[field]))) {
      errors.push(`${field} must be a numeric value`)
    }
  }

  // Validate action is valid
  const validActions = ['buy', 'sell', 'long', 'short']
  if (signal.action && !validActions.includes(signal.action.toLowerCase())) {
    errors.push(`Invalid action: ${signal.action}. Must be one of: ${validActions.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Signal processing function
async function processTradeSignal(signal: TradeSignal): Promise<{ success: boolean; data?: ProcessedTradeSignal; error?: string }> {
  try {
    console.log("Processing trade signal:", signal.id)

    // Check if this trade ID already exists
    const existingSession = await findSessionByTradeId(signal.id)
    
    let sessionId: string
    let currentNode: string
    let initialAmount: number

    if (existingSession) {
      // Continue existing session
      sessionId = existingSession.session_id
      currentNode = existingSession.current_node
      initialAmount = existingSession.initial_amount
      console.log(`Continuing existing session: ${sessionId} at node: ${currentNode}`)
      
      // Check if platform balance has changed significantly and update if needed
      await tradingPlatform.updateSessionBalance(sessionId)
    } else {
      // Create new session with current platform balance
      sessionId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      currentNode = "Start" // Level 1 node
      
      // Get current account balance from trading platform
      console.log("Fetching current account balance for new session...")
      initialAmount = await tradingPlatform.getAccountBalance()
      console.log(`Creating new session: ${sessionId} starting at node: ${currentNode} with balance: $${initialAmount.toLocaleString()}`)
      
      // Create the session in database with exception handling
      try {
        await createNewSession(sessionId, signal, currentNode, initialAmount)
      } catch (error) {
        // Handle database failure with local caching
        console.error("Database error during session creation:", error)
        
        const cachedSessionData: CachedSessionData = {
          sessionId,
          signal,
          currentNode,
          initialAmount,
          timestamp: Date.now(),
          retryCount: 0
        }
        
        const cacheResult = await exceptionHandler.handleDatabaseFailure(cachedSessionData)
        
        if (cacheResult.cached) {
          console.log("Session cached locally:", cacheResult.message)
          // Continue processing with cached data
        } else {
          throw new Error(`Failed to create session: ${cacheResult.message}`)
        }
      }
    }

    // Calculate trade amount based on current decision tree node with cost adjustment
    const node = decisionTree[currentNode]
    if (!node) {
      throw new Error(`Invalid decision tree node: ${currentNode}`)
    }

    // Validate trade conditions before calculating costs
    const tradeValidation = await brokerCostService.validateTradeConditions(signal.symbol)
    if (!tradeValidation.isValid) {
      console.warn(`Trade conditions not met for ${signal.symbol}:`, tradeValidation.errors)
      // Continue with warnings but log them
      tradeValidation.warnings.forEach(warning => console.warn(warning))
    }

    // Calculate trade amount with broker cost adjustment to achieve target net profit
    const costAdjustedResult = await calculateValueWithCostAdjustment(
      node.value,
      initialAmount,
      signal.symbol,
      Number(signal.entry),
      Number(signal.target),
      Number(signal.stop),
      brokerCostService
    )

    const tradeAmount = costAdjustedResult.adjustedAmount
    
    // Create processed trade signal
    const processedSignal: ProcessedTradeSignal = {
      session_id: sessionId,
      trade_id: signal.id,
      symbol: signal.symbol,
      action: signal.action,
      entry: signal.entry,
      target: signal.target,
      stop: signal.stop,
      trade_amount: tradeAmount,
      current_node: currentNode,
      timeframe: signal.timeframe,
      time: signal.time,
      rr: signal.rr,
      risk: signal.risk,
      initial_amount: initialAmount,
      node_stake_percentage: node.value,
      cost_adjustment: {
        nominal_amount: costAdjustedResult.adjustedAmount,
        total_costs: costAdjustedResult.totalCosts,
        expected_net_profit: costAdjustedResult.expectedNetProfit
      }
    }

    // Save the trade signal to database with exception handling
    try {
      await saveTradeSignal(processedSignal)
    } catch (error) {
      console.error("Database error during signal save:", error)
      
      const cachedSessionData: CachedSessionData = {
        sessionId,
        signal,
        currentNode,
        initialAmount,
        timestamp: Date.now(),
        retryCount: 0
      }
      
      const cacheResult = await exceptionHandler.handleDatabaseFailure(cachedSessionData)
      
      if (!cacheResult.cached) {
        throw new Error(`Failed to save signal: ${cacheResult.message}`)
      }
    }

    console.log("Trade signal processed successfully:", {
      sessionId,
      tradeId: signal.id,
      symbol: signal.symbol,
      tradeAmount,
      currentNode
    })

    return {
      success: true,
      data: processedSignal
    }

  } catch (error) {
    console.error("Error processing trade signal:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error processing trade signal"
    }
  }
}

// Helper functions
async function findSessionByTradeId(tradeId: string): Promise<any | null> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }

    const result = await sql`
      SELECT s.session_id, s.current_node, s.initial_amount, s.is_completed
      FROM sessions s
      INNER JOIN trade_signals ts ON s.session_id = ts.session_id
      WHERE ts.trade_id = ${tradeId}
      ORDER BY ts.created_at DESC
      LIMIT 1
    `

    return result.length > 0 ? result[0] : null
  } catch (error) {
    console.log("No existing session found for trade ID:", tradeId)
    return null
  }
}

async function createNewSession(sessionId: string, signal: TradeSignal, currentNode: string, initialAmount: number): Promise<void> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }

    const startTime = new Date()
    const sessionName = `Trade Session - ${signal.symbol} - ${signal.id}`

    // Check if session_name column exists
    let hasSessionNameColumn = false
    try {
      await sql`SELECT session_name FROM sessions LIMIT 1`
      hasSessionNameColumn = true
    } catch (error) {
      console.log("session_name column not found, using legacy format")
      hasSessionNameColumn = false
    }

    if (hasSessionNameColumn) {
      await sql`
        INSERT INTO sessions (
          session_id, session_name, timestamp, result, initial_amount, final_total,
          session_notes, duration, is_completed, current_node, path_summary,
          session_start_time, last_action_timestamp
        ) VALUES (
          ${sessionId}, 
          ${sessionName}, 
          ${startTime.toISOString()}, 
          ${""}, 
          ${initialAmount}, 
          ${0}, 
          ${`Auto-created from TradingView signal: ${signal.symbol} ${signal.action}`}, 
          ${""}, 
          ${false}, 
          ${currentNode}, 
          ${currentNode}, 
          ${startTime.toISOString()}, 
          ${startTime.toISOString()}
        )
      `
    } else {
      await sql`
        INSERT INTO sessions (
          session_id, timestamp, result, initial_amount, final_total,
          session_notes, duration, is_completed, current_node, path_summary,
          session_start_time, last_action_timestamp
        ) VALUES (
          ${sessionId}, 
          ${startTime.toISOString()}, 
          ${""}, 
          ${initialAmount}, 
          ${0}, 
          ${`Auto-created from TradingView signal: ${signal.symbol} ${signal.action}`}, 
          ${""}, 
          ${false}, 
          ${currentNode}, 
          ${currentNode}, 
          ${startTime.toISOString()}, 
          ${startTime.toISOString()}
        )
      `
    }

    // Create initial session step
    await sql`
      INSERT INTO session_steps (
        session_id, step_number, node_name, action, stake_value,
        stake_result, step_timestamp, note
      ) VALUES (
        ${sessionId}, 
        ${1}, 
        ${currentNode}, 
        ${"start"}, 
        ${calculateValue(decisionTree[currentNode].value, initialAmount)}, 
        ${null}, 
        ${startTime.toISOString()}, 
        ${`Auto-created from TradingView signal: ${signal.symbol} ${signal.action}`}
      )
    `

    console.log("New session created:", sessionId)
  } catch (error) {
    console.error("Error creating new session:", error)
    throw error
  }
}

async function saveTradeSignal(processedSignal: ProcessedTradeSignal): Promise<void> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }

    // Create trade_signals table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS trade_signals (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(50) NOT NULL,
        trade_id VARCHAR(100) UNIQUE NOT NULL,
        symbol VARCHAR(20) NOT NULL,
        action VARCHAR(10) NOT NULL,
        entry_price DECIMAL(20, 8),
        target_price DECIMAL(20, 8),
        stop_price DECIMAL(20, 8),
        trade_amount INTEGER NOT NULL,
        current_node VARCHAR(20) NOT NULL,
        timeframe VARCHAR(10),
        time VARCHAR(50),
        rr VARCHAR(20),
        risk DECIMAL(10, 4),
        initial_amount INTEGER NOT NULL,
        node_stake_percentage VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Insert or update trade signal
    await sql`
      INSERT INTO trade_signals (
        session_id, trade_id, symbol, action, entry_price, target_price, stop_price,
        trade_amount, current_node, timeframe, time, rr, risk, initial_amount, node_stake_percentage
      ) VALUES (
        ${processedSignal.session_id},
        ${processedSignal.trade_id},
        ${processedSignal.symbol},
        ${processedSignal.action},
        ${processedSignal.entry},
        ${processedSignal.target},
        ${processedSignal.stop},
        ${processedSignal.trade_amount},
        ${processedSignal.current_node},
        ${processedSignal.timeframe},
        ${processedSignal.time},
        ${processedSignal.rr},
        ${processedSignal.risk},
        ${processedSignal.initial_amount},
        ${processedSignal.node_stake_percentage}
      )
      ON CONFLICT (trade_id) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        symbol = EXCLUDED.symbol,
        action = EXCLUDED.action,
        entry_price = EXCLUDED.entry_price,
        target_price = EXCLUDED.target_price,
        stop_price = EXCLUDED.stop_price,
        trade_amount = EXCLUDED.trade_amount,
        current_node = EXCLUDED.current_node,
        timeframe = EXCLUDED.timeframe,
        time = EXCLUDED.time,
        rr = EXCLUDED.rr,
        risk = EXCLUDED.risk,
        initial_amount = EXCLUDED.initial_amount,
        node_stake_percentage = EXCLUDED.node_stake_percentage,
        updated_at = CURRENT_TIMESTAMP
    `

    console.log("Trade signal saved to database:", processedSignal.trade_id)
  } catch (error) {
    console.error("Error saving trade signal:", error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/webhook/trade-signal - Starting")

    if (!sql) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not configured. Please set up your DATABASE_URL environment variable.",
        },
        { status: 503 },
      )
    }

    const body = await request.text()
    console.log("Trade signal received:", body)

    let signalData: any
    try {
      signalData = JSON.parse(body)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Validate the signal format with enhanced processor
    const validationResult = signalProcessor.validateTradeSignal(signalData)
    if (!validationResult.isValid) {
      const errorResponse = exceptionHandler.handleSignalValidationError(signalData, validationResult.errors)
      console.error("Signal validation failed:", errorResponse)
      return NextResponse.json(
        {
          ...errorResponse,
          warnings: validationResult.warnings || []
        },
        { status: 400 }
      )
    }

    // Monitor signal delay
    const signalTime = new Date(signalData.time || new Date().toISOString())
    alertService.monitorSignalDelay(signalTime)

    // Process the trade signal
    const result = await processTradeSignal(signalData)
    
    if (result.success) {
      console.log("Trade signal processed successfully:", result.data)
      
      // Monitor stake calculation
      if (result.data) {
        const node = decisionTree[result.data.current_node]
        if (node) {
          const expectedStake = parseFloat(node.value.replace('%', ''))
          const actualStake = parseFloat(result.data.node_stake_percentage.replace('%', ''))
          alertService.monitorStakeCalculation(actualStake, expectedStake)
        }
      }
      
      // Execute trade on trading platform
      console.log("Executing trade on trading platform...")
      const executionResult = await tradingPlatform.executeTrade(result.data)
      
      // Record trade costs in database
      if (result.data?.cost_adjustment) {
        try {
          await brokerCostService.recordTradeCosts(
            result.data.trade_id,
            result.data.session_id,
            {
              nominalAmount: result.data.cost_adjustment.nominal_amount,
              commission: result.data.cost_adjustment.total_costs * 0.4, // Estimate 40% commission
              spreadCost: result.data.cost_adjustment.total_costs * 0.5, // Estimate 50% spread
              swapCost: result.data.cost_adjustment.total_costs * 0.1, // Estimate 10% swap
              totalCosts: result.data.cost_adjustment.total_costs,
              netAmount: result.data.trade_amount,
              costBreakdown: {
                commission: result.data.cost_adjustment.total_costs * 0.4,
                spreadCost: result.data.cost_adjustment.total_costs * 0.5,
                swapCost: result.data.cost_adjustment.total_costs * 0.1,
                otherFees: 0
              },
              riskAdjustments: {
                effectiveSLDistance: 0,
                adjustedStake: result.data.trade_amount,
                maxAllowedStake: result.data.trade_amount
              },
              validation: {
                isWithinLimits: true,
                warnings: [],
                errors: []
              }
            }
          )
          console.log("Trade costs recorded successfully")
        } catch (error) {
          console.error("Error recording trade costs:", error)
        }
      }
      
      if (executionResult.status === 'SUCCESS') {
        console.log("Trade executed successfully:", executionResult.platform_order_id)
        
        // Register trade for overnight monitoring to prevent swap fees
        if (result.data) {
          try {
            await overnightTradeManager.registerTrade(
              result.data.trade_id,
              result.data.session_id,
              result.data.symbol,
              Number(result.data.entry),
              Number(result.data.target),
              Number(result.data.stop),
              result.data.trade_amount,
              result.data.current_node,
              true // Enable overnight close by default
            )
            console.log(`Trade ${result.data.trade_id} registered for overnight monitoring`)
          } catch (error) {
            console.error("Error registering trade for overnight monitoring:", error)
          }
        }
        
        // Start monitoring for trade result (in background)
        setTimeout(async () => {
          try {
            const tradeResult = await tradingPlatform.monitorTradeResult(executionResult)
            if (tradeResult) {
              console.log("Trade result:", tradeResult.result, "P&L:", tradeResult.profit_loss)
            }
          } catch (error) {
            console.error("Error monitoring trade result:", error)
          }
        }, 1000) // Start monitoring after 1 second
        
        return NextResponse.json({
          success: true,
          message: "Trade signal processed and executed successfully",
          data: {
            ...result.data,
            execution: {
              status: executionResult.status,
              platform_order_id: executionResult.platform_order_id,
              executed_at: executionResult.executed_at
            }
          }
        })
      } else {
        console.error("Trade execution failed:", executionResult.error)
        return NextResponse.json(
          {
            success: false,
            error: `Trade execution failed: ${executionResult.error}`,
            data: result.data
          },
          { status: 500 }
        )
      }
    } else {
      console.error("Failed to process trade signal:", result.error)
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error("Error in POST /api/webhook/trade-signal:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process trade signal",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Trade signal webhook is active",
    timestamp: new Date().toISOString()
  })
} 