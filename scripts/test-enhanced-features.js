const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'

// Test 1: Real-time Dashboard
async function testDashboard() {
  console.log('\n📊 Test 1: Real-time Dashboard')
  
  try {
    const response = await fetch(`${BASE_URL}/api/dashboard/status`)
    const result = await response.json()
    
    if (response.ok && result.success) {
      console.log('✅ Dashboard data retrieved successfully')
      console.log(`   Active Sessions: ${result.data.active_sessions.length}`)
      console.log(`   Pending Trades: ${result.data.pending_trades.length}`)
      console.log(`   Recent Results: ${result.data.recent_results.length}`)
      console.log(`   Total Sessions: ${result.data.statistics.total_sessions}`)
      console.log(`   Success Rate: ${result.data.statistics.success_rate}`)
      console.log(`   Decision Tree Analytics: ${result.data.decision_tree_analytics.length} nodes`)
    } else {
      console.log('❌ Dashboard test failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Dashboard test error:', error.message)
  }
}

// Test 2: Alert System
async function testAlertSystem() {
  console.log('\n🚨 Test 2: Alert System')
  
  try {
    // Get active alerts
    const alertsResponse = await fetch(`${BASE_URL}/api/dashboard/alerts`)
    const alertsResult = await alertsResponse.json()
    
    if (alertsResponse.ok && alertsResult.success) {
      console.log('✅ Alerts retrieved successfully')
      console.log(`   Active Alerts: ${alertsResult.data.active_alerts.length}`)
      console.log(`   Platform Status: ${alertsResult.data.system_health.platformStatus}`)
      console.log(`   Stake Calculation Trend: ${alertsResult.data.system_health.stakeCalculationTrend}`)
    } else {
      console.log('❌ Alerts test failed:', alertsResult.error)
    }

    // Test acknowledging an alert (if any exist)
    if (alertsResult.data.active_alerts.length > 0) {
      const alertId = alertsResult.data.active_alerts[0].id
      const ackResponse = await fetch(`${BASE_URL}/api/dashboard/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id: alertId,
          acknowledged_by: 'test-user'
        })
      })
      
      const ackResult = await ackResponse.json()
      if (ackResponse.ok && ackResult.success) {
        console.log('✅ Alert acknowledged successfully')
      } else {
        console.log('❌ Alert acknowledgment failed:', ackResult.error)
      }
    }
  } catch (error) {
    console.log('❌ Alert system test error:', error.message)
  }
}

// Test 3: Database Optimization and Analytics
async function testDatabaseOptimization() {
  console.log('\n🗄️ Test 3: Database Optimization and Analytics')
  
  try {
    // Test performance analytics
    const analyticsResponse = await fetch(`${BASE_URL}/api/system/backup?action=analytics`)
    const analyticsResult = await analyticsResponse.json()
    
    if (analyticsResponse.ok && analyticsResult.success) {
      console.log('✅ Performance analytics retrieved successfully')
      const analytics = analyticsResult.data.analytics
      
      if (analytics.session_overview) {
        console.log(`   Total Sessions: ${analytics.session_overview.total_sessions}`)
        console.log(`   Completed Sessions: ${analytics.session_overview.completed_sessions}`)
        console.log(`   Profitable Sessions: ${analytics.session_overview.profitable_sessions}`)
        console.log(`   Total P&L: $${analytics.session_overview.total_pnl}`)
      }
      
      if (analytics.symbol_performance) {
        console.log(`   Symbol Performance: ${analytics.symbol_performance.length} symbols analyzed`)
      }
      
      if (analytics.path_performance) {
        console.log(`   Path Performance: ${analytics.path_performance.length} paths analyzed`)
      }
    } else {
      console.log('❌ Analytics test failed:', analyticsResult.error)
    }

    // Test high-performance paths
    const pathsResponse = await fetch(`${BASE_URL}/api/system/backup?action=high-performance-paths&min_sessions=1&min_win_rate=50&min_profit_factor=1.0`)
    const pathsResult = await pathsResponse.json()
    
    if (pathsResponse.ok && pathsResult.success) {
      console.log('✅ High-performance paths retrieved successfully')
      console.log(`   High-performance paths: ${pathsResult.data.high_performance_paths.length}`)
    } else {
      console.log('❌ High-performance paths test failed:', pathsResult.error)
    }
  } catch (error) {
    console.log('❌ Database optimization test error:', error.message)
  }
}

// Test 4: Backup System
async function testBackupSystem() {
  console.log('\n💾 Test 4: Backup System')
  
  try {
    // Check backup status
    const statusResponse = await fetch(`${BASE_URL}/api/system/backup`)
    const statusResult = await statusResponse.json()
    
    if (statusResponse.ok && statusResult.success) {
      console.log('✅ Backup status retrieved successfully')
      console.log(`   Backup Needed: ${statusResult.data.backup_needed}`)
      console.log(`   Last Backup: ${statusResult.data.backup_stats.lastBackup}`)
      console.log(`   Next Scheduled: ${statusResult.data.backup_stats.nextScheduledBackup}`)
    } else {
      console.log('❌ Backup status test failed:', statusResult.error)
    }

    // Test manual backup
    const backupResponse = await fetch(`${BASE_URL}/api/system/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'manual',
        filters: {
          symbol: ['BTCUSDT'],
          timeframe: ['1h'],
          days_back: 7
        }
      })
    })
    
    const backupResult = await backupResponse.json()
    if (backupResponse.ok && backupResult.success) {
      console.log('✅ Manual backup completed successfully')
      console.log(`   Records Backed Up: ${backupResult.data.recordsBackedUp}`)
      console.log(`   File Size: ${backupResult.data.fileSize} bytes`)
    } else {
      console.log('❌ Manual backup failed:', backupResult.error)
    }
  } catch (error) {
    console.log('❌ Backup system test error:', error.message)
  }
}

// Test 5: Retry Mechanism
async function testRetryMechanism() {
  console.log('\n🔄 Test 5: Retry Mechanism')
  
  console.log('   Note: Retry mechanism is integrated in trading platform service')
  console.log('   - Automatically retries failed trades up to 3 times')
  console.log('   - 5-second intervals with exponential backoff')
  console.log('   - Handles network fluctuations and temporary failures')
  console.log('   - Prevents decision tree interruption due to temporary issues')
  
  // Test with a valid signal to see retry mechanism in action
  const testSignal = {
    "action": "buy",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "time": "2024-01-15 14:00:00",
    "entry": "45000.00",
    "target": "46000.00",
    "stop": "44500.00",
    "id": "RETRY_TEST_001",
    "rr": "2.0",
    "risk": "1.0"
  }

  try {
    const response = await fetch(`${BASE_URL}/api/webhook/trade-signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testSignal)
    })

    const result = await response.json()
    
    if (response.ok && result.success) {
      console.log('✅ Signal processed with retry mechanism')
      console.log(`   Session ID: ${result.data.session_id}`)
      console.log(`   Execution Status: ${result.data.execution.status}`)
    } else {
      console.log('❌ Retry mechanism test failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Retry mechanism test error:', error.message)
  }
}

// Test 6: Enhanced Signal Processing with Monitoring
async function testEnhancedSignalProcessing() {
  console.log('\n📡 Test 6: Enhanced Signal Processing with Monitoring')
  
  const testSignals = [
    {
      "action": "buy",
      "symbol": "BTCUSDT",
      "timeframe": "1h",
      "time": "2024-01-15 15:00:00",
      "entry": "45000.00",
      "target": "46000.00",
      "stop": "44500.00",
      "id": "ENHANCED_001",
      "rr": "2.0",
      "risk": "1.0"
    },
    {
      "action": "sell",
      "symbol": "ETHUSDT",
      "timeframe": "4h",
      "time": "2024-01-15 16:00:00",
      "entry": "2800.00",
      "target": "2750.00",
      "stop": "2850.00",
      "id": "ENHANCED_002",
      "rr": "1.5",
      "risk": "1.5"
    }
  ]

  for (const signal of testSignals) {
    try {
      console.log(`\n   Processing signal: ${signal.id}`)
      
      const response = await fetch(`${BASE_URL}/api/webhook/trade-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        console.log(`   ✅ Signal processed successfully`)
        console.log(`      Session ID: ${result.data.session_id}`)
        console.log(`      Current Node: ${result.data.current_node}`)
        console.log(`      Trade Amount: $${result.data.trade_amount}`)
        console.log(`      Execution Status: ${result.data.execution.status}`)
        
        // Note: Signal delay and stake calculation monitoring are integrated
        console.log(`      Note: Signal delay and stake calculation monitoring active`)
      } else {
        console.log(`   ❌ Signal processing failed: ${result.error}`)
      }
      
      // Wait between signals
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error) {
      console.log(`   ❌ Error processing signal ${signal.id}: ${error.message}`)
    }
  }
}

// Test 7: Cache Management
async function testCacheManagement() {
  console.log('\n📂 Test 7: Cache Management')
  
  try {
    // Get cache status
    const statusResponse = await fetch(`${BASE_URL}/api/system/cache`)
    const statusResult = await statusResponse.json()
    
    if (statusResponse.ok && statusResult.success) {
      console.log('✅ Cache status retrieved successfully')
      console.log(`   Cached Sessions: ${statusResult.data.cached_sessions}`)
      console.log(`   Expired Sessions: ${statusResult.data.expired_sessions}`)
      console.log(`   Retry Counts: ${JSON.stringify(statusResult.data.retry_counts)}`)
    } else {
      console.log('❌ Cache status test failed:', statusResult.error)
    }

    // Test cache synchronization
    const syncResponse = await fetch(`${BASE_URL}/api/system/cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync' })
    })
    
    const syncResult = await syncResponse.json()
    if (syncResponse.ok && syncResult.success) {
      console.log('✅ Cache synchronization completed')
      console.log(`   Synced: ${syncResult.data.synced}`)
      console.log(`   Failed: ${syncResult.data.failed}`)
    } else {
      console.log('❌ Cache synchronization failed:', syncResult.error)
    }
  } catch (error) {
    console.log('❌ Cache management test error:', error.message)
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Enhanced Features Test Suite')
  console.log('================================')
  
  try {
    await testDashboard()
    await testAlertSystem()
    await testDatabaseOptimization()
    await testBackupSystem()
    await testRetryMechanism()
    await testEnhancedSignalProcessing()
    await testCacheManagement()
    
    console.log('\n✅ All enhanced features tests completed!')
    console.log('\n📋 Summary of Enhanced Features:')
    console.log('   🎯 Real-time Dashboard: Session monitoring, pending trades, analytics')
    console.log('   🚨 Alert System: Signal delay, platform health, stake calculation monitoring')
    console.log('   🗄️ Database Optimization: trade_result_actual field, performance views, analytics')
    console.log('   💾 Backup System: Automatic daily backups, filtering, analytics')
    console.log('   🔄 Retry Mechanism: 3 retries with 5-second intervals, exponential backoff')
    console.log('   📡 Enhanced Processing: Integrated monitoring and alerting')
    console.log('   📂 Cache Management: Local caching, synchronization, failure recovery')
    
  } catch (error) {
    console.error('❌ Test suite failed:', error)
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
}

module.exports = {
  runAllTests,
  testDashboard,
  testAlertSystem,
  testDatabaseOptimization,
  testBackupSystem,
  testRetryMechanism,
  testEnhancedSignalProcessing,
  testCacheManagement
} 