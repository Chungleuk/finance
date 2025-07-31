import { type NextRequest, NextResponse } from "next/server"
import { tradingPlatform } from "@/lib/trading-platform-service"

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/trading/balance - Fetching account balance")

    const balance = await tradingPlatform.getAccountBalance()
    
    return NextResponse.json({
      success: true,
      data: {
        balance,
        formatted_balance: `$${balance.toLocaleString()}`,
        currency: "USD",
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching account balance:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch account balance"
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/trading/balance - Updating session balances")

    const body = await request.text()
    let data: any
    
    try {
      data = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { session_id } = data

    if (!session_id) {
      return NextResponse.json({ success: false, error: "session_id is required" }, { status: 400 })
    }

    // Update the specific session balance
    await tradingPlatform.updateSessionBalance(session_id)
    
    return NextResponse.json({
      success: true,
      message: "Session balance updated successfully",
      session_id
    })
  } catch (error) {
    console.error("Error updating session balance:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update session balance"
      },
      { status: 500 }
    )
  }
} 