-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY, -- e.g., 'wing.user.advogado'
  name TEXT NOT NULL,
  category TEXT DEFAULT 'User',
  system_prompt TEXT NOT NULL,
  manifest JSONB NOT NULL, -- Stores the full manifest JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID -- Optional: Link to auth.users if RLS is enabled later
);

-- Add RLS policies (Optional - Open for now since backend uses Service Key)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON agents FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON agents FOR INSERT WITH CHECK (true); -- Service Key bypasses this anyway
