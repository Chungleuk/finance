import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { decisionTree } from "@/lib/decision-tree"
import { exceptionHandler } from "@/lib/exception-handler"
import { alertService } from "@/lib/alert-service"
import type { TradeResult, NodeJumpValidation } from "@/lib/types"

export interface TradeResultCallback {
  trade_id: string
  session_id: string
  result: 'win' | 'loss'
  exit_price: number
  profit_loss: number
  exit_reason: 'target_reached' | 'stop_reached' | 'manual_close' | 'partial_fill'
  exited_at: string
  platform_order_id?: string
  actual_quantity?: number
  fees?: number
  slippage?: number
}

export interface TradeResultResponse {
  success: boolean
  message: string
  data?: {
    session_id: string
    current_node: string
    final_total: number
    is_completed: boolean
    next_action?: string
  }
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/webhook/trade-result - Processing trade result callback")

    const body = await request.text()
    let callbackData: TradeResultCallback
    
    try {
      callbackData = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid JSON in request body" 
      }, { status: 400 })
    }

    // Validate callback data
    const validation = validateTradeResultCallback(callbackData)
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: `Invalid callback data: ${validation.errors.join(', ')}`
      }, { status: 400 })
    }

    // Process the trade result
    const result = await processTradeResult(callbackData)
    
    if (result.success) {
      console.log("Trade result processed successfully:", result.data)
      return NextResponse.json(result)
    } else {
      console.error("Failed to process trade result:", result.error)
      return NextResponse.json(result, { status: 500 })
    }

  } catch (error) {
    console.error("Error processing trade result callback:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process trade result"
      },
      { status: 500 }
    )
  }
}

/**
 * Validate trade result callback data
 */
function validateTradeResultCallback(callback: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check required fields
  const requiredFields = ['trade_id', 'session_id', 'result', 'exit_price', 'profit_loss', 'exit_reason', 'exited_at']
  
  for (const field of requiredFields) {
    if (!callback[field]) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Validate result value
  if (callback.result && !['win', 'loss'].includes(callback.result)) {
    errors.push('Result must be either "win" or "loss"')
  }

  // Validate exit reason
  const validExitReasons = ['target_reached', 'stop_reached', 'manual_close', 'partial_fill']
  if (callback.exit_reason && !validExitReasons.includes(callback.exit_reason)) {
    errors.push(`Invalid exit reason: ${callback.exit_reason}`)
  }

  // Validate numeric fields
  if (callback.exit_price && isNaN(Number(callback.exit_price))) {
    errors.push('Exit price must be a valid number')
  }

  if (callback.profit_loss && isNaN(Number(callback.profit_loss))) {
    errors.push('Profit/loss must be a valid number')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Process trade result and update decision tree
 */
async function processTradeResult(callback: TradeResultCallback): Promise<TradeResultResponse> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }

    console.log(`Processing trade result: ${callback.trade_id} - ${callback.result}`)

    // Get current session data
    const sessionData = await getSessionData(callback.session_id)
    if (!sessionData) {
      throw new Error(`Session not found: ${callback.session_id}`)
    }

    // Validate session is not completed
    if (sessionData.is_completed) {
      throw new Error(`Session ${callback.session_id} is already completed`)
    }

    // Calculate new total
    const newTotal = sessionData.final_total + callback.profit_loss

    // Determine next node based on result
    const currentNode = sessionData.current_node
    const node = decisionTree[currentNode]
    
    if (!node) {
      throw new Error(`Invalid decision tree node: ${currentNode}`)
    }

    let nextNode: string
    let isCompleted = false
    let nextAction = ''

    if (callback.result === 'win') {
      nextNode = node.win || 'End'
      nextAction = 'WIN - Moving to next level'
    } else {
      nextNode = node.loss || 'End'
      nextAction = 'LOSS - Moving to next level'
    }

    // Check if this is a final node
    if (nextNode === 'End' || node.final) {
      isCompleted = true
      nextAction = 'SESSION COMPLETED'
    }

    // Validate node jump
    const nodeJumpValidation = validateNodeJump(currentNode, nextNode)
    if (nodeJumpValidation.requiresRollback) {
      console.warn(`⚠️ Invalid node jump detected: ${currentNode} → ${nextNode}`)
      
      const rollbackResult = await exceptionHandler.handleNodeJumpValidation(
        callback.session_id,
        currentNode,
        nextNode,
        nodeJumpValidation
      )

      if (rollbackResult.requiresManualConfirmation) {
        return {
          success: false,
          error: `Invalid node jump requires manual confirmation. Expected: ${nodeJumpValidation.expectedNode}, Actual: ${nodeJumpValidation.actualNode}`,
          data: {
            session_id: callback.session_id,
            current_node: currentNode,
            final_total: newTotal,
            is_completed: false,
            next_action: 'MANUAL CONFIRMATION REQUIRED'
          }
        }
      }
    }

    // Update session with new data
    await updateSession(callback.session_id, nextNode, newTotal, isCompleted)

    // Record the result step
    await recordResultStep(callback)

    // Update path summary
    const newPathSummary = sessionData.path_summary 
      ? `${sessionData.path_summary} → ${nextNode}`
      : `${currentNode} → ${nextNode}`

    await updatePathSummary(callback.session_id, newPathSummary)

    // Monitor stake calculation if this was a loss
    if (callback.result === 'loss') {
      const expectedStake = parseFloat(node.value.replace('%', ''))
      const actualStake = (callback.profit_loss / sessionData.initial_amount) * 100
      alertService.monitorStakeCalculation(Math.abs(actualStake), expectedStake)
    }

    console.log(`Trade result processed: ${callback.session_id} - ${callback.result} - New total: $${newTotal.toFixed(2)}`)

    return {
      success: true,
      message: `Trade result processed successfully. ${nextAction}`,
      data: {
        session_id: callback.session_id,
        current_node: nextNode,
        final_total: newTotal,
        is_completed: isCompleted,
        next_action: nextAction
      }
    }

  } catch (error) {
    console.error("Error processing trade result:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error processing trade result"
    }
  }
}

/**
 * Get session data from database
 */
async function getSessionData(sessionId: string): Promise<any | null> {
  try {
    const result = await sql`
      SELECT session_id, current_node, final_total, is_completed, path_summary, initial_amount
      FROM sessions 
      WHERE session_id = ${sessionId}
    `
    return result.length > 0 ? result[0] : null
  } catch (error) {
    console.error("Error getting session data:", error)
    return null
  }
}

/**
 * Validate node jump logic
 */
function validateNodeJump(currentNode: string, nextNode: string): NodeJumpValidation {
  const currentLevel = parseInt(currentNode.replace(/\D/g, '')) || 1
  const nextLevel = parseInt(nextNode.replace(/\D/g, '')) || 1

  // Check for invalid jumps (e.g., Level 2 → Level 4)
  if (nextLevel > currentLevel + 1) {
    return {
      isValid: false,
      expectedNode: `Level ${currentLevel + 1}`,
      actualNode: nextNode,
      requiresRollback: true,
      rollbackToNode: currentNode
    }
  }

  return {
    isValid: true,
    expectedNode: nextNode,
    actualNode: nextNode,
    requiresRollback: false
  }
}

/**
 * Update session with new data
 */
async function updateSession(sessionId: string, nextNode: string, newTotal: number, isCompleted: boolean): Promise<void> {
  await sql`
    UPDATE sessions 
    SET current_node = ${nextNode},
        final_total = ${newTotal},
        is_completed = ${isCompleted},
        last_action_timestamp = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE session_id = ${sessionId}
  `
}

/**
 * Record result step in session_steps table
 */
async function recordResultStep(callback: TradeResultCallback): Promise<void> {
  // Get the next step number
  const stepResult = await sql`
    SELECT COALESCE(MAX(step_number), 0) + 1 as next_step
    FROM session_steps 
    WHERE session_id = ${callback.session_id}
  `
  const nextStep = stepResult[0]?.next_step || 1

  // Calculate actual P&L for the trade_result_actual field
  const actualPnL = callback.profit_loss

  await sql`
    INSERT INTO session_steps (
      session_id, step_number, node_name, step_type, execution_status,
      note, step_timestamp, trade_result_actual
    ) VALUES (
      ${callback.session_id}, ${nextStep}, ${callback.result.toUpperCase()}, 'RESULT', 'COMPLETED',
      ${`Trade ${callback.result.toUpperCase()}: P&L: ${actualPnL.toFixed(2)}, Exit: ${callback.exit_price}, Reason: ${callback.exit_reason}`},
      ${new Date(callback.exited_at)}, ${actualPnL}
    )
  `
}

/**
 * Update path summary
 */
async function updatePathSummary(sessionId: string, pathSummary: string): Promise<void> {
  await sql`
    UPDATE sessions 
    SET path_summary = ${pathSummary}
    WHERE session_id = ${sessionId}
  `
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Trade Result Callback Endpoint",
    description: "Receives win/loss feedback from trading platform and updates decision tree",
    example: {
      trade_id: "20250719-000042",
      session_id: "ses_1234567890_abc123",
      result: "win",
      exit_price: 1.0965,
      profit_loss: 150.25,
      exit_reason: "target_reached",
      exited_at: "2025-07-19T09:30:00Z"
    }
  })
} 