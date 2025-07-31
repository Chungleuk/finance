import { sql } from "./db"
import { decisionTree, calculateValue } from "./decision-tree"
import { exceptionHandler } from "./exception-handler"
import { alertService } from "./alert-service"
import type { TradeExecution, TradeResult, ExecutionStatus, PartialFillResult } from "./types"

// Trading platform configuration
interface TradingPlatformConfig {
  platform: 'binance' | 'mt4' | 'mt5' | 'demo'
  apiKey?: string
  apiSecret?: string
  baseUrl?: string
  symbolMapping?: Record<string, string> // Map TradingView symbols to platform symbols
}

// Default configuration
const defaultConfig: TradingPlatformConfig = {
  platform: 'demo',
  symbolMapping: {
    'BTCUSDT': 'BTCUSDT',
    'ETHUSDT': 'ETHUSDT',
    'ADAUSDT': 'ADAUSDT'
  }
}

export class TradingPlatformService {
  private config: TradingPlatformConfig
  private cachedBalance: { amount: number; lastUpdated: Date } | null = null
  private readonly BALANCE_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  constructor(config: Partial<TradingPlatformConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Get current account balance from trading platform
   */
  async getAccountBalance(): Promise<number> {
    try {
      // Check if we have a cached balance that's still valid
      if (this.cachedBalance && 
          (Date.now() - this.cachedBalance.lastUpdated.getTime()) < this.BALANCE_CACHE_DURATION) {
        console.log(`Using cached balance: $${this.cachedBalance.amount.toLocaleString()}`)
        return this.cachedBalance.amount
      }

      console.log("Fetching current account balance from trading platform...")

      let balance: number

      switch (this.config.platform) {
        case 'binance':
          balance = await this.getBinanceBalance()
          break
        case 'mt4':
        case 'mt5':
          balance = await this.getMTBalance()
          break
        case 'demo':
        default:
          balance = await this.getDemoBalance()
          break
      }

      // Cache the balance
      this.cachedBalance = {
        amount: balance,
        lastUpdated: new Date()
      }

      console.log(`Account balance updated: $${balance.toLocaleString()}`)
      return balance

    } catch (error) {
      console.error("Error fetching account balance:", error)
      
      // Return cached balance if available, otherwise default
      if (this.cachedBalance) {
        console.log(`Using cached balance due to error: $${this.cachedBalance.amount.toLocaleString()}`)
        return this.cachedBalance.amount
      }
      
      console.log("Using default balance: $100,000")
      return 100000
    }
  }

  /**
   * Execute trade based on processed signal with retry mechanism
   */
  async executeTrade(processedSignal: any): Promise<TradeExecution> {
    const maxRetries = 3
    const retryDelay = 5000 // 5 seconds
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Executing trade for signal: ${processedSignal.trade_id} (Attempt ${attempt}/${maxRetries})`)

        // Validate trade parameters
        const validation = this.validateTradeParameters(processedSignal)
        if (!validation.isValid) {
          throw new Error(`Invalid trade parameters: ${validation.errors.join(', ')}`)
        }

        // Prepare trade execution data
        const executionData = this.prepareExecutionData(processedSignal)

        // Execute trade based on platform with timeout
        const executionResult = await this.executeTradeWithTimeout(executionData, attempt)

        // Handle partial fill scenarios
        if (executionResult.status === 'SUCCESS' && executionResult.actual_quantity) {
          const originalAmount = processedSignal.trade_amount
          const filledAmount = executionResult.actual_quantity * (executionResult.actual_entry_price || parseFloat(processedSignal.entry))
          
          if (Math.abs(filledAmount - originalAmount) / originalAmount > 0.01) { // 1% threshold
            console.log('⚠️ Partial fill detected, handling...')
            await exceptionHandler.handlePartialFill(
              processedSignal.session_id,
              originalAmount,
              filledAmount
            )
          }
        }

        // Record execution step
        await this.recordExecutionStep(processedSignal.session_id, executionResult)

        console.log(`✅ Trade executed successfully on attempt ${attempt}`)
        return executionResult

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.error(`❌ Trade execution failed (Attempt ${attempt}/${maxRetries}):`, lastError.message)

        // Check if this is a retryable error
        if (!this.isRetryableError(lastError) || attempt === maxRetries) {
          break
        }

        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1)
        console.log(`⏳ Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries failed
    console.error(`❌ Trade execution failed after ${maxRetries} attempts`)
    const failedExecution: TradeExecution = {
      trade_id: processedSignal.trade_id,
      session_id: processedSignal.session_id,
      status: 'FAILED',
      error: lastError?.message || 'Unknown error after all retries',
      executed_at: new Date(),
      platform_order_id: null,
      actual_entry_price: null,
      actual_quantity: null
    }

    // Record failed execution
    await this.recordExecutionStep(processedSignal.session_id, failedExecution)
    
    return failedExecution
  }

  /**
   * Execute trade with timeout and platform selection
   */
  private async executeTradeWithTimeout(executionData: any, attempt: number): Promise<TradeExecution> {
    const timeout = 30000 // 30 seconds timeout
    const startTime = Date.now()

    try {
      // Execute trade based on platform
      let executionResult: TradeExecution

      switch (this.config.platform) {
        case 'binance':
          executionResult = await this.executeBinanceTrade(executionData)
          break
        case 'mt4':
        case 'mt5':
          executionResult = await this.executeMTTrade(executionData)
          break
        case 'demo':
        default:
          executionResult = await this.executeDemoTrade(executionData)
          break
      }

      const responseTime = Date.now() - startTime
      console.log(`Platform response time: ${responseTime}ms`)

      // Monitor platform health
      alertService.monitorPlatformHealth(true, responseTime)

      return executionResult

    } catch (error) {
      const responseTime = Date.now() - startTime
      alertService.monitorPlatformHealth(false, responseTime)
      throw error
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'rate limit',
      'server error',
      'gateway',
      'service unavailable'
    ]

    const errorMessage = error.message.toLowerCase()
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    )
  }

  /**
   * Monitor trade result (target/stop reached)
   */
  async monitorTradeResult(execution: TradeExecution): Promise<TradeResult | null> {
    try {
      if (execution.status !== 'SUCCESS') {
        return null
      }

      console.log(`Monitoring trade result for: ${execution.trade_id}`)

      // Get trade details from database
      const tradeSignal = await this.getTradeSignal(execution.trade_id)
      if (!tradeSignal) {
        throw new Error('Trade signal not found')
      }

      // Check if target or stop is reached
      const currentPrice = await this.getCurrentPrice(tradeSignal.symbol)
      const result = this.checkTargetStopReached(tradeSignal, currentPrice)

      if (result) {
        // Record result step
        await this.recordResultStep(execution.session_id, result)
        
        // Update decision tree node
        await this.updateDecisionTreeNode(execution.session_id, result)
      }

      return result

    } catch (error) {
      console.error('Trade result monitoring failed:', error)
      return null
    }
  }

  /**
   * Validate trade parameters before execution
   */
  private validateTradeParameters(signal: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check required fields
    if (!signal.entry || isNaN(Number(signal.entry))) {
      errors.push('Invalid entry price')
    }
    if (!signal.target || isNaN(Number(signal.target))) {
      errors.push('Invalid target price')
    }
    if (!signal.stop || isNaN(Number(signal.stop))) {
      errors.push('Invalid stop price')
    }
    if (!signal.trade_amount || signal.trade_amount <= 0) {
      errors.push('Invalid trade amount')
    }

    // Check price logic
    const entry = Number(signal.entry)
    const target = Number(signal.target)
    const stop = Number(signal.stop)

    if (signal.action.toLowerCase() === 'buy' || signal.action.toLowerCase() === 'long') {
      if (target <= entry) {
        errors.push('Target must be higher than entry for buy orders')
      }
      if (stop >= entry) {
        errors.push('Stop must be lower than entry for buy orders')
      }
    } else if (signal.action.toLowerCase() === 'sell' || signal.action.toLowerCase() === 'short') {
      if (target >= entry) {
        errors.push('Target must be lower than entry for sell orders')
      }
      if (stop <= entry) {
        errors.push('Stop must be higher than entry for sell orders')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Prepare execution data for trading platform
   */
  private prepareExecutionData(signal: any) {
    const platformSymbol = this.config.symbolMapping?.[signal.symbol] || signal.symbol
    
    return {
      symbol: platformSymbol,
      action: signal.action,
      entry_price: Number(signal.entry),
      target_price: Number(signal.target),
      stop_price: Number(signal.stop),
      trade_amount: signal.trade_amount,
      quantity: this.calculateQuantity(signal.trade_amount, Number(signal.entry)),
      trade_id: signal.trade_id,
      session_id: signal.session_id
    }
  }

  /**
   * Calculate quantity based on trade amount and entry price
   */
  private calculateQuantity(tradeAmount: number, entryPrice: number): number {
    return tradeAmount / entryPrice
  }

  /**
   * Execute trade on Binance
   */
  private async executeBinanceTrade(data: any): Promise<TradeExecution> {
    // This is a placeholder for Binance API integration
    // In production, you would use the actual Binance API
    console.log('Executing Binance trade:', data)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      trade_id: data.trade_id,
      session_id: data.session_id,
      status: 'SUCCESS',
      platform_order_id: `binance_${Date.now()}`,
      actual_entry_price: data.entry_price,
      actual_quantity: data.quantity,
      executed_at: new Date(),
      error: null
    }
  }

  /**
   * Execute trade on MT4/MT5
   */
  private async executeMTTrade(data: any): Promise<TradeExecution> {
    // This is a placeholder for MT4/MT5 API integration
    console.log('Executing MT trade:', data)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    return {
      trade_id: data.trade_id,
      session_id: data.session_id,
      status: 'SUCCESS',
      platform_order_id: `mt_${Date.now()}`,
      actual_entry_price: data.entry_price,
      actual_quantity: data.quantity,
      executed_at: new Date(),
      error: null
    }
  }

  /**
   * Execute demo trade (for testing)
   */
  private async executeDemoTrade(data: any): Promise<TradeExecution> {
    console.log('Executing demo trade:', data)

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Simulate 95% success rate
    const isSuccess = Math.random() > 0.05

    if (isSuccess) {
      return {
        trade_id: data.trade_id,
        session_id: data.session_id,
        status: 'SUCCESS',
        platform_order_id: `demo_${Date.now()}`,
        actual_entry_price: data.entry_price,
        actual_quantity: data.quantity,
        executed_at: new Date(),
        error: null
      }
    } else {
      return {
        trade_id: data.trade_id,
        session_id: data.session_id,
        status: 'FAILED',
        platform_order_id: null,
        actual_entry_price: null,
        actual_quantity: null,
        executed_at: new Date(),
        error: 'Demo trade failed (simulated)'
      }
    }
  }

  /**
   * Get Binance account balance
   */
  private async getBinanceBalance(): Promise<number> {
    // This is a placeholder for Binance API integration
    // In production, you would use the actual Binance API
    console.log("Fetching Binance account balance...")
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simulate balance variation (real balance would come from API)
    const baseBalance = 100000
    const variation = (Math.random() - 0.5) * 0.1 // ±5% variation
    const balance = Math.round(baseBalance * (1 + variation))
    
    console.log(`Binance balance: $${balance.toLocaleString()}`)
    return balance
  }

  /**
   * Get MT4/MT5 account balance
   */
  private async getMTBalance(): Promise<number> {
    // This is a placeholder for MT4/MT5 API integration
    console.log("Fetching MT4/MT5 account balance...")
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Simulate balance variation
    const baseBalance = 100000
    const variation = (Math.random() - 0.5) * 0.1 // ±5% variation
    const balance = Math.round(baseBalance * (1 + variation))
    
    console.log(`MT4/MT5 balance: $${balance.toLocaleString()}`)
    return balance
  }

  /**
   * Get demo account balance
   */
  private async getDemoBalance(): Promise<number> {
    // For demo mode, we can simulate a realistic balance
    console.log("Fetching demo account balance...")
    
    // Simulate balance variation
    const baseBalance = 100000
    const variation = (Math.random() - 0.5) * 0.1 // ±5% variation
    const balance = Math.round(baseBalance * (1 + variation))
    
    console.log(`Demo balance: $${balance.toLocaleString()}`)
    return balance
  }

  /**
   * Get current price for symbol
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    // This is a placeholder for price fetching
    // In production, you would fetch from trading platform API
    
    // Simulate price movement around entry price
    const basePrice = 45000 // Example BTC price
    const variation = (Math.random() - 0.5) * 0.02 // ±1% variation
    return basePrice * (1 + variation)
  }

  /**
   * Check if target or stop is reached
   */
  private checkTargetStopReached(tradeSignal: any, currentPrice: number): TradeResult | null {
    const entry = Number(tradeSignal.entry_price)
    const target = Number(tradeSignal.target_price)
    const stop = Number(tradeSignal.stop_price)
    const isLong = tradeSignal.action.toLowerCase() === 'buy' || tradeSignal.action.toLowerCase() === 'long'

    if (isLong) {
      if (currentPrice >= target) {
        return {
          trade_id: tradeSignal.trade_id,
          session_id: tradeSignal.session_id,
          result: 'win',
          exit_price: target,
          profit_loss: tradeSignal.trade_amount * ((target - entry) / entry),
          exit_reason: 'target_reached',
          exited_at: new Date()
        }
      } else if (currentPrice <= stop) {
        return {
          trade_id: tradeSignal.trade_id,
          session_id: tradeSignal.session_id,
          result: 'loss',
          exit_price: stop,
          profit_loss: -tradeSignal.trade_amount * ((entry - stop) / entry),
          exit_reason: 'stop_reached',
          exited_at: new Date()
        }
      }
    } else {
      if (currentPrice <= target) {
        return {
          trade_id: tradeSignal.trade_id,
          session_id: tradeSignal.session_id,
          result: 'win',
          exit_price: target,
          profit_loss: tradeSignal.trade_amount * ((entry - target) / entry),
          exit_reason: 'target_reached',
          exited_at: new Date()
        }
      } else if (currentPrice >= stop) {
        return {
          trade_id: tradeSignal.trade_id,
          session_id: tradeSignal.session_id,
          result: 'loss',
          exit_price: stop,
          profit_loss: -tradeSignal.trade_amount * ((stop - entry) / entry),
          exit_reason: 'stop_reached',
          exited_at: new Date()
        }
      }
    }

    return null
  }

  /**
   * Record execution step in database
   */
  private async recordExecutionStep(sessionId: string, execution: TradeExecution): Promise<void> {
    try {
      if (!sql) {
        throw new Error('Database not available')
      }

      // Get current step number
      const stepResult = await sql`
        SELECT COALESCE(MAX(step_number), 0) + 1 as next_step
        FROM session_steps 
        WHERE session_id = ${sessionId}
      `
      const stepNumber = stepResult[0]?.next_step || 1

      await sql`
        INSERT INTO session_steps (
          session_id, step_number, node_name, action, stake_value,
          stake_result, step_timestamp, note, step_type, execution_status
        ) VALUES (
          ${sessionId},
          ${stepNumber},
          ${'EXECUTE'},
          ${execution.status === 'SUCCESS' ? 'execute' : 'failed'},
          ${0},
          ${null},
          ${execution.executed_at.toISOString()},
          ${`Trade execution: ${execution.status}${execution.error ? ` - ${execution.error}` : ''}`},
          ${'EXECUTE'},
          ${execution.status}
        )
      `

      console.log(`Execution step recorded for session: ${sessionId}`)
    } catch (error) {
      console.error('Error recording execution step:', error)
    }
  }

  /**
   * Record result step in database
   */
  private async recordResultStep(sessionId: string, result: TradeResult): Promise<void> {
    try {
      if (!sql) {
        throw new Error('Database not available')
      }

      // Get current step number
      const stepResult = await sql`
        SELECT COALESCE(MAX(step_number), 0) + 1 as next_step
        FROM session_steps 
        WHERE session_id = ${sessionId}
      `
      const stepNumber = stepResult[0]?.next_step || 1

      await sql`
        INSERT INTO session_steps (
          session_id, step_number, node_name, action, stake_value,
          stake_result, step_timestamp, note, step_type, execution_status
        ) VALUES (
          ${sessionId},
          ${stepNumber},
          ${result.result.toUpperCase()},
          ${result.result},
          ${0},
          ${result.profit_loss},
          ${result.exited_at.toISOString()},
          ${`Trade result: ${result.result} - ${result.exit_reason} - P&L: ${result.profit_loss.toFixed(2)}`},
          ${'RESULT'},
          ${'COMPLETED'}
        )
      `

      console.log(`Result step recorded for session: ${sessionId}`)
    } catch (error) {
      console.error('Error recording result step:', error)
    }
  }

  /**
   * Update decision tree node based on trade result
   */
  private async updateDecisionTreeNode(sessionId: string, result: TradeResult): Promise<void> {
    try {
      if (!sql) {
        throw new Error('Database not available')
      }

      // Get current session
      const sessionResult = await sql`
        SELECT current_node, initial_amount, final_total
        FROM sessions 
        WHERE session_id = ${sessionId}
      `

      if (sessionResult.length === 0) {
        throw new Error('Session not found')
      }

      const session = sessionResult[0]
      const currentNode = session.current_node
      const node = decisionTree[currentNode]

      if (!node) {
        throw new Error(`Invalid decision tree node: ${currentNode}`)
      }

      // Determine next node based on result
      const nextNode = result.result === 'win' ? node.win : node.loss
      
      if (!nextNode) {
        throw new Error(`No next node defined for ${currentNode} with result ${result.result}`)
      }

      // Validate node jump with exception handling
      const nodeValidation = exceptionHandler.validateNodeJump(currentNode, nextNode)
      
      if (!nodeValidation.isValid) {
        console.warn('⚠️ Invalid node jump detected, executing rollback...')
        
        const rollbackResult = await exceptionHandler.executeRollback(
          sessionId,
          nodeValidation.rollbackToNode || currentNode,
          `Invalid jump from ${currentNode} to ${nextNode}. Expected: ${nodeValidation.expectedNode}`
        )
        
        if (rollbackResult.success) {
          console.log('✅ Rollback executed successfully')
          return // Stop further processing, manual confirmation required
        } else {
          console.error('❌ Rollback failed:', rollbackResult.message)
          throw new Error(`Rollback failed: ${rollbackResult.message}`)
        }
      }

      // Calculate new running total
      const newRunningTotal = (session.final_total || 0) + result.profit_loss

      // Update session
      const hasSessionNameColumn = await this.checkSessionNameColumn()
      
      if (hasSessionNameColumn) {
        await sql`
          UPDATE sessions 
          SET current_node = ${nextNode},
              final_total = ${newRunningTotal},
              path_summary = ${session.path_summary ? `${session.path_summary} → ${nextNode}` : nextNode},
              last_action_timestamp = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ${sessionId}
        `
      } else {
        await sql`
          UPDATE sessions 
          SET current_node = ${nextNode},
              final_total = ${newRunningTotal},
              path_summary = ${session.path_summary ? `${session.path_summary} → ${nextNode}` : nextNode},
              last_action_timestamp = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ${sessionId}
        `
      }

      // Check if session is completed (reached end state)
      const nextNodeData = decisionTree[nextNode]
      if (nextNodeData?.final) {
        await this.completeSession(sessionId, nextNode, newRunningTotal)
      }

      console.log(`Decision tree node updated: ${currentNode} → ${nextNode}`)
    } catch (error) {
      console.error('Error updating decision tree node:', error)
    }
  }

  /**
   * Update session initial amount based on current platform balance
   */
  async updateSessionBalance(sessionId: string): Promise<void> {
    try {
      if (!sql) {
        throw new Error("Database not available")
      }

      const currentBalance = await this.getAccountBalance()
      
      // Get current session
      const sessionResult = await sql`
        SELECT initial_amount FROM sessions WHERE session_id = ${sessionId}
      `

      if (sessionResult.length === 0) {
        throw new Error('Session not found')
      }

      const currentInitialAmount = sessionResult[0].initial_amount
      const balanceDifference = Math.abs(currentBalance - currentInitialAmount)
      const percentageChange = (balanceDifference / currentInitialAmount) * 100

      // Only update if balance changed by more than 5%
      if (percentageChange > 5) {
        console.log(`Balance changed by ${percentageChange.toFixed(2)}%. Updating session balance...`)
        console.log(`Old balance: $${currentInitialAmount.toLocaleString()}`)
        console.log(`New balance: $${currentBalance.toLocaleString()}`)

        const hasSessionNameColumn = await this.checkSessionNameColumn()
        
        if (hasSessionNameColumn) {
          await sql`
            UPDATE sessions 
            SET initial_amount = ${currentBalance},
                updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ${sessionId}
          `
        } else {
          await sql`
            UPDATE sessions 
            SET initial_amount = ${currentBalance},
                updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ${sessionId}
          `
        }

        console.log(`Session ${sessionId} balance updated successfully`)
      } else {
        console.log(`Balance change (${percentageChange.toFixed(2)}%) is within acceptable range. No update needed.`)
      }

    } catch (error) {
      console.error('Error updating session balance:', error)
    }
  }

  /**
   * Complete session when reaching end state
   */
  private async completeSession(sessionId: string, finalNode: string, finalTotal: number): Promise<void> {
    try {
      if (!sql) {
        throw new Error('Database not available')
      }

      const hasSessionNameColumn = await this.checkSessionNameColumn()
      
      if (hasSessionNameColumn) {
        await sql`
          UPDATE sessions 
          SET is_completed = true,
              result = ${finalNode},
              final_total = ${finalTotal},
              updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ${sessionId}
        `
      } else {
        await sql`
          UPDATE sessions 
          SET is_completed = true,
              result = ${finalNode},
              final_total = ${finalTotal},
              updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ${sessionId}
        `
      }

      console.log(`Session completed: ${sessionId} with result: ${finalNode}`)
    } catch (error) {
      console.error('Error completing session:', error)
    }
  }

  /**
   * Get trade signal from database
   */
  private async getTradeSignal(tradeId: string): Promise<any | null> {
    try {
      if (!sql) {
        throw new Error('Database not available')
      }

      const result = await sql`
        SELECT * FROM trade_signals WHERE trade_id = ${tradeId}
      `

      return result.length > 0 ? result[0] : null
    } catch (error) {
      console.error('Error getting trade signal:', error)
      return null
    }
  }

  /**
   * Check if session_name column exists
   */
  private async checkSessionNameColumn(): Promise<boolean> {
    try {
      if (!sql) {
        return false
      }

      await sql`SELECT session_name FROM sessions LIMIT 1`
      return true
    } catch (error) {
      return false
    }
  }
}

// Export singleton instance
export const tradingPlatform = new TradingPlatformService() 