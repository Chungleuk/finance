# Database Setup Guide

## Error: Database not configured

Your application is trying to connect to a Neon Database (PostgreSQL) but the `DATABASE_URL` environment variable is not set.

## Quick Setup Steps

### 1. Create a `.env.local` file

Create a file named `.env.local` in the root of your project with the following content:

```env
# Database Configuration
# Replace this with your actual Neon database URL
DATABASE_URL="postgresql://your-username:your-password@your-hostname:5432/your-database"
```

### 2. Get a Neon Database URL

You have several options:

#### Option A: Use Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Sign up for a free account
3. Create a new project
4. Copy the connection string from your dashboard
5. Replace the placeholder in `.env.local`

#### Option B: Use Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a free account and project
3. Go to Settings > Database
4. Copy the connection string
5. Replace the placeholder in `.env.local`

#### Option C: Use Railway
1. Go to [railway.app](https://railway.app)
2. Create a PostgreSQL database
3. Copy the connection string
4. Replace the placeholder in `.env.local`

### 3. Initialize the Database

After setting up your database URL, run the SQL scripts to create the required tables:

```bash
# If you have psql installed and can connect to your database:
psql "YOUR_DATABASE_URL" -f scripts/001-create-tables.sql
psql "YOUR_DATABASE_URL" -f scripts/002-add-session-name.sql
```

### 4. Test the Connection

Start your development server:

```bash
npm run dev
```

The application should now connect to your database successfully.

## Environment Variables

The application checks for these environment variables in order:
1. `DATABASE_URL` (primary)
2. `POSTGRES_URL` (fallback)
3. `POSTGRES_PRISMA_URL` (fallback)

## Database Schema

The application creates two main tables:
- `sessions`: Stores decision tree session data
- `session_steps`: Stores detailed step-by-step path tracking

See the SQL files in the `scripts/` directory for the complete schema. 