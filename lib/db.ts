import { neon } from "@neondatabase/serverless"

let sql: any = null

try {
  // Try different environment variable names that might be available
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL

  if (dbUrl) {
    sql = neon(dbUrl)
    console.log("Database initialized with URL:", dbUrl.substring(0, 20) + "...")
  } else {
    console.warn("No database URL found in environment variables")
  }
} catch (error) {
  console.error("Failed to initialize database connection:", error)
}

// Test the connection
export async function testConnection() {
  try {
    if (!sql) {
      throw new Error("Database not initialized - no DATABASE_URL found")
    }
    await sql`SELECT 1 as test`
    console.log("Database connection successful")
    return true
  } catch (error) {
    console.error("Database connection failed:", error)
    return false
  }
}

export { sql }
