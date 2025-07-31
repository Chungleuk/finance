-- Add session_name column to sessions table
ALTER TABLE sessions ADD COLUMN session_name VARCHAR(255);

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(session_name);
