CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_stars_user_time ON star_events(user_id, star_given_at DESC);
