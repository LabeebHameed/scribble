import postgres from "postgres"
import { getMigrateDatabaseUrl } from "./env"

const ddl = `
CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'done', 'dropped');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE priority AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE energy_level AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE flexibility AS ENUM ('rigid', 'soft', 'highly_flexible');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE preference_strength AS ENUM ('hard', 'soft');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE capture_status AS ENUM ('pending', 'confirmed', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE reminder_stage AS ENUM ('day_before', 'prep', 'action', 'final', 'nag');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE reminder_status AS ENUM ('scheduled', 'sent', 'acknowledged', 'snoozed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE block_kind AS ENUM ('task', 'event', 'routine', 'break', 'buffer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  password_hash text NOT NULL,
  tone text DEFAULT 'calm',
  notification_rules jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status task_status NOT NULL DEFAULT 'open',
  priority priority NOT NULL DEFAULT 'medium',
  energy_cost energy_level,
  estimated_duration integer,
  deadline timestamptz,
  preferred_windows jsonb DEFAULT '[]'::jsonb,
  project text,
  area text,
  parent_task_id uuid,
  source_capture_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  start timestamptz NOT NULL,
  "end" timestamptz NOT NULL,
  location text,
  link text,
  notes text,
  is_fixed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  preferred_windows jsonb DEFAULT '[]'::jsonb,
  min_duration integer,
  ideal_duration integer,
  max_duration integer,
  priority priority NOT NULL DEFAULT 'medium',
  recurrence_rule text,
  energy_profile energy_level,
  flexibility flexibility NOT NULL DEFAULT 'soft',
  checklist jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS energy_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level energy_level NOT NULL,
  notes text,
  affects_hours integer NOT NULL DEFAULT 4,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  strength preference_strength NOT NULL DEFAULT 'soft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  status capture_status NOT NULL DEFAULT 'pending',
  extracted jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS life_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  content_hash text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS embeddings (
  chunk_id uuid PRIMARY KEY REFERENCES memory_chunks(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,
  dims integer NOT NULL DEFAULT 384
);

CREATE TABLE IF NOT EXISTS scheduled_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind block_kind NOT NULL,
  title text NOT NULL,
  start timestamptz NOT NULL,
  "end" timestamptz NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  routine_id uuid REFERENCES routines(id) ON DELETE SET NULL,
  is_proposal boolean NOT NULL DEFAULT false,
  accepted boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_chains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  action_language text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  persistent_nag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES reminder_chains(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage reminder_stage NOT NULL,
  status reminder_status NOT NULL DEFAULT 'scheduled',
  fire_at timestamptz NOT NULL,
  snoozed_until timestamptz,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_people (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, person_id)
);

CREATE TABLE IF NOT EXISTS event_people (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, person_id)
);

CREATE TABLE IF NOT EXISTS event_prep_tasks (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, task_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS memory_chunks_user_idx ON memory_chunks(user_id);
CREATE INDEX IF NOT EXISTS memory_chunks_hash_idx ON memory_chunks(content_hash);

CREATE INDEX IF NOT EXISTS memory_chunks_fts_idx ON memory_chunks USING gin (to_tsvector('english', content));
`

function sslOption(url: string) {
  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    return "require" as const
  }
  return undefined
}

export async function runMigrations() {
  const url = getMigrateDatabaseUrl()
  if (!url) {
    throw new Error("No database URL found. Set DATABASE_URL or POSTGRES_URL from Neon.")
  }

  const sql = postgres(url, {
    max: 1,
    prepare: false,
    ssl: sslOption(url),
  })

  try {
    await sql.unsafe(ddl)
  } finally {
    await sql.end({ timeout: 5 })
  }
}
