-- ENUMS
CREATE TYPE role_enum AS ENUM ('admin', 'employee');
CREATE TYPE priority_enum AS ENUM ('low', 'medium', 'high');
CREATE TYPE status_enum AS ENUM ('pending', 'in_progress', 'completed', 'blocked');

-- PROFILES
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  role role_enum DEFAULT 'employee',
  created_at timestamp DEFAULT now()
);

-- TASKS
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  assignee_id uuid REFERENCES profiles(id),
  priority priority_enum,
  status status_enum DEFAULT 'pending',
  due_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- EMAIL LOGS
CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id),
  recipient_email text,
  type text,
  content text,
  sent_at timestamp DEFAULT now()
);