import { type NextRequest, NextResponse } from "next/server"
import { alertService } from "@/lib/alert-service"

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/dashboard/alerts - Fetching active alerts")

    const activeAlerts = await alertService.getActiveAlerts()
    const systemHealth = alertService.getSystemHealth()
    
    return NextResponse.json({
      success: true,
      data: {
        active_alerts: activeAlerts,
        system_health: systemHealth,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching alerts:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch alerts"
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/dashboard/alerts - Acknowledging alert")

    const body = await request.text()
    let data: any
    
    try {
      data = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { alert_id, acknowledged_by } = data

    if (!alert_id || !acknowledged_by) {
      return NextResponse.json({ 
        success: false, 
        error: "alert_id and acknowledged_by are required" 
      }, { status: 400 })
    }

    const success = await alertService.acknowledgeAlert(alert_id, acknowledged_by)
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: "Alert acknowledged successfully",
        alert_id,
        acknowledged_by
      })
    } else {
      return NextResponse.json({
        success: false,
        error: "Failed to acknowledge alert"
      }, { status: 404 })
    }

  } catch (error) {
    console.error("Error acknowledging alert:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to acknowledge alert"
      },
      { status: 500 }
    )
  }
} 