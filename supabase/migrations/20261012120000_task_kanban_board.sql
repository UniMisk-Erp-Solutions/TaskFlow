-- Keep TaskFlow's business status intact while persisting a distinct board lane
-- (Backlog and To Do both map to `pending`) and the user's task ordering.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kanban_column text NOT NULL DEFAULT 'to_do',
  ADD COLUMN IF NOT EXISTS kanban_order double precision NOT NULL DEFAULT 0;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_kanban_column_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_kanban_column_check
  CHECK (kanban_column IN ('backlog', 'to_do', 'in_progress', 'done'));

-- Preserve the meaning of the existing task status values when bringing older
-- work into the board. Submitted work is in Done, but remains submitted until
-- an admin approves it; blocked and changes-requested work returns to Backlog.
UPDATE public.tasks
SET kanban_column = CASE status::text
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'rejected' THEN 'in_progress'
  WHEN 'completed' THEN 'done'
  WHEN 'submitted' THEN 'done'
  WHEN 'blocked' THEN 'backlog'
  WHEN 'changes_requested' THEN 'backlog'
  ELSE 'to_do'
END;

-- Give existing cards stable spacing so future drag-and-drop moves can use
-- fractional positions between adjacent tasks without rewriting the whole board.
WITH ranked AS (
  SELECT id,
         (row_number() OVER (
           PARTITION BY org_id, kanban_column
           ORDER BY created_at ASC NULLS FIRST, id ASC
         ) * 1024)::double precision AS next_order
  FROM public.tasks
)
UPDATE public.tasks AS t
SET kanban_order = ranked.next_order
FROM ranked
WHERE ranked.id = t.id;

CREATE INDEX IF NOT EXISTS tasks_org_kanban_order_idx
  ON public.tasks (org_id, kanban_column, kanban_order);
