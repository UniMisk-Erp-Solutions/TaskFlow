-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access"
ON tasks FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  )
);

-- Employee: only their tasks
CREATE POLICY "Employee read own"
ON tasks FOR SELECT
TO authenticated
USING (assignee_id = auth.uid());

CREATE POLICY "Employee update own"
ON tasks FOR UPDATE
TO authenticated
USING (assignee_id = auth.uid());