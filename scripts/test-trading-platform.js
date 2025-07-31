// Test complete trading platform integration
// Run with: node scripts/test-trading-platform.js

require('dotenv').config({ path: '.env.local' });

async function testCompleteTradingFlow() {
  console.log('🧪 Testing Complete Trading Platform Integration...\n');
  
  // Test 1: Basic signal processing and execution
  console.log('📊 Test 1: Signal Processing & Trade Execution');
  await testSignalProcessing();
  
  // Test 2: Multiple signals in sequence
  console.log('\n📊 Test 2: Multiple Signals in Sequence');
  await testMultipleSignals();
  
  // Test 3: Trade result monitoring
  console.log('\n📊 Test 3: Trade Result Monitoring');
  await testTradeMonitoring();
  
  console.log('\n✅ All tests completed!');
}

async function testSignalProcessing() {
  const signal = {
    "action": "buy",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "time": "2024-01-15 10:30:00",
    "entry": "45000.50",
    "target": "46000.00",
    "stop": "44500.00",
    "id": "TEST_SIGNAL_001",
    "rr": "2.5",
    "risk": "1.5"
  };

  try {
    const response = await fetch('http://localhost:3000/api/webhook/trade-signal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signal)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Signal processed successfully');
      console.log('   Session ID:', result.data.session_id);
      console.log('   Trade Amount:', result.data.trade_amount);
      console.log('   Current Node:', result.data.current_node);
      console.log('   Execution Status:', result.data.execution?.status);
      console.log('   Platform Order ID:', result.data.execution?.platform_order_id);
    } else {
      console.log('❌ Signal processing failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function testMultipleSignals() {
  const signals = [
    {
      "action": "buy",
      "symbol": "ETHUSDT",
      "timeframe": "4h",
      "time": "2024-01-15 11:00:00",
      "entry": "2800.00",
      "target": "2900.00",
      "stop": "2750.00",
      "id": "TEST_SIGNAL_002",
      "rr": "2.0",
      "risk": "1.0"
    },
    {
      "action": "sell",
      "symbol": "ADAUSDT",
      "timeframe": "1h",
      "time": "2024-01-15 12:00:00",
      "entry": "0.450",
      "target": "0.440",
      "stop": "0.460",
      "id": "TEST_SIGNAL_003",
      "rr": "1.5",
      "risk": "2.0"
    }
  ];

  for (let i = 0; i < signals.length; i++) {
    console.log(`   Processing signal ${i + 1}: ${signals[i].symbol}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/webhook/trade-signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signals[i])
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log(`   ✅ Signal ${i + 1} processed - Session: ${result.data.session_id}`);
      } else {
        console.log(`   ❌ Signal ${i + 1} failed: ${result.error}`);
      }
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ Error with signal ${i + 1}:`, error.message);
    }
  }
}

async function testTradeMonitoring() {
  console.log('   Simulating trade result monitoring...');
  
  // This would typically be done by the trading platform
  // For testing, we'll simulate the monitoring process
  try {
    // Test the monitoring endpoint (if you create one)
    const response = await fetch('http://localhost:3000/api/trading/monitor', {
      method: 'GET'
    });
    
    if (response.ok) {
      console.log('   ✅ Trade monitoring active');
    } else {
      console.log('   ⚠️  Trade monitoring endpoint not available (this is normal)');
    }
  } catch (error) {
    console.log('   ⚠️  Trade monitoring endpoint not available (this is normal)');
  }
}

// Test database schema
async function testDatabaseSchema() {
  console.log('\n📊 Test 4: Database Schema Verification');
  
  try {
    const response = await fetch('http://localhost:3000/api/debug/db-status', {
      method: 'GET'
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Database connection verified');
      console.log('   Tables found:', result.tables?.length || 0);
    } else {
      console.log('❌ Database connection failed');
    }
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
  }
}

// Test account balance functionality
async function testAccountBalance() {
  console.log('\n📊 Test 5: Account Balance Management');
  
  try {
    // Test getting current balance
    const balanceResponse = await fetch('http://localhost:3000/api/trading/balance', {
      method: 'GET'
    });

    if (balanceResponse.ok) {
      const balanceResult = await balanceResponse.json();
      console.log('✅ Account balance fetched successfully');
      console.log(`   Current Balance: ${balanceResult.data.formatted_balance}`);
      console.log(`   Timestamp: ${balanceResult.data.timestamp}`);
    } else {
      console.log('❌ Failed to fetch account balance');
    }

    // Test multiple signals with different balances
    console.log('\n   Testing signals with dynamic balance...');
    
    const testSignals = [
      {
        "action": "buy",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "time": "2024-01-15 13:00:00",
        "entry": "45000.00",
        "target": "46000.00",
        "stop": "44500.00",
        "id": "BALANCE_TEST_001",
        "rr": "2.0",
        "risk": "1.0"
      },
      {
        "action": "sell",
        "symbol": "ETHUSDT",
        "timeframe": "4h",
        "time": "2024-01-15 14:00:00",
        "entry": "2800.00",
        "target": "2750.00",
        "stop": "2850.00",
        "id": "BALANCE_TEST_002",
        "rr": "1.5",
        "risk": "1.5"
      }
    ];

    for (const signal of testSignals) {
      try {
        const response = await fetch('http://localhost:3000/api/webhook/trade-signal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signal)
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log(`✅ Signal processed: ${signal.id}`);
          console.log(`   Session ID: ${result.data.session_id}`);
          console.log(`   Initial Amount: $${result.data.initial_amount.toLocaleString()}`);
          console.log(`   Current Node: ${result.data.current_node}`);
          console.log(`   Trade Amount: $${result.data.trade_amount}`);
        }
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`❌ Error with signal ${signal.id}: ${error.message}`);
      }
    }
  } catch (error) {
    console.log('❌ Account balance test failed:', error.message);
  }
}

// Test decision tree progression
async function testDecisionTreeProgression() {
  console.log('\n📊 Test 6: Decision Tree Progression');
  
  const testSignals = [
    {
      "action": "buy",
      "symbol": "BTCUSDT",
      "timeframe": "1h",
      "time": "2024-01-15 15:00:00",
      "entry": "45000.00",
      "target": "46000.00",
      "stop": "44500.00",
      "id": "TREE_TEST_001",
      "rr": "2.0",
      "risk": "1.0"
    }
  ];

  for (const signal of testSignals) {
    try {
      const response = await fetch('http://localhost:3000/api/webhook/trade-signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signal)
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        console.log(`✅ Signal processed: ${signal.id}`);
        console.log(`   Current Node: ${result.data.current_node}`);
        console.log(`   Stake Percentage: ${result.data.node_stake_percentage}`);
        console.log(`   Trade Amount: $${result.data.trade_amount}`);
      }
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Trading Platform Integration Tests\n');
  
  try {
    await testCompleteTradingFlow();
    await testDatabaseSchema();
    await testAccountBalance();
    await testDecisionTreeProgression();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Check your database for new sessions and trade signals');
    console.log('2. Review the session steps to see execution and result tracking');
    console.log('3. Verify decision tree progression in the sessions table');
    console.log('4. Test with real TradingView signals using the webhook URL');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
  }
}

// Check if server is running
async function checkServerStatus() {
  try {
    const response = await fetch('http://localhost:3000/api/webhook/trade-signal', {
      method: 'GET'
    });
    
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start with: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServerStatus();
  
  if (serverRunning) {
    await runAllTests();
  } else {
    console.log('\n💡 To run tests:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Run this test script: node scripts/test-trading-platform.js');
  }
}

main(); 