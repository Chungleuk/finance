import { type NextRequest, NextResponse } from "next/server"
import { saveSession, getSessionHistory } from "@/lib/session-service"
import { sql } from "@/lib/db"
import type { SessionData } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/sessions - Starting")

    if (!sql) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not configured. Please set up your DATABASE_URL environment variable.",
        },
        { status: 503 },
      )
    }

    const body = await request.text()
    console.log("Request body length:", body.length)

    let sessionData: any
    try {
      sessionData = JSON.parse(body)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    // Convert date strings back to Date objects
    const processedSessionData: SessionData = {
      ...sessionData,
      sessionStartTime: new Date(sessionData.sessionStartTime),
      lastActionTimestamp: new Date(sessionData.lastActionTimestamp),
      pathValues:
        sessionData.pathValues?.map((pv: any) => ({
          ...pv,
          timestamp: new Date(pv.timestamp),
        })) || [],
    }

    console.log("Processed session data:", {
      sessionId: processedSessionData.sessionId,
      sessionName: processedSessionData.sessionName,
      isCompleted: processedSessionData.isCompleted,
      pathValuesLength: processedSessionData.pathValues?.length || 0,
    })

    await saveSession(processedSessionData)
    console.log("Session saved successfully")

    return NextResponse.json({ success: true, message: "Session saved successfully" })
  } catch (error) {
    console.error("Error in POST /api/sessions:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save session",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const includeIncomplete = searchParams.get("includeIncomplete") === "true"
    const searchTerm = searchParams.get("search") || ""
    const dateFrom = searchParams.get("dateFrom") || ""
    const dateTo = searchParams.get("dateTo") || ""
    const resultFilter = searchParams.get("result") || ""

    console.log("GET /api/sessions - filters:", {
      limit,
      includeIncomplete,
      searchTerm,
      dateFrom,
      dateTo,
      resultFilter,
    })

    if (!sql) {
      console.warn("Database not available, returning empty array")
      return NextResponse.json({
        success: true,
        data: [],
        message: "Database not configured - please set up DATABASE_URL",
      })
    }

    const sessions = await getSessionHistory(limit, includeIncomplete, searchTerm, dateFrom, dateTo, resultFilter)
    console.log("Retrieved sessions:", sessions.length)

    return NextResponse.json({ success: true, data: sessions })
  } catch (error) {
    console.error("Error in GET /api/sessions:", error)
    return NextResponse.json(
      {
        success: true,
        data: [],
        error: error instanceof Error ? error.message : "Failed to get sessions",
        message: "Returning empty data due to error",
      },
      { status: 200 }, // Return 200 with empty data instead of 500
    )
  }
}
