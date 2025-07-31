import { sql } from "./db"
import { decisionTree, calculateValue, calculateValueWithCostAdjustment } from "./decision-tree"
import { brokerCostService } from "./broker-cost-service"
import type { TradeSignal, ProcessedTradeSignal, ValidationResult } from "./types"

export function validateTradeSignal(signal: any): ValidationResult {
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

export async function processTradeSignal(signal: TradeSignal): Promise<{ success: boolean; data?: ProcessedTradeSignal; error?: string }> {
  try {
    console.log("Processing trade signal:", signal.id)

    // Check if this trade ID already exists
    const existingSession = await findSessionByTradeId(signal.id)
    
    let sessionId: string
    let currentNode: string
    let initialAmount: number = 100000 // Default initial amount

    if (existingSession) {
      // Continue existing session
      sessionId = existingSession.session_id
      currentNode = existingSession.current_node
      initialAmount = existingSession.initial_amount
      console.log(`Continuing existing session: ${sessionId} at node: ${currentNode}`)
    } else {
      // Create new session
      sessionId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      currentNode = "Start" // Level 1 node
      console.log(`Creating new session: ${sessionId} starting at node: ${currentNode}`)
      
      // Create the session in database
      await createNewSession(sessionId, signal, currentNode, initialAmount)
    }

    // Calculate trade amount based on current decision tree node with cost adjustment
    const node = decisionTree[currentNode]
    if (!node) {
      throw new Error(`Invalid decision tree node: ${currentNode}`)
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

    // Save the trade signal to database
    await saveTradeSignal(processedSignal)

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

async function findSessionByTradeId(tradeId: string): Promise<any | null> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }

    // Check if trade_signals table exists and has this trade ID
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