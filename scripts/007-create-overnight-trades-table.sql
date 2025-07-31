-- Create overnight_trades table for managing trades that need to be closed before 3 AM HK time
CREATE TABLE IF NOT EXISTS overnight_trades (
    id SERIAL PRIMARY KEY,
    trade_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    entry_price DECIMAL(20, 8) NOT NULL,
    target_price DECIMAL(20, 8) NOT NULL,
    stop_price DECIMAL(20, 8) NOT NULL,
    trade_amount DECIMAL(15, 2) NOT NULL,
    current_node VARCHAR(20) NOT NULL,
    previous_node VARCHAR(20) NOT NULL,
    entry_time TIMESTAMP NOT NULL,
    overnight_close_enabled BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'active',
    close_reason VARCHAR(30),
    close_time TIMESTAMP,
    profit_loss DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_overnight_trades_trade_id ON overnight_trades(trade_id);
CREATE INDEX IF NOT EXISTS idx_overnight_trades_session_id ON overnight_trades(session_id);
CREATE INDEX IF NOT EXISTS idx_overnight_trades_status ON overnight_trades(status);
CREATE INDEX IF NOT EXISTS idx_overnight_trades_entry_time ON overnight_trades(entry_time);
CREATE INDEX IF NOT EXISTS idx_overnight_trades_active_enabled ON overnight_trades(status, overnight_close_enabled) WHERE status = 'active' AND overnight_close_enabled = TRUE;

-- Add foreign key constraints
ALTER TABLE overnight_trades 
ADD CONSTRAINT fk_overnight_trades_trade_signals 
FOREIGN KEY (trade_id) REFERENCES trade_signals(trade_id) ON DELETE CASCADE;

ALTER TABLE overnight_trades 
ADD CONSTRAINT fk_overnight_trades_sessions 
FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE;

-- Add comments
COMMENT ON TABLE overnight_trades IS 'Tracks trades that need to be closed before 3 AM HK time to prevent overnight swap fees';
COMMENT ON COLUMN overnight_trades.trade_id IS 'Unique trade identifier';
COMMENT ON COLUMN overnight_trades.session_id IS 'Session identifier for decision tree tracking';
COMMENT ON COLUMN overnight_trades.symbol IS 'Trading symbol (e.g., BTCUSDT)';
COMMENT ON COLUMN overnight_trades.entry_price IS 'Trade entry price';
COMMENT ON COLUMN overnight_trades.target_price IS 'Take profit target price';
COMMENT ON COLUMN overnight_trades.stop_price IS 'Stop loss price';
COMMENT ON COLUMN overnight_trades.trade_amount IS 'Trade amount in base currency';
COMMENT ON COLUMN overnight_trades.current_node IS 'Current decision tree node';
COMMENT ON COLUMN overnight_trades.previous_node IS 'Previous decision tree node for rollback';
COMMENT ON COLUMN overnight_trades.entry_time IS 'Trade entry timestamp';
COMMENT ON COLUMN overnight_trades.overnight_close_enabled IS 'Whether overnight close is enabled for this trade';
COMMENT ON COLUMN overnight_trades.status IS 'Trade status: active, closed, rolled_back';
COMMENT ON COLUMN overnight_trades.close_reason IS 'Reason for trade closure: target_reached, stop_reached, overnight_close, manual_close';
COMMENT ON COLUMN overnight_trades.close_time IS 'Trade close timestamp';
COMMENT ON COLUMN overnight_trades.profit_loss IS 'Profit or loss from the trade'; 