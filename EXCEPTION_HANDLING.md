# 🛡️ Exception Handling System

## Overview

The Decision Tree Tracker implements a comprehensive exception handling system that ensures reliability, data integrity, and graceful degradation when abnormal scenarios occur. This system handles various edge cases and provides robust error recovery mechanisms.

## 🚨 Exception Handling Mechanisms

### 1. TradingView Signal Validation Errors

**Scenario**: TradingView signal lacks key fields (e.g., `id`, `action`, `symbol`)

**Handling Solution**:
- Returns HTTP 400 error with detailed validation messages
- Logs the complete faulty signal content for debugging
- Prevents session creation for invalid signals
- Provides structured error response with validation details

**Example Response**:
```json
{
  "success": false,
  "error": "Signal validation failed: Missing required field: id, Invalid action: invalid_action",
  "details": {
    "signal_content": { /* original signal */ },
    "validation_errors": ["Missing required field: id", "Invalid action: invalid_action"],
    "timestamp": "2024-01-15T10:30:00Z",
    "user_agent": "TradingView-Webhook"
  }
}
```

**Implementation**: `exceptionHandler.handleSignalValidationError()`

### 2. Partial Fill Handling

**Scenario**: Trading platform feedback "partial fill" - only part of the order is executed

**Handling Solution**:
- Updates `trade_amount` according to actual filled amount
- Records partial fill details in database
- Continues decision tree progression based on actual filled amount
- Maintains audit trail of partial fills

**Example**:
```typescript
// Original order: $1,000
// Partial fill: $750 (75% filled)
// System updates trade amount to $750 and proceeds normally
```

**Implementation**: `exceptionHandler.handlePartialFill()`

### 3. Invalid Decision Tree Node Jumps

**Scenario**: Incorrect decision tree node progression (e.g., Level 2 → Level 4)

**Handling Solution**:
- Validates node jumps against defined progression paths
- Triggers automatic rollback to previous valid node
- Requires manual confirmation before proceeding
- Logs rollback actions for audit trail

**Valid Progression Paths**:
```
Start → Level 1
Level 1 → Level 2, Level 3
Level 2 → Level 3, Level 4
Level 3 → Level 4, Level 5
...and so on
```

**Implementation**: `exceptionHandler.validateNodeJump()` and `exceptionHandler.executeRollback()`

### 4. Database Connection Failures

**Scenario**: Database connection failure during signal processing

**Handling Solution**:
- Caches session data locally (maximum 1 hour)
- Implements retry mechanism (up to 3 attempts)
- Performs batch synchronization when connection is restored
- Prevents data loss during outages

**Cache Management**:
- **Storage**: In-memory with persistence capability
- **Timeout**: 1 hour maximum cache duration
- **Retry Logic**: Exponential backoff with max 3 attempts
- **Synchronization**: Automatic batch sync when database is available

**Implementation**: `exceptionHandler.handleDatabaseFailure()` and `exceptionHandler.synchronizeCachedSessions()`

## 🔧 Configuration

### Exception Handler Configuration

```typescript
interface ExceptionHandlingConfig {
  maxRetryCount: number           // Default: 3
  cacheTimeoutMs: number          // Default: 1 hour
  partialFillThreshold: number    // Default: 10%
  nodeJumpValidationEnabled: boolean  // Default: true
  rollbackConfirmationRequired: boolean  // Default: true
}
```

### Custom Configuration Example

```typescript
import { ExceptionHandler } from './lib/exception-handler'

const customHandler = new ExceptionHandler({
  maxRetryCount: 5,
  cacheTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
  partialFillThreshold: 0.05, // 5%
  nodeJumpValidationEnabled: true,
  rollbackConfirmationRequired: false
})
```

## 📊 API Endpoints

### 1. Cache Management API

**GET** `/api/system/cache`
```json
{
  "success": true,
  "data": {
    "cached_sessions": 2,
    "expired_sessions": 0,
    "retry_counts": {
      "ses_123": 1,
      "ses_456": 2
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**POST** `/api/system/cache`
```json
{
  "action": "sync"
}
```

Response:
```json
{
  "success": true,
  "message": "Synchronization complete: 2 synced, 0 failed",
  "data": {
    "synced": 2,
    "failed": 0,
    "details": [
      "Session ses_123 created successfully",
      "Session ses_456 updated successfully"
    ],
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Balance Management API

**GET** `/api/trading/balance`
```json
{
  "success": true,
  "data": {
    "balance": 95000,
    "formatted_balance": "$95,000",
    "currency": "USD",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## 🧪 Testing

### Run Exception Handling Tests

```bash
# Test all exception handling mechanisms
node scripts/test-exception-handling.js

# Test specific scenarios
node -e "
const { testInvalidSignal, testPartialFill } = require('./scripts/test-exception-handling.js')
testInvalidSignal()
"
```

### Test Scenarios Covered

1. **Invalid Signal Validation**
   - Missing required fields
   - Invalid action values
   - Non-numeric risk values

2. **Partial Fill Simulation**
   - Order execution with partial fills
   - Amount updates and database recording

3. **Node Jump Validation**
   - Invalid progression detection
   - Automatic rollback execution

4. **Database Failure Handling**
   - Connection failure simulation
   - Local caching verification

5. **Cache Management**
   - Status retrieval
   - Synchronization testing

6. **Comprehensive Error Handling**
   - End-to-end error scenarios
   - System resilience verification

## 📋 Error Logging and Monitoring

### Log Levels and Categories

- **🚨 CRITICAL**: Signal validation failures, database connection issues
- **⚠️ WARNING**: Partial fills, invalid node jumps
- **💾 INFO**: Cache operations, synchronization events
- **✅ SUCCESS**: Successful operations, rollback completions

### Log Format

```typescript
{
  timestamp: "2024-01-15T10:30:00Z",
  level: "WARNING",
  category: "PARTIAL_FILL",
  message: "Partial fill detected: 75% filled",
  details: {
    sessionId: "ses_123",
    originalAmount: 1000,
    filledAmount: 750,
    fillPercentage: 0.75
  }
}
```

## 🔄 Recovery Procedures

### 1. Database Recovery

When database connection is restored:

1. **Automatic Detection**: System detects database availability
2. **Cache Synchronization**: All cached sessions are synchronized
3. **Data Validation**: Ensures data integrity after sync
4. **Resume Operations**: Normal processing resumes

### 2. Rollback Recovery

When invalid node jumps occur:

1. **Automatic Rollback**: System rolls back to previous valid node
2. **Manual Confirmation**: Requires user confirmation to proceed
3. **Audit Trail**: All rollback actions are logged
4. **Safe Progression**: Only valid node jumps are allowed

### 3. Partial Fill Recovery

When partial fills are detected:

1. **Amount Update**: Trade amount is updated to actual filled amount
2. **Database Recording**: Partial fill details are recorded
3. **Normal Progression**: Decision tree continues with actual amount
4. **Audit Trail**: Complete history of partial fills maintained

## 🛡️ Security Considerations

### Data Protection

- **Encryption**: Sensitive data is encrypted in cache
- **Access Control**: API endpoints require proper authentication
- **Audit Logging**: All operations are logged for security audit
- **Data Retention**: Cached data expires automatically

### Error Information Disclosure

- **Production**: Limited error details to prevent information leakage
- **Development**: Detailed error information for debugging
- **Logging**: Complete error details logged internally
- **User Response**: Sanitized error messages to users

## 📈 Performance Impact

### Exception Handling Overhead

- **Signal Validation**: < 1ms per signal
- **Node Jump Validation**: < 1ms per validation
- **Cache Operations**: < 5ms per operation
- **Database Sync**: < 100ms per session (batch processing)

### Resource Usage

- **Memory**: ~1KB per cached session
- **Storage**: Minimal (in-memory with optional persistence)
- **CPU**: Negligible impact on normal operations
- **Network**: Only during synchronization

## 🔮 Future Enhancements

### Planned Features

1. **Advanced Retry Logic**
   - Exponential backoff with jitter
   - Circuit breaker pattern
   - Graceful degradation

2. **Enhanced Monitoring**
   - Real-time exception dashboard
   - Alert system for critical failures
   - Performance metrics tracking

3. **Machine Learning Integration**
   - Predictive failure detection
   - Automated recovery optimization
   - Pattern recognition for common issues

4. **Distributed Caching**
   - Redis integration for shared cache
   - Multi-node synchronization
   - High availability support

## 📞 Support and Troubleshooting

### Common Issues

1. **Cache Synchronization Failures**
   - Check database connectivity
   - Verify cache timeout settings
   - Review retry count configuration

2. **Rollback Loops**
   - Validate decision tree configuration
   - Check node progression rules
   - Review manual confirmation requirements

3. **Partial Fill Handling Issues**
   - Verify trading platform integration
   - Check amount calculation logic
   - Review database update procedures

### Debugging Tools

```bash
# Check cache status
curl http://localhost:3000/api/system/cache

# Force cache synchronization
curl -X POST http://localhost:3000/api/system/cache \
  -H "Content-Type: application/json" \
  -d '{"action": "sync"}'

# Test exception handling
node scripts/test-exception-handling.js
```

---

This exception handling system ensures the Decision Tree Tracker operates reliably even under adverse conditions, providing robust error recovery and data integrity protection. 