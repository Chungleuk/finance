import { sql } from "./db"
import type { SessionData } from "./types"

export async function saveSession(sessionData: SessionData): Promise<void> {
  try {
    if (!sql) {
      throw new Error("Database not available - please configure DATABASE_URL")
    }

    console.log("Saving session:", sessionData.sessionId, "isCompleted:", sessionData.isCompleted)

    // Ensure dates are properly converted to Date objects
    const sessionStartTime =
      sessionData.sessionStartTime instanceof Date
        ? sessionData.sessionStartTime
        : new Date(sessionData.sessionStartTime)

    const lastActionTimestamp =
      sessionData.lastActionTimestamp instanceof Date
        ? sessionData.lastActionTimestamp
        : new Date(sessionData.lastActionTimestamp)

    // Check if session_name column exists
    let hasSessionNameColumn = false
    try {
      await sql`SELECT session_name FROM sessions LIMIT 1`
      hasSessionNameColumn = true
    } catch (error) {
      console.log("session_name column not found, using legacy format")
      hasSessionNameColumn = false
    }

    if (hasSessionNameColumn) {
      // Use new format with session_name
      await sql`
        INSERT INTO sessions (
          session_id, session_name, timestamp, result, initial_amount, final_total,
          session_notes, duration, is_completed, current_node, path_summary,
          session_start_time, last_action_timestamp
        ) VALUES (
          ${sessionData.sessionId}, 
          ${sessionData.sessionName || ""}, 
          ${sessionData.timestamp}, 
          ${sessionData.result || ""}, 
          ${sessionData.initialAmount}, 
          ${sessionData.finalTotal}, 
          ${sessionData.sessionNotes || ""}, 
          ${sessionData.duration || ""}, 
          ${sessionData.isCompleted}, 
          ${sessionData.currentNode}, 
          ${sessionData.pathSummary || ""}, 
          ${sessionStartTime.toISOString()}, 
          ${lastActionTimestamp.toISOString()}
        )
        ON CONFLICT (session_id) DO UPDATE SET
          session_name = EXCLUDED.session_name,
          timestamp = EXCLUDED.timestamp,
          result = EXCLUDED.result,
          final_total = EXCLUDED.final_total,
          session_notes = EXCLUDED.session_notes,
          duration = EXCLUDED.duration,
          is_completed = EXCLUDED.is_completed,
          current_node = EXCLUDED.current_node,
          path_summary = EXCLUDED.path_summary,
          last_action_timestamp = EXCLUDED.last_action_timestamp,
          updated_at = CURRENT_TIMESTAMP
      `
    } else {
      // Use legacy format without session_name
      await sql`
        INSERT INTO sessions (
          session_id, timestamp, result, initial_amount, final_total,
          session_notes, duration, is_completed, current_node, path_summary,
          session_start_time, last_action_timestamp
        ) VALUES (
          ${sessionData.sessionId}, 
          ${sessionData.timestamp}, 
          ${sessionData.result || ""}, 
          ${sessionData.initialAmount}, 
          ${sessionData.finalTotal}, 
          ${sessionData.sessionNotes || ""}, 
          ${sessionData.duration || ""}, 
          ${sessionData.isCompleted}, 
          ${sessionData.currentNode}, 
          ${sessionData.pathSummary || ""}, 
          ${sessionStartTime.toISOString()}, 
          ${lastActionTimestamp.toISOString()}
        )
        ON CONFLICT (session_id) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          result = EXCLUDED.result,
          final_total = EXCLUDED.final_total,
          session_notes = EXCLUDED.session_notes,
          duration = EXCLUDED.duration,
          is_completed = EXCLUDED.is_completed,
          current_node = EXCLUDED.current_node,
          path_summary = EXCLUDED.path_summary,
          last_action_timestamp = EXCLUDED.last_action_timestamp,
          updated_at = CURRENT_TIMESTAMP
      `
    }

    // Delete existing steps for this session
    await sql`DELETE FROM session_steps WHERE session_id = ${sessionData.sessionId}`

    // Insert new steps
    if (sessionData.pathValues && sessionData.pathValues.length > 0) {
      for (let i = 0; i < sessionData.pathValues.length; i++) {
        const step = sessionData.pathValues[i]
        console.log(`Inserting step ${i + 1}:`, step.node, step.action)

        // Ensure step timestamp is a Date object
        const stepTimestamp = step.timestamp instanceof Date ? step.timestamp : new Date(step.timestamp)

        await sql`
          INSERT INTO session_steps (
            session_id, step_number, node_name, action, stake_value,
            stake_result, step_timestamp, note
          ) VALUES (
            ${sessionData.sessionId}, 
            ${i + 1}, 
            ${step.node}, 
            ${step.action}, 
            ${step.value}, 
            ${step.stakeResult || null}, 
            ${stepTimestamp.toISOString()}, 
            ${step.note || ""}
          )
        `
      }
    }

    console.log("Session saved successfully")
  } catch (error) {
    console.error("Error saving session:", error)
    throw new Error(`Failed to save session: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function getSessionHistory(
  limit = 20,
  includeIncomplete = false,
  searchTerm = "",
  dateFrom = "",
  dateTo = "",
  resultFilter = "",
) {
  try {
    if (!sql) {
      console.warn("Database not available, returning empty array")
      return []
    }

    // Check if session_name column exists
    let hasSessionNameColumn = false
    try {
      await sql`SELECT session_name FROM sessions LIMIT 1`
      hasSessionNameColumn = true
    } catch (error) {
      console.log("session_name column not found, using legacy format")
      hasSessionNameColumn = false
    }

    console.log(
      `Filtering sessions with: includeIncomplete=${includeIncomplete}, searchTerm="${searchTerm}", dateFrom="${dateFrom}", dateTo="${dateTo}", resultFilter="${resultFilter}"`,
    )

    let sessions

    // Handle different query scenarios with explicit conditional queries
    if (hasSessionNameColumn) {
      // With session_name column
      if (includeIncomplete && searchTerm && dateFrom && dateTo && resultFilter && resultFilter !== "all") {
        // All filters
        sessions = await sql`
          SELECT session_id, session_name, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE (session_name ILIKE ${`%${searchTerm}%`} OR session_notes ILIKE ${`%${searchTerm}%`})
            AND DATE(created_at) >= ${dateFrom}
            AND DATE(created_at) <= ${dateTo}
            AND result = ${resultFilter === "win" ? "WIN" : "LOST"}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (!includeIncomplete && searchTerm && dateFrom && dateTo && resultFilter && resultFilter !== "all") {
        // All filters except incomplete
        sessions = await sql`
          SELECT session_id, session_name, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
            AND (session_name ILIKE ${`%${searchTerm}%`} OR session_notes ILIKE ${`%${searchTerm}%`})
            AND DATE(created_at) >= ${dateFrom}
            AND DATE(created_at) <= ${dateTo}
            AND result = ${resultFilter === "win" ? "WIN" : "LOST"}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (!includeIncomplete && searchTerm) {
        // Completed sessions with search
        sessions = await sql`
          SELECT session_id, session_name, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
            AND (session_name ILIKE ${`%${searchTerm}%`} OR session_notes ILIKE ${`%${searchTerm}%`})
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (!includeIncomplete && dateFrom) {
        // Completed sessions with date filter
        sessions = await sql`
          SELECT session_id, session_name, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
            AND DATE(created_at) >= ${dateFrom}
            ${dateTo ? sql`AND DATE(created_at) <= ${dateTo}` : sql``}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (!includeIncomplete && resultFilter && resultFilter !== "all") {
        // Completed sessions with result filter
        sessions = await sql`
          SELECT session_id, session_name, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
            AND result = ${resultFilter === "win" ? "WIN" : "LOST"}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (includeIncomplete) {
        // All sessions
        sessions = await sql`
          SELECT session_id, session_name, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else {
        // Default: completed sessions only
        sessions = await sql`
          SELECT session_id, session_name, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      }
    } else {
      // Without session_name column (legacy)
      if (!includeIncomplete && searchTerm) {
        // Completed sessions with search (notes only)
        sessions = await sql`
          SELECT session_id, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
            AND session_notes ILIKE ${`%${searchTerm}%`}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (!includeIncomplete && dateFrom) {
        // Completed sessions with date filter
        sessions = await sql`
          SELECT session_id, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
            AND DATE(created_at) >= ${dateFrom}
            ${dateTo ? sql`AND DATE(created_at) <= ${dateTo}` : sql``}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (!includeIncomplete && resultFilter && resultFilter !== "all") {
        // Completed sessions with result filter
        sessions = await sql`
          SELECT session_id, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
            AND result = ${resultFilter === "win" ? "WIN" : "LOST"}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else if (includeIncomplete) {
        // All sessions
        sessions = await sql`
          SELECT session_id, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      } else {
        // Default: completed sessions only
        sessions = await sql`
          SELECT session_id, timestamp, result, initial_amount, final_total, session_notes, duration, is_completed, current_node, path_summary, created_at
          FROM sessions 
          WHERE is_completed = true
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      }
    }

    // Ensure sessions is always an array
    if (!Array.isArray(sessions)) {
      console.warn("Query result is not an array:", typeof sessions)
      return []
    }

    console.log(`Retrieved ${sessions.length} sessions from database`)

    return sessions.map((session) => ({
      ...session,
      session_name: session.session_name || null, // Ensure this field exists even if column doesn't
      stepData: [], // We'll add step data later if needed
    }))
  } catch (error) {
    console.error("Error getting session history:", error)
    // Return empty array instead of throwing to prevent UI crashes
    return []
  }
}

export async function getIncompleteSession(sessionId: string) {
  try {
    if (!sql) {
      return null
    }

    const result = await sql`
      SELECT * FROM sessions
      WHERE session_id = ${sessionId} AND is_completed = false
      LIMIT 1
    `

    return result[0] || null
  } catch (error) {
    console.error("Error getting incomplete session:", error)
    return null
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }
    await sql`DELETE FROM sessions WHERE session_id = ${sessionId}`
  } catch (error) {
    console.error("Error deleting session:", error)
    throw new Error("Failed to delete session")
  }
}

export async function updateSessionNotes(sessionId: string, notes: string): Promise<void> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }
    await sql`
      UPDATE sessions 
      SET session_notes = ${notes}, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ${sessionId}
    `
  } catch (error) {
    console.error("Error updating session notes:", error)
    throw new Error("Failed to update session notes")
  }
}

export async function updateSessionName(sessionId: string, name: string): Promise<void> {
  try {
    if (!sql) {
      throw new Error("Database not available")
    }

    // Check if session_name column exists
    try {
      await sql`SELECT session_name FROM sessions LIMIT 1`
      // Column exists, proceed with update
      await sql`
        UPDATE sessions 
        SET session_name = ${name}, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ${sessionId}
      `
    } catch (error) {
      console.log("session_name column not found, cannot update session name")
      throw new Error("Session naming feature requires database migration. Please run the migration script.")
    }
  } catch (error) {
    console.error("Error updating session name:", error)
    throw new Error("Failed to update session name")
  }
}
