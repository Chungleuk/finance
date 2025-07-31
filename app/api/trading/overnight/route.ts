import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { overnightTradeManager } from "@/lib/overnight-trade-manager"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tradeId = searchParams.get('trade_id')
    const sessionId = searchParams.get('session_id')
    const status = searchParams.get('status')

    if (!sql) {
      return NextResponse.json(
        { success: false, error: "Database not configured" },
        { status: 503 }
      )
    }

    let query = sql`
      SELECT 
        id,
        trade_id,
        session_id,
        symbol,
        entry_price,
        target_price,
        stop_price,
        trade_amount,
        current_node,
        previous_node,
        entry_time,
        overnight_close_enabled,
        status,
        close_reason,
        close_time,
        profit_loss,
        created_at,
        updated_at
      FROM overnight_trades
      WHERE 1=1
    `

    const params: any[] = []
    let paramIndex = 1

    if (tradeId) {
      query = sql`${query} AND trade_id = ${tradeId}`
    }

    if (sessionId) {
      query = sql`${query} AND session_id = ${sessionId}`
    }

    if (status) {
      query = sql`${query} AND status = ${status}`
    }

    query = sql`${query} ORDER BY created_at DESC`

    const trades = await query

    // Get active trades from memory as well
    const activeTrades = overnightTradeManager.getActiveTrades()

    return NextResponse.json({
      success: true,
      data: {
        database_trades: trades,
        active_trades: activeTrades,
        total_count: trades.length,
        active_count: activeTrades.length
      }
    })

  } catch (error) {
    console.error("Error fetching overnight trades:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch overnight trades" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, trade_id, overnight_close_enabled } = body

    if (!trade_id) {
      return NextResponse.json(
        { success: false, error: "trade_id is required" },
        { status: 400 }
      )
    }

    switch (action) {
      case 'close':
        // Manually close a trade
        const closeResult = await overnightTradeManager.manualClose(trade_id)
        if (closeResult) {
          return NextResponse.json({
            success: true,
            message: `Trade ${trade_id} closed successfully`,
            data: { trade_id, action: 'closed' }
          })
        } else {
          return NextResponse.json(
            { success: false, error: `Trade ${trade_id} not found or already closed` },
            { status: 404 }
          )
        }

      case 'update_settings':
        // Update overnight close settings
        if (typeof overnight_close_enabled !== 'boolean') {
          return NextResponse.json(
            { success: false, error: "overnight_close_enabled must be a boolean" },
            { status: 400 }
          )
        }

        if (!sql) {
          return NextResponse.json(
            { success: false, error: "Database not configured" },
            { status: 503 }
          )
        }

        await sql`
          UPDATE overnight_trades 
          SET overnight_close_enabled = ${overnight_close_enabled},
              updated_at = CURRENT_TIMESTAMP
          WHERE trade_id = ${trade_id}
        `

        // Update in memory if trade is active
        const tradeStatus = overnightTradeManager.getTradeStatus(trade_id)
        if (tradeStatus) {
          tradeStatus.overnightCloseEnabled = overnight_close_enabled
        }

        return NextResponse.json({
          success: true,
          message: `Overnight close settings updated for trade ${trade_id}`,
          data: { trade_id, overnight_close_enabled }
        })

      default:
        return NextResponse.json(
          { success: false, error: `Invalid action: ${action}. Valid actions: close, update_settings` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error("Error processing overnight trade action:", error)
    return NextResponse.json(
      { success: false, error: "Failed to process overnight trade action" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tradeId = searchParams.get('trade_id')

    if (!tradeId) {
      return NextResponse.json(
        { success: false, error: "trade_id is required" },
        { status: 400 }
      )
    }

    if (!sql) {
      return NextResponse.json(
        { success: false, error: "Database not configured" },
        { status: 503 }
      )
    }

    // Delete from database
    const result = await sql`
      DELETE FROM overnight_trades 
      WHERE trade_id = ${tradeId}
    `

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: `Trade ${tradeId} not found` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Trade ${tradeId} removed from overnight monitoring`,
      data: { trade_id: tradeId, deleted: true }
    })

  } catch (error) {
    console.error("Error deleting overnight trade:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete overnight trade" },
      { status: 500 }
    )
  }
} 