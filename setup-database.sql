-- Run this in PostgreSQL command line or pgAdmin to set up the database
-- Make sure PostgreSQL is installed and running first

CREATE DATABASE lol_analytics;
CREATE USER lol_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE lol_analytics TO lol_user;

-- Connect to the lol_analytics database and grant schema permissions
\c lol_analytics;
GRANT ALL ON SCHEMA public TO lol_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lol_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lol_user;