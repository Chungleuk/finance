import { sql } from "./db"
import { decisionTree, calculateValue } from "./decision-tree"
import { tradingPlatform } from "./trading-platform-service"
import { exceptionHandler } from "./exception-handler"
import { alertService } from "./alert-service"
import type { TradeSignal, ProcessedTradeSignal, ValidationResult, CachedSessionData } from "./types"

export interface SignalProcessingResult {
  success: boolean
  data?: ProcessedTradeSignal
  error?: string
  warnings?: string[]
  sessionId?: string
  isNewSession?: boolean
}

export interface EnhancedTradeSignal extends TradeSignal {
  // Enhanced fields for better processing
  signal_quality?: 'high' | 'medium' | 'low'
  market_conditions?: string
  confidence_score?: number
  source?: string
}

export class SignalProcessor {
  private processedSignals: Set<string> = new Set()
  private readonly MAX_SIGNAL_AGE_HOURS = 24
  private readonly MIN_CONFIDENCE_SCORE = 0.7

  /**
   * Enhanced signal validation with specific requirements
   */
  validateTradeSignal(signal: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required fields
    const requiredFields = ['action', 'symbol', 'timeframe', 'time', 'entry', 'target', 'stop', 'id', 'rr', 'risk']
    
    for (const field of requiredFields) {
      if (!signal[field] || signal[field] === '') {
        errors.push(`Missing required field: ${field}`)
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors }
    }

    // Enhanced validation
    this.validateAction(signal.action, errors, warnings)
    this.validateTimeframe(signal.timeframe, errors, warnings)
    this.validatePrices(signal, errors, warnings)
    this.validateRiskReward(signal, errors, warnings)
    this.validateSignalAge(signal.time, errors, warnings)
    this.validateSignalQuality(signal, errors, warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate action field with case normalization
   */
  private validateAction(action: string, errors: string[], warnings: string[]): void {
    const normalizedAction = action.toLowerCase()
    const validActions = ['buy', 'sell', 'long', 'short']
    
    if (!validActions.includes(normalizedAction)) {
      errors.push(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`)
    } else if (action !== normalizedAction) {
      warnings.push(`Action normalized from '${action}' to '${normalizedAction}'`)
    }
  }

  /**
   * Validate and normalize timeframe format
   */
  private validateTimeframe(timeframe: string, errors: string[], warnings: string[]): void {
    // Handle various timeframe formats
    const timeframeMap: { [key: string]: string } = {
      '1': '1m', '5': '5m', '15': '15m', '30': '30m',
      '60': '1h', '240': '4h', '1440': '1d', '10080': '1w'
    }

    let normalizedTimeframe = timeframe
    
    if (timeframeMap[timeframe]) {
      normalizedTimeframe = timeframeMap[timeframe]
      warnings.push(`Timeframe normalized from '${timeframe}' to '${normalizedTimeframe}'`)
    } else if (!/^\d+[mhdw]$/.test(timeframe)) {
      errors.push(`Invalid timeframe format: ${timeframe}. Expected format: 1m, 5m, 15m, 1h, 4h, 1d, 1w`)
    }
  }

  /**
   * Validate price logic and relationships
   */
  private validatePrices(signal: any, errors: string[], warnings: string[]): void {
    const entry = parseFloat(signal.entry)
    const target = parseFloat(signal.target)
    const stop = parseFloat(signal.stop)

    if (isNaN(entry) || isNaN(target) || isNaN(stop)) {
      errors.push('Entry, target, and stop must be valid numeric values')
      return
    }

    const action = signal.action.toLowerCase()
    
    if (action === 'buy' || action === 'long') {
      if (target <= entry) {
        errors.push('For BUY orders: target must be greater than entry')
      }
      if (stop >= entry) {
        errors.push('For BUY orders: stop must be less than entry')
      }
    } else if (action === 'sell' || action === 'short') {
      if (target >= entry) {
        errors.push('For SELL orders: target must be less than entry')
      }
      if (stop <= entry) {
        errors.push('For SELL orders: stop must be greater than entry')
      }
    }

    // Check for reasonable price ranges
    const priceRange = Math.abs(target - entry) / entry
    if (priceRange > 0.1) { // 10% range
      warnings.push(`Large price range detected: ${(priceRange * 100).toFixed(2)}%`)
    }
  }

  /**
   * Validate risk-reward ratio
   */
  private validateRiskReward(signal: any, errors: string[], warnings: string[]): void {
    const rr = parseFloat(signal.rr)
    const risk = parseFloat(signal.risk)

    if (isNaN(rr) || isNaN(risk)) {
      errors.push('Risk-reward ratio and risk must be valid numeric values')
      return
    }

    if (rr <= 0) {
      errors.push('Risk-reward ratio must be positive')
    } else if (rr < 1) {
      warnings.push(`Low risk-reward ratio: ${rr}. Consider higher RR for better profitability`)
    } else if (rr > 10) {
      warnings.push(`Very high risk-reward ratio: ${rr}. Verify target and stop levels`)
    }

    if (risk <= 0 || risk > 5) {
      warnings.push(`Risk percentage ${risk}% is outside recommended range (0.1-5%)`)
    }
  }

  /**
   * Validate signal age
   */
  private validateSignalAge(signalTime: string, errors: string[], warnings: string[]): void {
    const signalDate = new Date(signalTime)
    const now = new Date()
    const ageHours = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60)

    if (ageHours > this.MAX_SIGNAL_AGE_HOURS) {
      errors.push(`Signal is too old: ${ageHours.toFixed(1)} hours. Maximum age: ${this.MAX_SIGNAL_AGE_HOURS} hours`)
    } else if (ageHours > 1) {
      warnings.push(`Signal age: ${ageHours.toFixed(1)} hours. Consider market conditions`)
    }
  }

  /**
   * Validate signal quality indicators
   */
  private validateSignalQuality(signal: any, errors: string[], warnings: string[]): void {
    // Check for duplicate processing
    if (this.processedSignals.has(signal.id)) {
      errors.push(`Signal ID ${signal.id} has already been processed`)
      return
    }

    // Add to processed set
    this.processedSignals.add(signal.id)

    // Check confidence score if available
    if (signal.confidence_score !== undefined) {
      const confidence = parseFloat(signal.confidence_score)
      if (confidence < this.MIN_CONFIDENCE_SCORE) {
        warnings.push(`Low confidence score: ${confidence}. Minimum recommended: ${this.MIN_CONFIDENCE_SCORE}`)
      }
    }

    // Check signal quality if available
    if (signal.signal_quality && signal.signal_quality === 'low') {
      warnings.push('Signal marked as low quality. Verify before execution')
    }
  }

  /**
   * Process trade signal with enhanced logic
   */
  async processTradeSignal(signal: EnhancedTradeSignal): Promise<SignalProcessingResult> {
    try {
      console.log("Processing enhanced trade signal:", signal.id)

      // Validate signal
      const validation = this.validateTradeSignal(signal)
      if (!validation.isValid) {
        return {
          success: false,
          error: `Signal validation failed: ${validation.errors.join(', ')}`,
          warnings: validation.warnings
        }
      }

      // Normalize signal data
      const normalizedSignal = this.normalizeSignal(signal)

      // Check for existing session
      const existingSession = await this.findSessionByTradeId(normalizedSignal.id)
      
      let sessionId: string
      let currentNode: string
      let initialAmount: number
      let isNewSession = false

      if (existingSession) {
        // Continue existing session
        sessionId = existingSession.session_id
        currentNode = existingSession.current_node
        initialAmount = existingSession.initial_amount
        console.log(`Continuing existing session: ${sessionId} at node: ${currentNode}`)
        
        // Update balance if needed
        await tradingPlatform.updateSessionBalance(sessionId)
      } else {
        // Create new session
        sessionId = `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        currentNode = "Start"
        initialAmount = await tradingPlatform.getAccountBalance()
        isNewSession = true
        
        console.log(`Creating new session: ${sessionId} with balance: $${initialAmount.toLocaleString()}`)
        
        // Create session with exception handling
        await this.createNewSession(sessionId, normalizedSignal, currentNode, initialAmount)
      }

      // Calculate trade amount
      const node = decisionTree[currentNode]
      if (!node) {
        throw new Error(`Invalid decision tree node: ${currentNode}`)
      }

      const tradeAmount = calculateValue(node.value, initialAmount)
      
      // Create processed signal
      const processedSignal: ProcessedTradeSignal = {
        session_id: sessionId,
        trade_id: normalizedSignal.id,
        symbol: normalizedSignal.symbol,
        action: normalizedSignal.action,
        entry: normalizedSignal.entry,
        target: normalizedSignal.target,
        stop: normalizedSignal.stop,
        trade_amount: tradeAmount,
        current_node: currentNode,
        timeframe: normalizedSignal.timeframe,
        time: normalizedSignal.time,
        rr: normalizedSignal.rr,
        risk: normalizedSignal.risk,
        initial_amount: initialAmount,
        node_stake_percentage: node.value
      }

      // Save signal with exception handling
      await this.saveTradeSignal(processedSignal)

      console.log("Enhanced trade signal processed successfully:", {
        sessionId,
        tradeId: normalizedSignal.id,
        symbol: normalizedSignal.symbol,
        tradeAmount,
        currentNode,
        warnings: validation.warnings
      })

      return {
        success: true,
        data: processedSignal,
        warnings: validation.warnings,
        sessionId,
        isNewSession
      }

    } catch (error) {
      console.error("Error processing enhanced trade signal:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error processing trade signal"
      }
    }
  }

  /**
   * Normalize signal data for consistent processing
   */
  private normalizeSignal(signal: EnhancedTradeSignal): EnhancedTradeSignal {
    const normalized = { ...signal }
    
    // Normalize action
    normalized.action = signal.action.toLowerCase()
    
    // Normalize timeframe
    const timeframeMap: { [key: string]: string } = {
      '1': '1m', '5': '5m', '15': '15m', '30': '30m',
      '60': '1h', '240': '4h', '1440': '1d', '10080': '1w'
    }
    
    if (timeframeMap[signal.timeframe]) {
      normalized.timeframe = timeframeMap[signal.timeframe]
    }
    
    return normalized
  }

  /**
   * Find existing session by trade ID
   */
  private async findSessionByTradeId(tradeId: string): Promise<any | null> {
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

  /**
   * Create new session with enhanced error handling
   */
  private async createNewSession(sessionId: string, signal: EnhancedTradeSignal, currentNode: string, initialAmount: number): Promise<void> {
    try {
      if (!sql) {
        throw new Error("Database not available")
      }

      const sessionName = `Session_${signal.symbol}_${new Date().toISOString().split('T')[0]}`
      
      await sql`
        INSERT INTO sessions (
          session_id, session_name, symbol, current_node, initial_amount, 
          final_total, is_completed, created_at, last_action_timestamp, 
          path_summary, updated_at
        ) VALUES (
          ${sessionId}, ${sessionName}, ${signal.symbol}, ${currentNode}, ${initialAmount},
          ${initialAmount}, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          ${currentNode}, CURRENT_TIMESTAMP
        )
      `

      console.log(`Session created: ${sessionId}`)
    } catch (error) {
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
      
      if (!cacheResult.cached) {
        throw new Error(`Failed to create session: ${cacheResult.message}`)
      }
    }
  }

  /**
   * Save trade signal with enhanced error handling
   */
  private async saveTradeSignal(processedSignal: ProcessedTradeSignal): Promise<void> {
    try {
      if (!sql) {
        throw new Error("Database not available")
      }

      await sql`
        INSERT INTO trade_signals (
          session_id, trade_id, symbol, action, entry, target, stop,
          trade_amount, timeframe, time, rr, risk, created_at, updated_at
        ) VALUES (
          ${processedSignal.session_id}, ${processedSignal.trade_id}, ${processedSignal.symbol},
          ${processedSignal.action}, ${processedSignal.entry}, ${processedSignal.target}, ${processedSignal.stop},
          ${processedSignal.trade_amount}, ${processedSignal.timeframe}, ${processedSignal.time},
          ${processedSignal.rr}, ${processedSignal.risk}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `

      console.log(`Trade signal saved: ${processedSignal.trade_id}`)
    } catch (error) {
      console.error("Database error during signal save:", error)
      
      const cachedSessionData: CachedSessionData = {
        sessionId: processedSignal.session_id,
        signal: processedSignal as any,
        currentNode: processedSignal.current_node,
        initialAmount: processedSignal.initial_amount,
        timestamp: Date.now(),
        retryCount: 0
      }
      
      const cacheResult = await exceptionHandler.handleDatabaseFailure(cachedSessionData)
      
      if (!cacheResult.cached) {
        throw new Error(`Failed to save signal: ${cacheResult.message}`)
      }
    }
  }

  /**
   * Clean up old processed signals
   */
  cleanupOldSignals(): void {
    const cutoffTime = Date.now() - (this.MAX_SIGNAL_AGE_HOURS * 60 * 60 * 1000)
    for (const signalId of this.processedSignals) {
      // This is a simplified cleanup - in production you'd want more sophisticated logic
      if (signalId.includes(Date.now().toString().substr(0, 8))) {
        this.processedSignals.delete(signalId)
      }
    }
  }
}

// Export singleton instance
export const signalProcessor = new SignalProcessor() 