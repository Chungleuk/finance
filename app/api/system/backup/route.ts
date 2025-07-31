import { type NextRequest, NextResponse } from "next/server"
import { backupService } from "@/lib/backup-service"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/system/backup - Getting backup status and analytics")

    if (!sql) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'stats') {
      // Get backup statistics
      const backupStats = await backupService.getBackupStats()
      
      return NextResponse.json({
        success: true,
        data: {
          backup_stats: backupStats,
          timestamp: new Date().toISOString()
        }
      })
    }

    if (action === 'analytics') {
      // Get performance analytics
      const analytics = await getPerformanceAnalytics()
      
      return NextResponse.json({
        success: true,
        data: {
          analytics,
          timestamp: new Date().toISOString()
        }
      })
    }

    if (action === 'high-performance-paths') {
      // Get high-performance paths
      const minSessions = parseInt(searchParams.get('min_sessions') || '5')
      const minWinRate = parseFloat(searchParams.get('min_win_rate') || '60.0')
      const minProfitFactor = parseFloat(searchParams.get('min_profit_factor') || '1.5')
      
      const highPerformancePaths = await sql`
        SELECT * FROM get_high_performance_paths(${minSessions}, ${minWinRate}, ${minProfitFactor})
      `
      
      return NextResponse.json({
        success: true,
        data: {
          high_performance_paths: highPerformancePaths,
          filters: {
            min_sessions: minSessions,
            min_win_rate: minWinRate,
            min_profit_factor: minProfitFactor
          },
          timestamp: new Date().toISOString()
        }
      })
    }

    // Default: check if backup is needed
    const isBackupNeeded = backupService.isBackupNeeded()
    const backupStats = await backupService.getBackupStats()
    
    return NextResponse.json({
      success: true,
      data: {
        backup_needed: isBackupNeeded,
        backup_stats: backupStats,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error("Error in backup API:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process backup request"
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/system/backup - Performing backup")

    const body = await request.text()
    let data: any
    
    try {
      data = JSON.parse(body)
    } catch (parseError) {
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { action, filters } = data

    if (!action) {
      return NextResponse.json({ success: false, error: "action is required" }, { status: 400 })
    }

    switch (action) {
      case 'perform':
        const backupResult = await backupService.performBackup()
        return NextResponse.json({
          success: backupResult.success,
          data: backupResult,
          message: backupResult.success ? "Backup completed successfully" : "Backup failed"
        })

      case 'manual':
        const manualBackupResult = await backupService.manualBackup(filters)
        return NextResponse.json({
          success: manualBackupResult.success,
          data: manualBackupResult,
          message: manualBackupResult.success ? "Manual backup completed successfully" : "Manual backup failed"
        })

      case 'backup-by-filter':
        if (!sql) {
          return NextResponse.json(
            { success: false, error: "Database not available" },
            { status: 503 }
          )
        }

        const { symbol, timeframe, days_back = 30 } = filters || {}
        const backupCount = await sql`
          SELECT backup_sessions_by_filter(${symbol}, ${timeframe}, ${days_back})
        `
        
        return NextResponse.json({
          success: true,
          data: {
            backup_count: backupCount[0]?.backup_sessions_by_filter || 0,
            filters: { symbol, timeframe, days_back },
            message: `Backup created with ${backupCount[0]?.backup_sessions_by_filter || 0} sessions`
          }
        })

      default:
        return NextResponse.json({ 
          success: false, 
          error: `Unknown action: ${action}. Valid actions: perform, manual, backup-by-filter` 
        }, { status: 400 })
    }

  } catch (error) {
    console.error("Error performing backup:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to perform backup"
      },
      { status: 500 }
    )
  }
}

/**
 * Get comprehensive performance analytics
 */
async function getPerformanceAnalytics(): Promise<any> {
  try {
    if (!sql) {
      return {}
    }

    const analytics: any = {}

    // Session performance overview
    const sessionOverview = await sql`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN is_completed = false THEN 1 END) as active_sessions,
        COUNT(CASE WHEN final_total > 0 THEN 1 END) as profitable_sessions,
        COUNT(CASE WHEN final_total <= 0 THEN 1 END) as losing_sessions,
        AVG(CASE WHEN is_completed = true THEN final_total END) as avg_final_total,
        SUM(CASE WHEN is_completed = true THEN final_total END) as total_pnl,
        MAX(CASE WHEN is_completed = true THEN final_total END) as max_profit,
        MIN(CASE WHEN is_completed = true THEN final_total END) as max_loss
      FROM sessions
    `
    analytics.session_overview = sessionOverview[0]

    // Symbol performance
    const symbolPerformance = await sql`
      SELECT 
        symbol,
        COUNT(*) as session_count,
        COUNT(CASE WHEN final_total > 0 THEN 1 END) as profitable_count,
        AVG(final_total) as avg_pnl,
        SUM(final_total) as total_pnl,
        MAX(final_total) as max_profit,
        MIN(final_total) as max_loss,
        ROUND(
          COUNT(CASE WHEN final_total > 0 THEN 1 END) * 100.0 / COUNT(*), 2
        ) as win_rate
      FROM sessions 
      WHERE is_completed = true
      GROUP BY symbol
      ORDER BY avg_pnl DESC
    `
    analytics.symbol_performance = symbolPerformance

    // Decision tree path performance
    const pathPerformance = await sql`
      SELECT 
        current_node,
        path_summary,
        COUNT(*) as session_count,
        COUNT(CASE WHEN final_total > 0 THEN 1 END) as profitable_count,
        AVG(final_total) as avg_pnl,
        SUM(final_total) as total_pnl,
        ROUND(
          COUNT(CASE WHEN final_total > 0 THEN 1 END) * 100.0 / COUNT(*), 2
        ) as win_rate
      FROM sessions 
      WHERE is_completed = true
      GROUP BY current_node, path_summary
      ORDER BY avg_pnl DESC
    `
    analytics.path_performance = pathPerformance

    // Time-based performance
    const timePerformance = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as session_count,
        COUNT(CASE WHEN final_total > 0 THEN 1 END) as profitable_count,
        AVG(final_total) as avg_pnl,
        SUM(final_total) as daily_pnl
      FROM sessions 
      WHERE is_completed = true
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `
    analytics.time_performance = timePerformance

    // Recent activity
    const recentActivity = await sql`
      SELECT 
        session_id,
        session_name,
        symbol,
        current_node,
        final_total,
        created_at,
        last_action_timestamp
      FROM sessions 
      ORDER BY last_action_timestamp DESC
      LIMIT 10
    `
    analytics.recent_activity = recentActivity

    return analytics

  } catch (error) {
    console.error("Error getting performance analytics:", error)
    return {}
  }
} 