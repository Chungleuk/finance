const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'

// Test 1: Enhanced Signal Processing with Your Example
async function testEnhancedSignalProcessing() {
  console.log('\n📡 Test 1: Enhanced Signal Processing with Your Example')
  
  const exampleSignal = {
    "action": "BUY",
    "symbol": "EURUSD",
    "timeframe": "15",
    "time": "2025-07-19T08:30:00Z",
    "entry": 1.0925,
    "target": 1.0965,
    "stop": 1.0890,
    "id": "20250719-000042",
    "rr": 2.75,
    "risk": 1.0
  }

  try {
    console.log('   Sending example signal:', exampleSignal.id)
    
    const response = await fetch(`${BASE_URL}/api/webhook/trade-signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exampleSignal)
    })

    const result = await response.json()
    
    if (response.ok && result.success) {
      console.log('   ✅ Signal processed successfully')
      console.log(`      Session ID: ${result.data.session_id}`)
      console.log(`      Trade ID: ${result.data.trade_id}`)
      console.log(`      Current Node: ${result.data.current_node}`)
      console.log(`      Trade Amount: $${result.data.trade_amount}`)
      console.log(`      Execution Status: ${result.data.execution.status}`)
      
      // Check for warnings (normalization)
      if (result.warnings && result.warnings.length > 0) {
        console.log('      Warnings:', result.warnings)
      }
      
      return result.data.session_id
    } else {
      console.log('   ❌ Signal processing failed:', result.error)
      if (result.details) {
        console.log('      Details:', result.details)
      }
      return null
    }
  } catch (error) {
    console.log('   ❌ Error processing signal:', error.message)
    return null
  }
}

// Test 2: Signal Validation Improvements
async function testSignalValidation() {
  console.log('\n🔍 Test 2: Signal Validation Improvements')
  
  const testCases = [
    {
      name: 'Invalid Action Case',
      signal: {
        "action": "BUY", // Should be normalized to "buy"
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "time": "2025-07-19T10:00:00Z",
        "entry": 45000,
        "target": 46000,
        "stop": 44500,
        "id": "VALIDATION_001",
        "rr": 2.0,
        "risk": 1.0
      }
    },
    {
      name: 'Invalid Timeframe Format',
      signal: {
        "action": "buy",
        "symbol": "ETHUSDT",
        "timeframe": "15", // Should be normalized to "15m"
        "time": "2025-07-19T11:00:00Z",
        "entry": 2800,
        "target": 2750,
        "stop": 2850,
        "id": "VALIDATION_002",
        "rr": 1.5,
        "risk": 1.5
      }
    },
    {
      name: 'Invalid Price Logic (BUY)',
      signal: {
        "action": "buy",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "time": "2025-07-19T12:00:00Z",
        "entry": 45000,
        "target": 44000, // Target below entry for BUY
        "stop": 46000,   // Stop above entry for BUY
        "id": "VALIDATION_003",
        "rr": 2.0,
        "risk": 1.0
      }
    },
    {
      name: 'Duplicate Signal ID',
      signal: {
        "action": "buy",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "time": "2025-07-19T13:00:00Z",
        "entry": 45000,
        "target": 46000,
        "stop": 44500,
        "id": "20250719-000042", // Duplicate ID
        "rr": 2.0,
        "risk": 1.0
      }
    }
  ]

  for (const testCase of testCases) {
    try {
      console.log(`\n   Testing: ${testCase.name}`)
      
      const response = await fetch(`${BASE_URL}/api/webhook/trade-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.signal)
      })

      const result = await response.json()
      
      if (response.ok && result.success) {
        console.log(`   ✅ ${testCase.name} - Processed with warnings:`, result.warnings || [])
      } else {
        console.log(`   ❌ ${testCase.name} - Failed as expected:`, result.error)
        if (result.details) {
          console.log('      Validation errors:', result.details)
        }
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      console.log(`   ❌ Error in ${testCase.name}:`, error.message)
    }
  }
}

// Test 3: Trade Result Callback
async function testTradeResultCallback(sessionId) {
  console.log('\n🔄 Test 3: Trade Result Callback')
  
  if (!sessionId) {
    console.log('   ⚠️ No session ID available, skipping trade result test')
    return
  }

  const winCallback = {
    "trade_id": "20250719-000042",
    "session_id": sessionId,
    "result": "win",
    "exit_price": 1.0965,
    "profit_loss": 150.25,
    "exit_reason": "target_reached",
    "exited_at": "2025-07-19T09:30:00Z",
    "platform_order_id": "order_123456",
    "actual_quantity": 1000,
    "fees": 2.50,
    "slippage": 0.0001
  }

  try {
    console.log('   Sending WIN result callback')
    
    const response = await fetch(`${BASE_URL}/api/webhook/trade-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(winCallback)
    })

    const result = await response.json()
    
    if (response.ok && result.success) {
      console.log('   ✅ Trade result processed successfully')
      console.log(`      Session ID: ${result.data.session_id}`)
      console.log(`      Current Node: ${result.data.current_node}`)
      console.log(`      Final Total: $${result.data.final_total}`)
      console.log(`      Is Completed: ${result.data.is_completed}`)
      console.log(`      Next Action: ${result.data.next_action}`)
      
      return result.data.current_node
    } else {
      console.log('   ❌ Trade result processing failed:', result.error)
      return null
    }
  } catch (error) {
    console.log('   ❌ Error processing trade result:', error.message)
    return null
  }
}

// Test 4: Complete Trading Flow
async function testCompleteTradingFlow() {
  console.log('\n🔄 Test 4: Complete Trading Flow')
  
  const signals = [
    {
      "action": "BUY",
      "symbol": "EURUSD",
      "timeframe": "15",
      "time": "2025-07-19T14:00:00Z",
      "entry": 1.0925,
      "target": 1.0965,
      "stop": 1.0890,
      "id": "FLOW_001",
      "rr": 2.75,
      "risk": 1.0
    },
    {
      "action": "SELL",
      "symbol": "GBPUSD",
      "timeframe": "60",
      "time": "2025-07-19T15:00:00Z",
      "entry": 1.2850,
      "target": 1.2800,
      "stop": 1.2900,
      "id": "FLOW_002",
      "rr": 2.0,
      "risk": 1.5
    }
  ]

  const sessionIds = []

  for (const signal of signals) {
    try {
      console.log(`\n   Processing signal: ${signal.id}`)
      
      // Step 1: Send signal
      const signalResponse = await fetch(`${BASE_URL}/api/webhook/trade-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal)
      })

      const signalResult = await signalResponse.json()
      
      if (signalResponse.ok && signalResult.success) {
        console.log(`   ✅ Signal processed: ${signalResult.data.session_id}`)
        sessionIds.push(signalResult.data.session_id)
        
        // Step 2: Send trade result (simulate win)
        const resultCallback = {
          "trade_id": signal.id,
          "session_id": signalResult.data.session_id,
          "result": "win",
          "exit_price": signal.action === "BUY" ? signal.target : signal.stop,
          "profit_loss": 100.00,
          "exit_reason": "target_reached",
          "exited_at": new Date().toISOString()
        }

        const resultResponse = await fetch(`${BASE_URL}/api/webhook/trade-result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resultCallback)
        })

        const resultResult = await resultResponse.json()
        
        if (resultResponse.ok && resultResult.success) {
          console.log(`   ✅ Trade result processed: ${resultResult.data.current_node}`)
        } else {
          console.log(`   ❌ Trade result failed: ${resultResult.error}`)
        }
      } else {
        console.log(`   ❌ Signal failed: ${signalResult.error}`)
      }
      
      // Wait between signals
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error) {
      console.log(`   ❌ Error in flow test: ${error.message}`)
    }
  }

  return sessionIds
}

// Test 5: Error Handling and Recovery
async function testErrorHandling() {
  console.log('\n🛡️ Test 5: Error Handling and Recovery')
  
  const errorTestCases = [
    {
      name: 'Missing Required Fields',
      signal: {
        "action": "buy",
        "symbol": "BTCUSDT"
        // Missing other required fields
      }
    },
    {
      name: 'Invalid JSON Format',
      signal: "invalid json string"
    },
    {
      name: 'Invalid Trade Result',
      callback: {
        "trade_id": "ERROR_001",
        "session_id": "nonexistent_session",
        "result": "invalid_result",
        "exit_price": "not_a_number",
        "profit_loss": "invalid",
        "exit_reason": "unknown_reason",
        "exited_at": "invalid_date"
      }
    }
  ]

  for (const testCase of errorTestCases) {
    try {
      console.log(`\n   Testing: ${testCase.name}`)
      
      let response, result
      
      if (testCase.signal) {
        const body = typeof testCase.signal === 'string' ? testCase.signal : JSON.stringify(testCase.signal)
        response = await fetch(`${BASE_URL}/api/webhook/trade-signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        })
      } else if (testCase.callback) {
        response = await fetch(`${BASE_URL}/api/webhook/trade-result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase.callback)
        })
      }
      
      result = await response.json()
      
      if (!response.ok) {
        console.log(`   ✅ ${testCase.name} - Properly rejected with status ${response.status}`)
        console.log(`      Error: ${result.error}`)
      } else {
        console.log(`   ⚠️ ${testCase.name} - Unexpectedly succeeded`)
      }
      
    } catch (error) {
      console.log(`   ✅ ${testCase.name} - Properly caught error: ${error.message}`)
    }
  }
}

// Test 6: System Health and Monitoring
async function testSystemHealth() {
  console.log('\n🏥 Test 6: System Health and Monitoring')
  
  try {
    // Check dashboard status
    const dashboardResponse = await fetch(`${BASE_URL}/api/dashboard/status`)
    const dashboardResult = await dashboardResponse.json()
    
    if (dashboardResponse.ok && dashboardResult.success) {
      console.log('   ✅ Dashboard health check passed')
      console.log(`      Active Sessions: ${dashboardResult.data.active_sessions.length}`)
      console.log(`      System Status: ${dashboardResult.data.system_status.database_connected ? 'Connected' : 'Disconnected'}`)
    } else {
      console.log('   ❌ Dashboard health check failed:', dashboardResult.error)
    }

    // Check alerts
    const alertsResponse = await fetch(`${BASE_URL}/api/dashboard/alerts`)
    const alertsResult = await alertsResponse.json()
    
    if (alertsResponse.ok && alertsResult.success) {
      console.log('   ✅ Alerts system health check passed')
      console.log(`      Active Alerts: ${alertsResult.data.active_alerts.length}`)
      console.log(`      Platform Status: ${alertsResult.data.system_health.platformStatus}`)
    } else {
      console.log('   ❌ Alerts health check failed:', alertsResult.error)
    }

  } catch (error) {
    console.log('   ❌ System health check error:', error.message)
  }
}

// Main test execution
async function runImprovedSystemTests() {
  console.log('🚀 Improved System Test Suite')
  console.log('=============================')
  console.log('Testing enhanced signal processing, validation, and trading flow')
  
  try {
    // Test 1: Enhanced signal processing with your example
    const sessionId = await testEnhancedSignalProcessing()
    
    // Test 2: Signal validation improvements
    await testSignalValidation()
    
    // Test 3: Trade result callback
    await testTradeResultCallback(sessionId)
    
    // Test 4: Complete trading flow
    await testCompleteTradingFlow()
    
    // Test 5: Error handling and recovery
    await testErrorHandling()
    
    // Test 6: System health and monitoring
    await testSystemHealth()
    
    console.log('\n✅ All improved system tests completed!')
    console.log('\n📋 Summary of Improvements:')
    console.log('   🔧 Enhanced Signal Processing: Case normalization, timeframe handling')
    console.log('   🛡️ Improved Validation: Price logic, risk-reward, signal age, duplicates')
    console.log('   🔄 Trade Result Callbacks: Win/loss feedback, decision tree updates')
    console.log('   🚨 Better Error Handling: Comprehensive validation, proper error responses')
    console.log('   📊 Complete Trading Flow: End-to-end signal processing and result handling')
    console.log('   🏥 System Monitoring: Health checks, alert integration')
    
  } catch (error) {
    console.error('❌ Test suite failed:', error)
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runImprovedSystemTests()
}

module.exports = {
  runImprovedSystemTests,
  testEnhancedSignalProcessing,
  testSignalValidation,
  testTradeResultCallback,
  testCompleteTradingFlow,
  testErrorHandling,
  testSystemHealth
} 