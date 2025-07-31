// Test webhook functionality
// Run with: node scripts/test-webhook.js

require('dotenv').config({ path: '.env.local' });

async function testWebhook() {
  console.log('Testing TradingView webhook...\n');
  
  // Sample TradingView signal
  const sampleSignal = {
    "action": "buy",
    "symbol": "BTCUSDT",
    "timeframe": "1h",
    "time": "2024-01-15 10:30:00",
    "entry": "45000.50",
    "target": "46000.00",
    "stop": "44500.00",
    "id": "TV_SIGNAL_001",
    "rr": "2.5",
    "risk": "1.5"
  };

  console.log('Sample signal:', JSON.stringify(sampleSignal, null, 2));
  
  try {
    // Test the webhook endpoint
    const response = await fetch('http://localhost:3000/api/webhook/trade-signal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleSignal)
    });

    const result = await response.json();
    
    console.log('\nResponse status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.success) {
      console.log('\n✅ Webhook test successful!');
      console.log('Session ID:', result.data.session_id);
      console.log('Trade Amount:', result.data.trade_amount);
      console.log('Current Node:', result.data.current_node);
    } else {
      console.log('\n❌ Webhook test failed!');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing webhook:', error.message);
    console.log('\nMake sure your development server is running: npm run dev');
  }
}

// Test multiple signals
async function testMultipleSignals() {
  console.log('\n\nTesting multiple signals...\n');
  
  const signals = [
    {
      "action": "buy",
      "symbol": "ETHUSDT",
      "timeframe": "4h",
      "time": "2024-01-15 11:00:00",
      "entry": "2800.00",
      "target": "2900.00",
      "stop": "2750.00",
      "id": "TV_SIGNAL_002",
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
      "id": "TV_SIGNAL_003",
      "rr": "1.5",
      "risk": "2.0"
    }
  ];

  for (let i = 0; i < signals.length; i++) {
    console.log(`\n--- Testing Signal ${i + 1} ---`);
    console.log('Symbol:', signals[i].symbol);
    
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
        console.log('✅ Success - Session:', result.data.session_id);
      } else {
        console.log('❌ Failed:', result.error);
      }
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  await testWebhook();
  await testMultipleSignals();
}

runTests(); 