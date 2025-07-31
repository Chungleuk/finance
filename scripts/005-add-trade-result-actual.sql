-- Migration: Add trade_result_actual field to session_steps table
-- This field records the actual profit/loss amount (distinguished from target value)
-- for subsequent strategy analysis

-- Add the new column
ALTER TABLE session_steps 
ADD COLUMN trade_result_actual DECIMAL(15, 2) DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN session_steps.trade_result_actual IS 'Actual profit/loss amount achieved (distinguished from target value) for strategy analysis';

-- Create index for better query performance on result analysis
CREATE INDEX IF NOT EXISTS idx_session_steps_result_actual 
ON session_steps(trade_result_actual) 
WHERE trade_result_actual IS NOT NULL;

-- Create index for performance analysis queries
CREATE INDEX IF NOT EXISTS idx_session_steps_type_result 
ON session_steps(step_type, trade_result_actual) 
WHERE step_type = 'RESULT';

-- Update existing RESULT steps to have trade_result_actual based on note content
-- This extracts P&L values from existing notes
UPDATE session_steps 
SET trade_result_actual = CASE 
    WHEN note LIKE '%P&L: %' THEN 
        CAST(REGEXP_REPLACE(note, '.*P&L: ([-\d.]+).*', '\1') AS DECIMAL(15, 2))
    ELSE NULL 
END
WHERE step_type = 'RESULT' 
AND trade_result_actual IS NULL;

-- Create a view for easy analysis of profitable vs losing paths
CREATE OR REPLACE VIEW session_performance_analysis AS
SELECT 
    s.session_id,
    s.session_name,
    s.symbol,
    s.current_node,
    s.path_summary,
    s.initial_amount,
    s.final_total,
    s.is_completed,
    s.created_at,
    s.last_action_timestamp,
    COUNT(ss.step_number) as total_steps,
    COUNT(CASE WHEN ss.step_type = 'RESULT' THEN 1 END) as result_steps,
    SUM(CASE WHEN ss.step_type = 'RESULT' THEN COALESCE(ss.trade_result_actual, 0) ELSE 0 END) as total_actual_pnl,
    AVG(CASE WHEN ss.step_type = 'RESULT' THEN ss.trade_result_actual ELSE NULL END) as avg_actual_pnl,
    MAX(CASE WHEN ss.step_type = 'RESULT' THEN ss.trade_result_actual ELSE NULL END) as max_actual_pnl,
    MIN(CASE WHEN ss.step_type = 'RESULT' THEN ss.trade_result_actual ELSE NULL END) as min_actual_pnl,
    CASE 
        WHEN s.final_total > 0 THEN 'PROFITABLE'
        WHEN s.final_total < 0 THEN 'LOSING'
        ELSE 'BREAKEVEN'
    END as session_outcome,
    CASE 
        WHEN s.final_total > 0 THEN 'SUCCESS'
        ELSE 'FAILURE'
    END as session_success
FROM sessions s
LEFT JOIN session_steps ss ON s.session_id = ss.session_id
GROUP BY s.session_id, s.session_name, s.symbol, s.current_node, s.path_summary, 
         s.initial_amount, s.final_total, s.is_completed, s.created_at, s.last_action_timestamp;

-- Create a view for decision tree path analysis
CREATE OR REPLACE VIEW decision_tree_path_analysis AS
SELECT 
    current_node,
    path_summary,
    symbol,
    COUNT(*) as session_count,
    COUNT(CASE WHEN final_total > 0 THEN 1 END) as profitable_sessions,
    COUNT(CASE WHEN final_total <= 0 THEN 1 END) as losing_sessions,
    AVG(final_total) as avg_final_total,
    SUM(final_total) as total_pnl,
    MAX(final_total) as max_profit,
    MIN(final_total) as max_loss,
    AVG(CASE WHEN final_total > 0 THEN final_total ELSE NULL END) as avg_profit,
    AVG(CASE WHEN final_total < 0 THEN final_total ELSE NULL END) as avg_loss,
    ROUND(
        COUNT(CASE WHEN final_total > 0 THEN 1 END) * 100.0 / COUNT(*), 2
    ) as win_rate_percentage,
    ROUND(
        AVG(CASE WHEN final_total > 0 THEN final_total ELSE NULL END) * 
        COUNT(CASE WHEN final_total > 0 THEN 1 END) / 
        ABS(AVG(CASE WHEN final_total < 0 THEN final_total ELSE NULL END) * 
        COUNT(CASE WHEN final_total < 0 THEN 1 END)), 2
    ) as profit_factor
FROM sessions 
WHERE is_completed = true
GROUP BY current_node, path_summary, symbol
ORDER BY avg_final_total DESC;

-- Create a view for symbol and timeframe performance
CREATE OR REPLACE VIEW symbol_timeframe_performance AS
SELECT 
    s.symbol,
    ts.timeframe,
    COUNT(*) as total_signals,
    COUNT(CASE WHEN s.final_total > 0 THEN 1 END) as profitable_sessions,
    COUNT(CASE WHEN s.final_total <= 0 THEN 1 END) as losing_sessions,
    AVG(s.final_total) as avg_pnl,
    SUM(s.final_total) as total_pnl,
    MAX(s.final_total) as max_profit,
    MIN(s.final_total) as max_loss,
    ROUND(
        COUNT(CASE WHEN s.final_total > 0 THEN 1 END) * 100.0 / COUNT(*), 2
    ) as win_rate_percentage,
    AVG(s.initial_amount) as avg_initial_amount,
    AVG(ABS(s.final_total)) as avg_absolute_pnl
FROM sessions s
JOIN trade_signals ts ON s.session_id = ts.session_id
WHERE s.is_completed = true
GROUP BY s.symbol, ts.timeframe
ORDER BY avg_pnl DESC;

-- Add comments for documentation
COMMENT ON VIEW session_performance_analysis IS 'Comprehensive view for analyzing session performance including actual P&L data';
COMMENT ON VIEW decision_tree_path_analysis IS 'Analysis of decision tree paths and their profitability';
COMMENT ON VIEW symbol_timeframe_performance IS 'Performance analysis by symbol and timeframe for strategy optimization';

-- Create function to get high-performance paths
CREATE OR REPLACE FUNCTION get_high_performance_paths(
    min_sessions INTEGER DEFAULT 5,
    min_win_rate DECIMAL DEFAULT 60.0,
    min_profit_factor DECIMAL DEFAULT 1.5
)
RETURNS TABLE (
    path_summary TEXT,
    symbol VARCHAR(20),
    session_count BIGINT,
    win_rate_percentage DECIMAL,
    profit_factor DECIMAL,
    avg_final_total DECIMAL,
    total_pnl DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dtpa.path_summary,
        dtpa.symbol,
        dtpa.session_count,
        dtpa.win_rate_percentage,
        dtpa.profit_factor,
        dtpa.avg_final_total,
        dtpa.total_pnl
    FROM decision_tree_path_analysis dtpa
    WHERE dtpa.session_count >= min_sessions
    AND dtpa.win_rate_percentage >= min_win_rate
    AND dtpa.profit_factor >= min_profit_factor
    ORDER BY dtpa.avg_final_total DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to backup sessions by symbol and timeframe
CREATE OR REPLACE FUNCTION backup_sessions_by_filter(
    target_symbol VARCHAR(20) DEFAULT NULL,
    target_timeframe VARCHAR(10) DEFAULT NULL,
    days_back INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    backup_count INTEGER;
BEGIN
    -- Create backup table with timestamp
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS sessions_backup_%s AS
        SELECT s.*, ts.timeframe
        FROM sessions s
        LEFT JOIN trade_signals ts ON s.session_id = ts.session_id
        WHERE s.created_at >= CURRENT_DATE - INTERVAL ''%s days''
        %s
        %s
    ', 
    to_char(CURRENT_TIMESTAMP, 'YYYYMMDD_HH24MI'),
    days_back,
    CASE WHEN target_symbol IS NOT NULL THEN format('AND s.symbol = %L', target_symbol) ELSE '' END,
    CASE WHEN target_timeframe IS NOT NULL THEN format('AND ts.timeframe = %L', target_timeframe) ELSE '' END
    );
    
    GET DIAGNOSTICS backup_count = ROW_COUNT;
    
    RETURN backup_count;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON session_performance_analysis TO PUBLIC;
GRANT SELECT ON decision_tree_path_analysis TO PUBLIC;
GRANT SELECT ON symbol_timeframe_performance TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_high_performance_paths TO PUBLIC;
GRANT EXECUTE ON FUNCTION backup_sessions_by_filter TO PUBLIC; 