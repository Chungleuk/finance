# TradingView Webhook Integration

## Overview

The Decision Tree Tracker now includes a webhook endpoint to receive trading signals from TradingView and automatically integrate them with the decision tree system.

## Webhook URL

```
POST https://your-domain.com/api/webhook/trade-signal
```

## TradingView Alert Message Format

Configure your TradingView alert with this JSON format:

```json
{
  "action": "{{alert_message}}",
  "symbol": "{{ticker}}",
  "timeframe": "{{interval}}",
  "time": "{{time}}",
  "entry": "{{plot("Entry")}}",
  "target": "{{plot("Target")}}",
  "stop": "{{plot("Stop")}}",
  "id": "{{plot("TradeID")}}",
  "rr": "{{plot("RR")}}",
  "risk": "{{plot("Risk")}}"
}
```

## Signal Processing Flow

### 1. Signal Validation
- **Required Fields**: All fields must be present and non-empty
- **TradeID Uniqueness**: Each `id` should be unique for new trades
- **Data Types**: 
  - `risk`, `entry`, `target`, `stop` must be numeric
  - `action` must be one of: `buy`, `sell`, `long`, `short`

### 2. Session Management
- **New Trade**: If `id` doesn't exist → Creates new session
- **Existing Trade**: If `id` exists → Continues existing session
- **Default Settings**: Initial amount $100,000, starts at Level 1 (0.65% stake)

### 3. Trade Amount Calculation
```
Trade Amount = Initial Amount × Current Node Stake Percentage
```

**Example**: Level 1 (0.65%) with $100,000 = $650 trade amount

### 4. Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Trade signal processed successfully",
  "data": {
    "session_id": "ses_1234567890_abc123",
    "trade_id": "TV_SIGNAL_001",
    "symbol": "BTCUSDT",
    "action": "buy",
    "entry": "45000.50",
    "target": "46000.00",
    "stop": "44500.00",
    "trade_amount": 650,
    "current_node": "Start",
    "timeframe": "1h",
    "time": "2024-01-15 10:30:00",
    "rr": "2.5",
    "risk": "1.5",
    "initial_amount": 100000,
    "node_stake_percentage": "0.65%"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid signal format",
  "details": ["Missing required field: action", "Risk must be a numeric value"]
}
```

## Database Schema

### Trade Signals Table
```sql
CREATE TABLE trade_signals (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    trade_id VARCHAR(100) UNIQUE NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    action VARCHAR(10) NOT NULL,
    entry_price DECIMAL(20, 8),
    target_price DECIMAL(20, 8),
    stop_price DECIMAL(20, 8),
    trade_amount INTEGER NOT NULL,
    current_node VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10),
    time VARCHAR(50),
    rr VARCHAR(20),
    risk DECIMAL(10, 4),
    initial_amount INTEGER NOT NULL,
    node_stake_percentage VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Setup Instructions

### 1. Database Setup
Run the SQL script to create the trade_signals table:
```bash
psql "YOUR_DATABASE_URL" -f scripts/003-create-trade-signals-table.sql
```

### 2. Environment Configuration
Ensure your `.env.local` file has the database URL:
```env
DATABASE_URL="postgres://username:password@hostname:5432/database"
```

### 3. Start the Application
```bash
npm run dev
```

### 4. Test the Webhook
```bash
node scripts/test-webhook.js
```

## TradingView Configuration

### Alert Settings
1. **Condition**: Your trading strategy condition
2. **Actions**: Webhook URL
3. **Webhook URL**: `https://your-domain.com/api/webhook/trade-signal`
4. **Message**: Use the JSON format above

### Required TradingView Plots
Make sure your TradingView script includes these plots:
- `plot("Entry", entry_price)`
- `plot("Target", target_price)`
- `plot("Stop", stop_loss)`
- `plot("TradeID", trade_id)`
- `plot("RR", risk_reward_ratio)`
- `plot("Risk", risk_percentage)`

## Decision Tree Integration

### Automatic Session Creation
- Each new trade signal creates a new session
- Session starts at Level 1 (0.65% stake)
- Trade amount calculated based on decision tree node

### Session Continuation
- Existing trades continue in the same session
- Maintains decision tree progression
- Tracks cumulative performance

### Risk Management
- Trade amounts automatically calculated
- Based on decision tree stake percentages
- Integrates with existing risk management system

## Error Handling

### Common Errors
1. **Invalid JSON**: Malformed request body
2. **Missing Fields**: Required fields not provided
3. **Invalid Data Types**: Non-numeric values where expected
4. **Database Errors**: Connection or query issues

### Error Responses
- **400**: Bad Request (validation errors)
- **500**: Internal Server Error (processing errors)
- **503**: Service Unavailable (database not configured)

## Monitoring and Logging

### Console Logs
The webhook provides detailed logging:
- Signal reception
- Validation results
- Session creation/continuation
- Database operations
- Error details

### Health Check
Test webhook availability:
```bash
curl https://your-domain.com/api/webhook/trade-signal
```

## Security Considerations

### Rate Limiting
Consider implementing rate limiting for production use.

### Authentication
For production, consider adding API key authentication.

### Input Validation
All inputs are validated to prevent injection attacks.

## Troubleshooting

### Common Issues
1. **Database Connection**: Check DATABASE_URL in .env.local
2. **Table Missing**: Run the SQL setup script
3. **Invalid Signal**: Check TradingView alert format
4. **Port Issues**: Ensure port 3000 is available for testing

### Debug Mode
Enable detailed logging by checking console output during signal processing. 