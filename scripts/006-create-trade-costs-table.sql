-- Create trade_costs table for storing commission, spread, and other trading costs
CREATE TABLE IF NOT EXISTS trade_costs (
    id SERIAL PRIMARY KEY,
    trade_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(50) NOT NULL,
    commission DECIMAL(10, 2) NOT NULL DEFAULT 0,
    spread_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    swap_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_costs DECIMAL(10, 2) NOT NULL DEFAULT 0,
    nominal_amount DECIMAL(15, 2) NOT NULL,
    adjusted_amount DECIMAL(15, 2) NOT NULL,
    cost_breakdown JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trade_costs_trade_id ON trade_costs(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_costs_session_id ON trade_costs(session_id);
CREATE INDEX IF NOT EXISTS idx_trade_costs_created_at ON trade_costs(created_at);

-- Add foreign key constraints
ALTER TABLE trade_costs 
ADD CONSTRAINT fk_trade_costs_trade_signals 
FOREIGN KEY (trade_id) REFERENCES trade_signals(trade_id) ON DELETE CASCADE;

ALTER TABLE trade_costs 
ADD CONSTRAINT fk_trade_costs_sessions 
FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE;

-- Add comments
COMMENT ON TABLE trade_costs IS 'Stores commission, spread, and other trading costs for each trade';
COMMENT ON COLUMN trade_costs.commission IS 'Commission charged by broker';
COMMENT ON COLUMN trade_costs.spread_cost IS 'Cost due to bid-ask spread';
COMMENT ON COLUMN trade_costs.swap_cost IS 'Overnight swap/rollover costs';
COMMENT ON COLUMN trade_costs.total_costs IS 'Total of all trading costs';
COMMENT ON COLUMN trade_costs.nominal_amount IS 'Original trade amount before cost adjustment';
COMMENT ON COLUMN trade_costs.adjusted_amount IS 'Final trade amount after cost adjustment';
COMMENT ON COLUMN trade_costs.cost_breakdown IS 'Detailed breakdown of costs in JSON format'; 