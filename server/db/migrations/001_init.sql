CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER NOT NULL UNIQUE,
  login TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT,
  avatar_url TEXT,
  access_token_enc TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_owner TEXT NOT NULL COLLATE NOCASE,
  repo_name TEXT NOT NULL COLLATE NOCASE,
  repo_full_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  title TEXT NOT NULL,
  intro_md TEXT NOT NULL,
  demo_url TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  repo_meta TEXT NOT NULL DEFAULT '{}',
  repo_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status, created_at DESC);

CREATE TABLE evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  model TEXT NOT NULL,
  is_heuristic INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER,
  dimensions TEXT,
  strengths TEXT,
  improvements TEXT,
  summary TEXT,
  tags TEXT,
  error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_eval_project ON evaluations(project_id, id DESC);
CREATE INDEX idx_eval_status ON evaluations(status);

CREATE TABLE star_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  star_given_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, project_id)
);
CREATE INDEX idx_stars_project ON star_events(project_id, star_given_at);
CREATE INDEX idx_stars_week ON star_events(star_given_at);

CREATE TABLE leaderboard_snapshots (
  week_key TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  entries TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
