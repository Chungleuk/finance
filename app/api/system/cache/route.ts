import { type NextRequest, NextResponse } from "next/server"
import { exceptionHandler } from "@/lib/exception-handler"

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/system/cache - Getting cached sessions status")

    const status = exceptionHandler.getCachedSessionsStatus()
    
    return NextResponse.json({
      success: true,
      data: {
        cached_sessions: status.total,
        expired_sessions: status.expired,
        retry_counts: status.retryCounts,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error getting cache status:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get cache status"
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/system/cache - Synchronizing cached sessions")

    const body = await request.text()
    let data: any
    
    try {
      data = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { action } = data

    if (!action) {
      return NextResponse.json({ success: false, error: "action is required" }, { status: 400 })
    }

    switch (action) {
      case 'sync':
        const syncResult = await exceptionHandler.synchronizeCachedSessions()
        return NextResponse.json({
          success: syncResult.success,
          message: `Synchronization complete: ${syncResult.synced} synced, ${syncResult.failed} failed`,
          data: {
            synced: syncResult.synced,
            failed: syncResult.failed,
            details: syncResult.details,
            timestamp: new Date().toISOString()
          }
        })

      case 'clear':
        // This would clear all cached sessions (implement if needed)
        return NextResponse.json({
          success: true,
          message: "Cache clear action received (not implemented yet)",
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({ 
          success: false, 
          error: `Unknown action: ${action}. Valid actions: sync, clear` 
        }, { status: 400 })
    }

  } catch (error) {
    console.error("Error in cache management:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to manage cache"
      },
      { status: 500 }
    )
  }
} 