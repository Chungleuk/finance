// Test database connection script
// Run with: node scripts/test-db.js

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function testDatabaseConnection() {
  console.log('Testing database connection...\n');
  
  // Check environment variables
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  
  if (!dbUrl) {
    console.error('❌ No DATABASE_URL found in environment variables');
    console.log('\nPlease create a .env.local file with your DATABASE_URL');
    console.log('Example: DATABASE_URL="postgresql://username:password@hostname:5432/database"');
    return;
  }
  
  console.log('✅ Found DATABASE_URL');
  console.log('URL format:', dbUrl.substring(0, 20) + '...');
  
  try {
    // Test connection
    const sql = neon(dbUrl);
    const result = await sql`SELECT 1 as test, current_timestamp as time`;
    
    console.log('✅ Database connection successful!');
    console.log('Test query result:', result[0]);
    
    // Test if tables exist
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('sessions', 'session_steps')
        ORDER BY table_name
      `;
      
      console.log('\n📋 Existing tables:');
      if (tables.length === 0) {
        console.log('   No tables found. You may need to run the SQL scripts.');
        console.log('   Run: psql "YOUR_DATABASE_URL" -f scripts/001-create-tables.sql');
        console.log('   Run: psql "YOUR_DATABASE_URL" -f scripts/002-add-session-name.sql');
      } else {
        tables.forEach(table => {
          console.log(`   ✅ ${table.table_name}`);
        });
      }
      
    } catch (tableError) {
      console.log('⚠️  Could not check tables (this is normal if they don\'t exist yet)');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 This might be an authentication issue. Check your username and password.');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 This might be a hostname issue. Check your database host.');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 This might be a connection issue. Check if your database is running.');
    }
  }
}

testDatabaseConnection(); 