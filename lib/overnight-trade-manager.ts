import { sql } from "./db"

export interface OvernightTrade {
  id: string
  trade_id: string
  session_id: string
  symbol: string
  entry_price: number
  target_price: number
  stop_price: number
  trade_amount: number
  current_node: string
  previous_node?: string
  entry_time: Date
  overnight_close_enabled: boolean
  status: 'active' | 'closed' | 'expired'
  close_reason?: string
  close_time?: Date
  profit_loss?: number
  created_at: Date
  updated_at: Date
}

export interface TradeStatus {
  trade_id: string
  status: 'active' | 'closed' | 'expired'
  overnightCloseEnabled: boolean
  entry_time: Date
  symbol: string
  current_node: string
}

export class OvernightTradeManager {
  private activeTrades: Map<string, TradeStatus> = new Map()

  /**
   * Register a trade for overnight monitoring
   */
  async registerTrade(
    tradeId: string,
    sessionId: string,
    symbol: string,
    entryPrice: number,
    targetPrice: number,
    stopPrice: number,
    tradeAmount: number,
    currentNode: string,
    overnightCloseEnabled: boolean = true,
    previousNode?: string
  ): Promise<boolean> {
    try {
      console.log(`Registering trade ${tradeId} for overnight monitoring`)

      if (!sql) {
        console.warn("Database not available, storing trade in memory only")
        this.activeTrades.set(tradeId, {
          trade_id: tradeId,
          status: 'active',
          overnightCloseEnabled,
          entry_time: new Date(),
          symbol,
          current_node: currentNode
        })
        return true
      }

      // Store in database
      await sql`
        INSERT INTO overnight_trades (
          trade_id, session_id, symbol, entry_price, target_price, stop_price,
          trade_amount, current_node, previous_node, entry_time, overnight_close_enabled,
          status, created_at, updated_at
        ) VALUES (
          ${tradeId}, ${sessionId}, ${symbol}, ${entryPrice}, ${targetPrice}, ${stopPrice},
          ${tradeAmount}, ${currentNode}, ${previousNode || null}, ${new Date().toISOString()},
          ${overnightCloseEnabled}, ${'active'}, ${new Date().toISOString()}, ${new Date().toISOString()}
        )
        ON CONFLICT (trade_id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          symbol = EXCLUDED.symbol,
          entry_price = EXCLUDED.entry_price,
          target_price = EXCLUDED.target_price,
          stop_price = EXCLUDED.stop_price,
          trade_amount = EXCLUDED.trade_amount,
          current_node = EXCLUDED.current_node,
          previous_node = EXCLUDED.previous_node,
          overnight_close_enabled = EXCLUDED.overnight_close_enabled,
          updated_at = CURRENT_TIMESTAMP
      `

      // Store in memory for quick access
      this.activeTrades.set(tradeId, {
        trade_id: tradeId,
        status: 'active',
        overnightCloseEnabled,
        entry_time: new Date(),
        symbol,
        current_node: currentNode
      })

      console.log(`Trade ${tradeId} registered successfully`)
      return true

    } catch (error) {
      console.error(`Error registering trade ${tradeId}:`, error)
      return false
    }
  }

  /**
   * Get all active trades
   */
  getActiveTrades(): TradeStatus[] {
    return Array.from(this.activeTrades.values()).filter(trade => trade.status === 'active')
  }

  /**
   * Get trade status by ID
   */
  getTradeStatus(tradeId: string): TradeStatus | null {
    return this.activeTrades.get(tradeId) || null
  }

  /**
   * Manually close a trade
   */
  async manualClose(tradeId: string, reason: string = 'manual_close'): Promise<boolean> {
    try {
      console.log(`Manually closing trade ${tradeId}`)

      const trade = this.activeTrades.get(tradeId)
      if (!trade) {
        console.warn(`Trade ${tradeId} not found in active trades`)
        return false
      }

      // Update in database if available
      if (sql) {
        await sql`
          UPDATE overnight_trades 
          SET status = 'closed',
              close_reason = ${reason},
              close_time = ${new Date().toISOString()},
              updated_at = CURRENT_TIMESTAMP
          WHERE trade_id = ${tradeId}
        `
      }

      // Update in memory
      trade.status = 'closed'
      this.activeTrades.set(tradeId, trade)

      console.log(`Trade ${tradeId} closed successfully`)
      return true

    } catch (error) {
      console.error(`Error closing trade ${tradeId}:`, error)
      return false
    }
  }

  /**
   * Check for trades that need overnight closing
   */
  async checkOvernightTrades(): Promise<void> {
    try {
      const now = new Date()
      const activeTrades = this.getActiveTrades()

      for (const trade of activeTrades) {
        if (trade.overnightCloseEnabled) {
          // Check if trade has been open for more than 16 hours (market close approaching)
          const hoursOpen = (now.getTime() - trade.entry_time.getTime()) / (1000 * 60 * 60)
          
          if (hoursOpen > 16) {
            console.log(`Trade ${trade.trade_id} approaching overnight, considering close`)
            // Here you would implement the actual closing logic
            // For now, just log the action
          }
        }
      }

    } catch (error) {
      console.error("Error checking overnight trades:", error)
    }
  }

  /**
   * Load active trades from database on startup
   */
  async loadActiveTrades(): Promise<void> {
    try {
      if (!sql) {
        console.log("Database not available, skipping trade loading")
        return
      }

      const trades = await sql`
        SELECT trade_id, symbol, current_node, entry_time, overnight_close_enabled, status
        FROM overnight_trades
        WHERE status = 'active'
      `

      for (const trade of trades) {
        this.activeTrades.set(trade.trade_id, {
          trade_id: trade.trade_id,
          status: trade.status,
          overnightCloseEnabled: trade.overnight_close_enabled,
          entry_time: new Date(trade.entry_time),
          symbol: trade.symbol,
          current_node: trade.current_node
        })
      }

      console.log(`Loaded ${trades.length} active trades from database`)

    } catch (error) {
      console.error("Error loading active trades:", error)
    }
  }
}

// Export singleton instance
export const overnightTradeManager = new OvernightTradeManager()

// Load active trades on module initialization
overnightTradeManager.loadActiveTrades().catch(error => {
  console.error("Failed to load active trades on startup:", error)
})