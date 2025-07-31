-- Update session_steps table to support execution and result tracking
-- Add new columns for step_type and execution_status

-- Add step_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'session_steps' AND column_name = 'step_type') THEN
        ALTER TABLE session_steps ADD COLUMN step_type VARCHAR(20) DEFAULT 'DECISION';
    END IF;
END $$;

-- Add execution_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'session_steps' AND column_name = 'execution_status') THEN
        ALTER TABLE session_steps ADD COLUMN execution_status VARCHAR(20);
    END IF;
END $$;

-- Create index for step_type for better performance
CREATE INDEX IF NOT EXISTS idx_session_steps_step_type ON session_steps(step_type);

-- Create index for execution_status for better performance
CREATE INDEX IF NOT EXISTS idx_session_steps_execution_status ON session_steps(execution_status);

-- Update existing records to have proper step_type
UPDATE session_steps 
SET step_type = 'DECISION' 
WHERE step_type IS NULL;

-- Add comments to explain the new columns
COMMENT ON COLUMN session_steps.step_type IS 'Type of step: DECISION, EXECUTE, RESULT';
COMMENT ON COLUMN session_steps.execution_status IS 'Execution status: SUCCESS, FAILED, PENDING, COMPLETED'; 