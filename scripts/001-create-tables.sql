-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) UNIQUE NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result VARCHAR(10),
    initial_amount INTEGER NOT NULL,
    final_total INTEGER DEFAULT 0,
    session_notes TEXT,
    duration VARCHAR(20),
    is_completed BOOLEAN DEFAULT FALSE,
    current_node VARCHAR(20) NOT NULL,
    path_summary TEXT,
    session_start_time TIMESTAMP,
    last_action_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create session_steps table for detailed path tracking
CREATE TABLE IF NOT EXISTS session_steps (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(50) REFERENCES sessions(session_id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    node_name VARCHAR(20) NOT NULL,
    action VARCHAR(10) NOT NULL, -- 'start', 'win', 'loss'
    stake_value INTEGER NOT NULL,
    stake_result INTEGER,
    step_timestamp TIMESTAMP NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_completed ON sessions(is_completed);
CREATE INDEX IF NOT EXISTS idx_session_steps_session_id ON session_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp DESC);
