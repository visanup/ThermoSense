-- database: auth_db;
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON auth.users;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON auth.users
FOR EACH ROW EXECUTE PROCEDURE auth.update_updated_at_column();

CREATE TABLE auth.user_tokens (
    token_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(user_id) ON DELETE CASCADE,
    refresh_token TEXT UNIQUE NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_user_tokens_user_id ON auth.user_tokens(user_id);
CREATE INDEX idx_user_tokens_refresh_token ON auth.user_tokens(refresh_token);
