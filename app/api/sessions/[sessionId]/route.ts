import { type NextRequest, NextResponse } from "next/server"
import { deleteSession, updateSessionNotes, updateSessionName } from "@/lib/session-service"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    if (!sql) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 })
    }

    // Get session data
    const sessionResult = await sql`
      SELECT * FROM sessions
      WHERE session_id = ${params.sessionId}
      LIMIT 1
    `

    if (sessionResult.length === 0) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 })
    }

    const session = sessionResult[0]

    // Get session steps
    const stepsResult = await sql`
      SELECT * FROM session_steps
      WHERE session_id = ${params.sessionId}
      ORDER BY step_number ASC
    `

    const sessionData = {
      ...session,
      steps: stepsResult,
    }

    return NextResponse.json({ success: true, data: sessionData })
  } catch (error) {
    console.error("Error in GET /api/sessions/[sessionId]:", error)
    return NextResponse.json({ success: false, error: "Failed to get session" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    await deleteSession(params.sessionId)
    return NextResponse.json({ success: true, message: "Session deleted successfully" })
  } catch (error) {
    console.error("Error in DELETE /api/sessions/[sessionId]:", error)
    return NextResponse.json({ success: false, error: "Failed to delete session" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const body = await request.json()

    if (body.notes !== undefined) {
      await updateSessionNotes(params.sessionId, body.notes)
      return NextResponse.json({ success: true, message: "Notes updated successfully" })
    }

    if (body.sessionName !== undefined) {
      await updateSessionName(params.sessionId, body.sessionName)
      return NextResponse.json({ success: true, message: "Session name updated successfully" })
    }

    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 })
  } catch (error) {
    console.error("Error in PATCH /api/sessions/[sessionId]:", error)
    return NextResponse.json({ success: false, error: "Failed to update session" }, { status: 500 })
  }
}
