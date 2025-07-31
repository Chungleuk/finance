import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Check environment variables
    const envVars = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    }

    if (!sql) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not initialized",
          envVars,
          hint: "No valid database URL found in environment variables",
        },
        { status: 500 },
      )
    }

    // Test basic database connection
    const result = await sql`SELECT 1 as test`

    // Test if tables exist
    const tablesExist = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sessions', 'session_steps')
    `

    // Get table counts
    let sessionCount = 0
    let stepCount = 0

    try {
      const sessionResult = await sql`SELECT COUNT(*) as count FROM sessions`
      sessionCount = sessionResult[0]?.count || 0
    } catch (e) {
      console.log("Sessions table doesn't exist yet")
    }

    try {
      const stepResult = await sql`SELECT COUNT(*) as count FROM session_steps`
      stepCount = stepResult[0]?.count || 0
    } catch (e) {
      console.log("Session_steps table doesn't exist yet")
    }

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      envVars,
      tablesFound: tablesExist.map((t) => t.table_name),
      counts: {
        sessions: sessionCount,
        steps: stepCount,
      },
      needsSetup: tablesExist.length < 2,
    })
  } catch (error) {
    console.error("Database test failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Database connection failed",
        envVars: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          POSTGRES_URL: !!process.env.POSTGRES_URL,
          POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
        },
        hint: "Make sure DATABASE_URL is set and the database tables are created",
      },
      { status: 500 },
    )
  }
}
