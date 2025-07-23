# Database Setup Guide

## Option 1: PostgreSQL Setup (Recommended for Production)

### 1. Install PostgreSQL

-   Download and install PostgreSQL from https://www.postgresql.org/download/
-   During installation, remember the password you set for the `postgres` user
-   Default port is usually 5432

### 2. Create Database and User

After PostgreSQL is installed and running, open pgAdmin or use the command line:

```sql
-- Run the setup-database.sql file or execute these commands:
CREATE DATABASE lol_analytics;
CREATE USER lol_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE lol_analytics TO lol_user;

-- Connect to the lol_analytics database
\c lol_analytics;
GRANT ALL ON SCHEMA public TO lol_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lol_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lol_user;
```

### 3. Update Environment Variables

Update your `.env.local` file with the correct database URL:

```
DATABASE_URL="postgresql://lol_user:your_secure_password@localhost:5432/lol_analytics?schema=public"
```

### 4. Run Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Option 2: SQLite Setup (Quick Development)

If you want to get started quickly without setting up PostgreSQL, you can use
SQLite:

### 1. Update Prisma Schema

Change the datasource in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### 2. Update Environment Variables

Update your `.env.local` file:

```
DATABASE_URL="file:./dev.db"
```

### 3. Run Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

## Option 3: Docker PostgreSQL (Alternative)

If you have Docker installed, you can run PostgreSQL in a container:

```bash
docker run --name lol-postgres -e POSTGRES_PASSWORD=your_secure_password -e POSTGRES_DB=lol_analytics -e POSTGRES_USER=lol_user -p 5432:5432 -d postgres:15
```

Then use the same DATABASE_URL as in Option 1.

## Testing the Setup

After setting up the database, you can test the connection:

```bash
npx prisma db push
npx prisma studio
```

This will open Prisma Studio where you can view and manage your database.

## Next Steps

1. Start your Next.js development server: `npm run dev`
2. Test the API endpoints:
    - `/api/lol/account?riotIdGameName=YourName&tagline=NA1&region=NA1`
    - `/api/lol/matches?puuid=YOUR_PUUID&region=na1`
    - `/api/lol/stats/SUMMONER_ID`

The application will now store match data in the database and provide caching
for better performance.
