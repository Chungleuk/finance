import { sql } from '@/lib/db'
import { 
  CachedSessionData, 
  PartialFillResult, 
  NodeJumpValidation, 
  ExceptionHandlingConfig,
  TradeSignal 
} from './types'

export class ExceptionHandler {
  private config: ExceptionHandlingConfig
  private cachedSessions: Map<string, CachedSessionData> = new Map()
  private readonly CACHE_FILE = 'cached_sessions.json'

  constructor(config: Partial<ExceptionHandlingConfig> = {}) {
    this.config = {
      maxRetryCount: 3,
      cacheTimeoutMs: 60 * 60 * 1000, // 1 hour
      partialFillThreshold: 0.1, // 10% threshold for partial fill handling
      nodeJumpValidationEnabled: true,
      rollbackConfirmationRequired: true,
      ...config
    }
    
    this.loadCachedSessions()
  }

  /**
   * Handle TradingView signal validation errors
   */
  handleSignalValidationError(signal: any, errors: string[]): { success: boolean; error: string; details: any } {
    console.error('🚨 Signal Validation Error:', {
      signal: JSON.stringify(signal, null, 2),
      errors,
      timestamp: new Date().toISOString()
    })

    // Log the faulty signal content for debugging
    const errorDetails = {
      signal_content: signal,
      validation_errors: errors,
      timestamp: new Date().toISOString(),
      user_agent: 'TradingView-Webhook'
    }

    // Return 400 error response
    return {
      success: false,
      error: `Signal validation failed: ${errors.join(', ')}`,
      details: errorDetails
    }
  }

  /**
   * Handle partial fill scenarios
   */
  async handlePartialFill(
    sessionId: string, 
    originalAmount: number, 
    filledAmount: number
  ): Promise<PartialFillResult> {
    console.log('⚠️ Partial Fill Detected:', {
      sessionId,
      originalAmount,
      filledAmount,
      fillPercentage: ((filledAmount / originalAmount) * 100).toFixed(2) + '%'
    })

    const fillPercentage = filledAmount / originalAmount
    const remainingAmount = originalAmount - filledAmount

    const partialFillResult: PartialFillResult = {
      originalAmount,
      filledAmount,
      fillPercentage,
      remainingAmount
    }

    // Update the trade amount in database to reflect actual filled amount
    try {
      if (sql) {
        await sql`
          UPDATE session_steps 
          SET stake_value = ${filledAmount},
              note = ${`Partial fill: ${(fillPercentage * 100).toFixed(2)}% filled. Original: $${originalAmount}, Filled: $${filledAmount}`}
          WHERE session_id = ${sessionId} 
          AND step_type = 'EXECUTE' 
          AND step_number = (
            SELECT MAX(step_number) 
            FROM session_steps 
            WHERE session_id = ${sessionId} 
            AND step_type = 'EXECUTE'
          )
        `
        console.log('✅ Partial fill amount updated in database')
      }
    } catch (error) {
      console.error('❌ Failed to update partial fill amount:', error)
    }

    // Continue with decision tree progression based on actual filled amount
    console.log('📊 Proceeding with decision tree based on filled amount')
    
    return partialFillResult
  }

  /**
   * Validate decision tree node jumps
   */
  validateNodeJump(
    currentSessionNode: string, 
    proposedNode: string
  ): NodeJumpValidation {
    if (!this.config.nodeJumpValidationEnabled) {
      return { isValid: true, requiresRollback: false }
    }

    console.log('🔍 Validating node jump:', {
      from: currentSessionNode,
      to: proposedNode
    })

    // Define valid node progression paths
    const validProgressions: Record<string, string[]> = {
      'Start': ['Level 1'],
      'Level 1': ['Level 2', 'Level 3'],
      'Level 2': ['Level 3', 'Level 4'],
      'Level 3': ['Level 4', 'Level 5'],
      'Level 4': ['Level 5', 'Level 6'],
      'Level 5': ['Level 6', 'Level 7'],
      'Level 6': ['Level 7', 'Level 8'],
      'Level 7': ['Level 8', 'Level 9'],
      'Level 8': ['Level 9', 'Level 10'],
      'Level 9': ['Level 10', 'Complete'],
      'Level 10': ['Complete']
    }

    const validNextNodes = validProgressions[currentSessionNode] || []
    const isValid = validNextNodes.includes(proposedNode)

    if (!isValid) {
      console.warn('⚠️ Invalid node jump detected:', {
        current: currentSessionNode,
        proposed: proposedNode,
        validOptions: validNextNodes
      })

      // Determine rollback target (previous valid node)
      const rollbackToNode = this.determineRollbackNode(currentSessionNode, proposedNode)

      return {
        isValid: false,
        expectedNode: validNextNodes[0], // First valid option
        actualNode: proposedNode,
        requiresRollback: true,
        rollbackToNode
      }
    }

    return {
      isValid: true,
      requiresRollback: false
    }
  }

  /**
   * Execute rollback mechanism
   */
  async executeRollback(
    sessionId: string, 
    rollbackToNode: string, 
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    console.log('🔄 Executing rollback:', {
      sessionId,
      rollbackToNode,
      reason
    })

    try {
      if (!sql) {
        throw new Error("Database not available")
      }

      // Update session to rollback node
      await sql`
        UPDATE sessions 
        SET current_node = ${rollbackToNode},
            updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ${sessionId}
      `

      // Add rollback step to session_steps
      await sql`
        INSERT INTO session_steps (
          session_id, step_number, node_name, action, 
          stake_value, step_type, execution_status, note
        ) VALUES (
          ${sessionId},
          (SELECT COALESCE(MAX(step_number), 0) + 1 FROM session_steps WHERE session_id = ${sessionId}),
          ${rollbackToNode},
          'ROLLBACK',
          0,
          'DECISION',
          'COMPLETED',
          ${`Rollback executed: ${reason}`}
        )
      `

      console.log('✅ Rollback executed successfully')
      
      return {
        success: true,
        message: `Rollback to ${rollbackToNode} completed. Manual confirmation required before proceeding.`
      }

    } catch (error) {
      console.error('❌ Rollback failed:', error)
      return {
        success: false,
        message: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Handle database connection failures with local caching
   */
  async handleDatabaseFailure(
    sessionData: CachedSessionData
  ): Promise<{ success: boolean; cached: boolean; message: string }> {
    console.log('💾 Database connection failed, caching session data locally')

    // Check if session is already cached
    const existingCache = this.cachedSessions.get(sessionData.sessionId)
    
    if (existingCache) {
      existingCache.retryCount++
      existingCache.timestamp = Date.now()
    } else {
      sessionData.retryCount = 1
      sessionData.timestamp = Date.now()
      this.cachedSessions.set(sessionData.sessionId, sessionData)
    }

    // Save to file for persistence
    this.saveCachedSessions()

    // Check if we should retry
    const currentCache = this.cachedSessions.get(sessionData.sessionId)!
    if (currentCache.retryCount <= this.config.maxRetryCount) {
      return {
        success: false,
        cached: true,
        message: `Session cached locally. Retry ${currentCache.retryCount}/${this.config.maxRetryCount}`
      }
    } else {
      return {
        success: false,
        cached: true,
        message: `Session cached locally. Max retries exceeded. Manual intervention required.`
      }
    }
  }

  /**
   * Synchronize cached sessions when database is restored
   */
  async synchronizeCachedSessions(): Promise<{ 
    success: boolean; 
    synced: number; 
    failed: number; 
    details: string[] 
  }> {
    console.log('🔄 Synchronizing cached sessions...')

    const results = {
      success: true,
      synced: 0,
      failed: 0,
      details: [] as string[]
    }

    if (!sql) {
      results.success = false
      results.details.push("Database connection not available")
      return results
    }

    const currentTime = Date.now()
    const expiredSessions: string[] = []

    for (const [sessionId, cachedData] of this.cachedSessions.entries()) {
      // Check if cache has expired
      if (currentTime - cachedData.timestamp > this.config.cacheTimeoutMs) {
        expiredSessions.push(sessionId)
        results.details.push(`Session ${sessionId} expired and will be discarded`)
        continue
      }

      try {
        // Check if session already exists in database
        const existingSession = await sql`
          SELECT session_id FROM sessions WHERE session_id = ${sessionId}
        `

        if (existingSession.length === 0) {
          // Create new session
          await sql`
            INSERT INTO sessions (
              session_id, trade_id, symbol, action, entry_price, 
              target_price, stop_price, current_node, initial_amount, 
              created_at, updated_at
            ) VALUES (
              ${sessionId},
              ${cachedData.signal.id},
              ${cachedData.signal.symbol},
              ${cachedData.signal.action},
              ${parseFloat(cachedData.signal.entry)},
              ${parseFloat(cachedData.signal.target)},
              ${parseFloat(cachedData.signal.stop)},
              ${cachedData.currentNode},
              ${cachedData.initialAmount},
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `
          results.synced++
          results.details.push(`Session ${sessionId} created successfully`)
        } else {
          // Update existing session
          await sql`
            UPDATE sessions 
            SET current_node = ${cachedData.currentNode},
                initial_amount = ${cachedData.initialAmount},
                updated_at = CURRENT_TIMESTAMP
            WHERE session_id = ${sessionId}
          `
          results.synced++
          results.details.push(`Session ${sessionId} updated successfully`)
        }

        // Remove from cache after successful sync
        this.cachedSessions.delete(sessionId)

      } catch (error) {
        results.failed++
        results.details.push(`Session ${sessionId} sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Remove expired sessions
    expiredSessions.forEach(sessionId => this.cachedSessions.delete(sessionId))

    // Save updated cache
    this.saveCachedSessions()

    console.log(`✅ Synchronization complete: ${results.synced} synced, ${results.failed} failed`)
    return results
  }

  /**
   * Get cached sessions status
   */
  getCachedSessionsStatus(): {
    total: number
    expired: number
    retryCounts: Record<string, number>
  } {
    const currentTime = Date.now()
    let expired = 0

    const retryCounts: Record<string, number> = {}
    
    for (const [sessionId, cachedData] of this.cachedSessions.entries()) {
      retryCounts[sessionId] = cachedData.retryCount
      
      if (currentTime - cachedData.timestamp > this.config.cacheTimeoutMs) {
        expired++
      }
    }

    return {
      total: this.cachedSessions.size,
      expired,
      retryCounts
    }
  }

  // Private helper methods

  private determineRollbackNode(currentNode: string, invalidNode: string): string {
    // Simple rollback logic - go back one level
    const nodeLevels = ['Start', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Level 9', 'Level 10']
    const currentIndex = nodeLevels.indexOf(currentNode)
    
    if (currentIndex > 0) {
      return nodeLevels[currentIndex - 1]
    }
    
    return 'Start' // Default fallback
  }

  private loadCachedSessions(): void {
    try {
      // In a real implementation, you might load from file system
      // For now, we'll keep it in memory
      console.log('📂 Loading cached sessions...')
    } catch (error) {
      console.log('No cached sessions found or error loading cache')
    }
  }

  private saveCachedSessions(): void {
    try {
      // In a real implementation, you would save to file system
      // For now, we'll keep it in memory
      console.log(`💾 Cached ${this.cachedSessions.size} sessions`)
    } catch (error) {
      console.error('Failed to save cached sessions:', error)
    }
  }
}

// Export singleton instance
export const exceptionHandler = new ExceptionHandler() 