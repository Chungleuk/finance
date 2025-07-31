import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Check database connection
    await sql`SELECT 1`

    // Check if tables exist
    const tables = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('sessions', 'session_steps')
      ORDER BY table_name, ordinal_position
    `

    // Get sample data
    const sessionCount = await sql`SELECT COUNT(*) as count FROM sessions`
    const stepCount = await sql`SELECT COUNT(*) as count FROM session_steps`

    return NextResponse.json({
      success: true,
      database: "Connected",
      tables: tables,
      counts: {
        sessions: sessionCount[0]?.count || 0,
        steps: stepCount[0]?.count || 0,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
