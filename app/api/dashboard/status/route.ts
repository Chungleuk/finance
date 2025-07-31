import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/dashboard/status - Fetching real-time dashboard data")

    if (!sql) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 503 }
      )
    }

    // Get current active sessions
    const activeSessions = await sql`
      SELECT 
        session_id,
        session_name,
        current_node,
        initial_amount,
        final_total,
        path_summary,
        is_completed,
        created_at,
        last_action_timestamp,
        updated_at
      FROM sessions 
      WHERE is_completed = false 
      ORDER BY last_action_timestamp DESC
      LIMIT 10
    `

    // Get pending trades (execution status = PENDING)
    const pendingTrades = await sql`
      SELECT 
        ss.session_id,
        ss.step_number,
        ss.node_name,
        ss.stake_value,
        ss.step_type,
        ss.execution_status,
        ss.note,
        ss.step_timestamp,
        s.session_name,
        s.current_node
      FROM session_steps ss
      JOIN sessions s ON ss.session_id = s.session_id
      WHERE ss.execution_status = 'PENDING'
      ORDER BY ss.step_timestamp DESC
      LIMIT 20
    `

    // Get recent trade results
    const recentResults = await sql`
      SELECT 
        ss.session_id,
        ss.step_number,
        ss.node_name,
        ss.stake_value,
        ss.step_type,
        ss.execution_status,
        ss.note,
        ss.step_timestamp,
        s.session_name,
        s.current_node,
        s.final_total
      FROM session_steps ss
      JOIN sessions s ON ss.session_id = s.session_id
      WHERE ss.step_type = 'RESULT'
      ORDER BY ss.step_timestamp DESC
      LIMIT 10
    `

    // Calculate system statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN is_completed = false THEN 1 END) as active_sessions,
        AVG(CASE WHEN is_completed = true THEN final_total END) as avg_final_total,
        SUM(CASE WHEN is_completed = true THEN final_total END) as total_profit_loss
      FROM sessions
    `

    // Get decision tree path visualization data
    const pathData = await sql`
      SELECT 
        current_node,
        COUNT(*) as session_count,
        AVG(final_total) as avg_total,
        MAX(final_total) as max_total,
        MIN(final_total) as min_total
      FROM sessions 
      WHERE is_completed = true
      GROUP BY current_node
      ORDER BY current_node
    `

    const dashboardData = {
      active_sessions: activeSessions.map((session: any) => ({
        ...session,
        running_total: session.final_total || 0,
        duration: session.last_action_timestamp ? 
          Math.floor((Date.now() - new Date(session.last_action_timestamp).getTime()) / 1000) : 0,
        path_visualization: session.path_summary ? session.path_summary.split(' → ') : [session.current_node]
      })),
      pending_trades: pendingTrades.map((trade: any) => ({
        ...trade,
        time_in_queue: Math.floor((Date.now() - new Date(trade.step_timestamp).getTime()) / 1000)
      })),
      recent_results: recentResults.map((result: any) => ({
        ...result,
        profit_loss: result.note ? parseFloat(result.note.match(/P&L: ([-\d.]+)/)?.[1] || '0') : 0
      })),
      statistics: {
        total_sessions: parseInt(stats[0]?.total_sessions || '0'),
        completed_sessions: parseInt(stats[0]?.completed_sessions || '0'),
        active_sessions: parseInt(stats[0]?.active_sessions || '0'),
        avg_final_total: parseFloat(stats[0]?.avg_final_total || '0'),
        total_profit_loss: parseFloat(stats[0]?.total_profit_loss || '0'),
        success_rate: stats[0]?.completed_sessions > 0 ? 
          (stats[0]?.total_profit_loss > 0 ? 'Profitable' : 'Loss') : 'N/A'
      },
      decision_tree_analytics: pathData.map((path: any) => ({
        node: path.current_node,
        session_count: parseInt(path.session_count),
        avg_total: parseFloat(path.avg_total || '0'),
        max_total: parseFloat(path.max_total || '0'),
        min_total: parseFloat(path.min_total || '0'),
        success_rate: parseFloat(path.avg_total || '0') > 0 ? 'Profitable' : 'Loss'
      })),
      system_status: {
        database_connected: true,
        last_update: new Date().toISOString(),
        uptime: process.uptime(),
        memory_usage: process.memoryUsage()
      }
    }

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error("Error fetching dashboard data:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard data"
      },
      { status: 500 }
    )
  }
} 