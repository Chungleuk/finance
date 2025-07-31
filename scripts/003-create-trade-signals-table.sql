-- Create trade_signals table for storing TradingView signals
CREATE TABLE IF NOT EXISTS trade_signals (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trade_signals_session_id ON trade_signals(session_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_trade_id ON trade_signals(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_signals_symbol ON trade_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_signals_created_at ON trade_signals(created_at DESC);

-- Add foreign key constraint to link with sessions table
ALTER TABLE trade_signals 
ADD CONSTRAINT fk_trade_signals_session_id 
FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE; 