import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { brokerCostService } from "@/lib/broker-cost-service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tradeId = searchParams.get('trade_id')
    const sessionId = searchParams.get('session_id')
    const symbol = searchParams.get('symbol')

    if (!sql) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      )
    }

    let query = sql`
      SELECT 
        tc.id,
        tc.trade_id,
        tc.session_id,
        tc.commission,
        tc.spread_cost,
        tc.swap_cost,
        tc.total_costs,
        tc.nominal_amount,
        tc.adjusted_amount,
        tc.cost_breakdown,
        tc.created_at,
        tc.updated_at,
        ts.symbol,
        ts.action,
        ts.entry_price,
        ts.target_price,
        ts.stop_price
      FROM trade_costs tc
      INNER JOIN trade_signals ts ON tc.trade_id = ts.trade_id
      WHERE 1=1
    `

    const params: any[] = []

    if (tradeId) {
      query = sql`${query} AND tc.trade_id = ${tradeId}`
    }

    if (sessionId) {
      query = sql`${query} AND tc.session_id = ${sessionId}`
    }

    if (symbol) {
      query = sql`${query} AND ts.symbol = ${symbol}`
    }

    query = sql`${query} ORDER BY tc.created_at DESC LIMIT 100`

    const results = await query

    // Calculate summary statistics
    const summary = {
      totalTrades: results.length,
      totalCosts: results.reduce((sum: number, row: any) => sum + Number(row.total_costs), 0),
      averageCosts: results.length > 0 ? results.reduce((sum: number, row: any) => sum + Number(row.total_costs), 0) / results.length : 0,
      totalCommission: results.reduce((sum: number, row: any) => sum + Number(row.commission), 0),
      totalSpreadCost: results.reduce((sum: number, row: any) => sum + Number(row.spread_cost), 0),
      totalSwapCost: results.reduce((sum: number, row: any) => sum + Number(row.swap_cost), 0),
      averageCommission: results.length > 0 ? results.reduce((sum: number, row: any) => sum + Number(row.commission), 0) / results.length : 0,
      averageSpreadCost: results.length > 0 ? results.reduce((sum: number, row: any) => sum + Number(row.spread_cost), 0) / results.length : 0,
      averageSwapCost: results.length > 0 ? results.reduce((sum: number, row: any) => sum + Number(row.swap_cost), 0) / results.length : 0
    }

    return NextResponse.json({
      success: true,
      data: {
        costs: results,
        summary,
        brokerConfig: brokerCostService.getConfig()
      }
    })

  } catch (error) {
    console.error("Error fetching trade costs:", error)
    return NextResponse.json(
      { error: "Failed to fetch trade costs" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, entryPrice, targetPrice, stopPrice, nominalAmount } = body

    if (!symbol || !entryPrice || !targetPrice || !stopPrice || !nominalAmount) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      )
    }

    // Calculate costs for the given parameters
    const costResult = await brokerCostService.calculateTradeCosts(
      symbol,
      nominalAmount,
      Number(entryPrice),
      Number(targetPrice),
      Number(stopPrice),
      nominalAmount // Target net profit equals nominal amount
    )

    return NextResponse.json({
      success: true,
      data: costResult
    })

  } catch (error) {
    console.error("Error calculating trade costs:", error)
    return NextResponse.json(
      { error: "Failed to calculate trade costs" },
      { status: 500 }
    )
  }
} 