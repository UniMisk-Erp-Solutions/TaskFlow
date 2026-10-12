import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, GripVertical, Search } from 'lucide-react';
import { formatDate } from '../lib/dateFormat';
import { KANBAN_COLUMNS, compareKanbanTasks, kanbanColumnForTask, priorityColor } from '../lib/kanban';
import StatusBadge, { PriorityBadge } from './StatusBadge';

function assigneeIds(task) {
  return task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : [];
}

function BoardCard({ task, profileById, onOpen, onMove, onDragStart, onTouchDragStart }) {
  const lane = kanbanColumnForTask(task);
  const names = assigneeIds(task).map((id) => profileById?.[id] || id.slice(0, 8));
  const locked = task.status === 'completed' || task.status === 'submitted';

  return (
    <article
      className="kanban-card"
      draggable={!locked}
      onDragStart={(event) => onDragStart(event, task)}
      onDragEnd={() => onDragStart(null, null)}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(task);
        } else if (!locked && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault();
          const currentIndex = KANBAN_COLUMNS.findIndex((column) => column.id === lane);
          const targetIndex = currentIndex + (event.key === 'ArrowRight' ? 1 : -1);
          if (targetIndex >= 0 && targetIndex < KANBAN_COLUMNS.length) {
            onMove(task, KANBAN_COLUMNS[targetIndex].id);
          }
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}, ${task.priority || 'medium'} priority. Open task details.`}
      style={{ '--kanban-priority': priorityColor(task.priority) }}
    >
      <div className="kanban-card-topline">
        <span className="kanban-priority-label"><PriorityBadge priority={task.priority} /></span>
        {!locked && <GripVertical
          size={15}
          aria-hidden="true"
          className="kanban-grip"
          onPointerDown={(event) => onTouchDragStart(event, task)}
          title="Drag to move task"
        />}
      </div>
      <h3 className="kanban-card-title">{task.title}</h3>
      {task.project_name && <div className="kanban-project">{task.project_name}</div>}

      <div className="kanban-card-meta">
        <div className="kanban-assignees" title={names.join(', ') || 'Unassigned'}>
          <span className="kanban-meta-label">Assigned</span>
          <span className="kanban-meta-value">{names.length ? names.join(', ') : 'Unassigned'}</span>
        </div>
        {task.due_date && (
          <div className="kanban-due">
            <CalendarDays size={14} aria-hidden="true" />
            <span>{formatDate(task.due_date)}</span>
          </div>
        )}
      </div>

      {(task.status === 'submitted' || task.status === 'rejected' || task.status === 'blocked' || task.status === 'changes_requested') && (
        <div className="kanban-workflow-status"><StatusBadge status={task.status} /></div>
      )}

    </article>
  );
}

export default function KanbanBoard({
  tasks = [],
  projects = [],
  assignees = [],
  profileById = {},
  loading = false,
  onMoveTask,
  onOpenTask,
}) {
  const [filters, setFilters] = useState({ search: '', project: '', priority: '', assignee: '' });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [error, setError] = useState('');
  const touchDragCleanup = useRef(null);

  useEffect(() => () => touchDragCleanup.current?.(), []);

  const filteredTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (search && !`${task.title || ''} ${task.description || ''} ${task.project_name || ''}`.toLowerCase().includes(search)) return false;
      if (filters.project && task.project_id !== filters.project) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assignee && !assigneeIds(task).includes(filters.assignee)) return false;
      return true;
    });
  }, [tasks, filters]);

  const visibleByColumn = useMemo(() => {
    const grouped = Object.fromEntries(KANBAN_COLUMNS.map((column) => [column.id, []]));
    filteredTasks.forEach((task) => grouped[kanbanColumnForTask(task)].push(task));
    Object.values(grouped).forEach((columnTasks) => columnTasks.sort(compareKanbanTasks));
    return grouped;
  }, [filteredTasks]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleDragStart(event, task) {
    if (!task) {
      setDraggedTaskId(null);
      setOverColumn(null);
      return;
    }
    setDraggedTaskId(task.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
  }

  function nextOrder(columnId, beforeTaskId, movingTaskId) {
    const siblings = tasks
      .filter((task) => kanbanColumnForTask(task) === columnId && task.id !== movingTaskId)
      .sort(compareKanbanTasks);
    const targetIndex = beforeTaskId ? siblings.findIndex((task) => task.id === beforeTaskId) : -1;
    if (targetIndex === -1) return (siblings.at(-1)?.kanban_order ?? 0) + 1024;
    const upper = Number(siblings[targetIndex].kanban_order) || 0;
    const lower = targetIndex > 0 ? Number(siblings[targetIndex - 1].kanban_order) || 0 : upper - 2048;
    return (lower + upper) / 2;
  }

  async function commitMove(taskId, columnId, beforeTaskId = null) {
    if (!taskId || !columnId) return;
    const order = nextOrder(columnId, beforeTaskId, taskId);
    setError('');
    try {
      await onMoveTask(taskId, columnId, order);
    } catch (moveError) {
      setError(moveError?.response?.data?.error || moveError?.message || 'Could not move this task. Your board was restored.');
    } finally {
      setDraggedTaskId(null);
      setOverColumn(null);
    }
  }

  function taskIdFromDrop(event) {
    return event.dataTransfer.getData('text/plain') || draggedTaskId;
  }

  function startTouchDrag(event, task) {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    touchDragCleanup.current?.();
    setDraggedTaskId(task.id);

    const pointerId = event.pointerId;
    const removeListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', removeListeners);
      if (touchDragCleanup.current === removeListeners) touchDragCleanup.current = null;
    };
    const onPointerMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const lane = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-kanban-column]');
      setOverColumn(lane?.getAttribute('data-kanban-column') || null);
    };
    const onPointerUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      removeListeners();
      const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      const lane = target?.closest('[data-kanban-column]');
      const before = target?.closest('[data-kanban-task]');
      const columnId = lane?.getAttribute('data-kanban-column');
      const beforeTaskId = before?.getAttribute('data-kanban-task');
      if (columnId) void commitMove(task.id, columnId, beforeTaskId && beforeTaskId !== task.id ? beforeTaskId : null);
      else {
        setDraggedTaskId(null);
        setOverColumn(null);
      }
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', removeListeners);
    touchDragCleanup.current = removeListeners;
  }

  function handleColumnDrop(event, columnId) {
    event.preventDefault();
    event.stopPropagation();
    void commitMove(taskIdFromDrop(event), columnId);
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><span className="spinner" /></div>;
  }

  return (
    <section className="kanban-shell" aria-label="Task Kanban board">
      <div className="kanban-toolbar">
        <label className="kanban-search">
          <Search size={16} aria-hidden="true" />
          <input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
        </label>
        <select value={filters.project} onChange={(event) => setFilter('project', event.target.value)} aria-label="Filter by project">
          <option value="">All projects</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        <select value={filters.assignee} onChange={(event) => setFilter('assignee', event.target.value)} aria-label="Filter by assignee">
          <option value="">All assignees</option>
          {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.full_name || assignee.email}</option>)}
        </select>
        <span className="kanban-result-count">{filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}</span>
      </div>

      {error && (
        <div className="kanban-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">Dismiss</button>
        </div>
      )}

      <div className="kanban-board">
        {KANBAN_COLUMNS.map((column) => {
          const columnTasks = visibleByColumn[column.id];
          return (
            <section
              key={column.id}
              className={`kanban-column${overColumn === column.id ? ' is-drop-target' : ''}`}
              data-kanban-column={column.id}
              onDragOver={(event) => { event.preventDefault(); setOverColumn(column.id); }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOverColumn(null);
              }}
              onDrop={(event) => handleColumnDrop(event, column.id)}
              aria-label={`${column.label}, ${columnTasks.length} tasks`}
              style={{ '--kanban-lane-accent': column.accent }}
            >
              <header className="kanban-column-heading">
                <div>
                  <h2>{column.label}<span className="kanban-count">{columnTasks.length}</span></h2>
                  <p>{column.description}</p>
                </div>
              </header>
              <div className="kanban-column-cards">
                {columnTasks.length ? columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="kanban-drop-before"
                    data-kanban-task={task.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void commitMove(taskIdFromDrop(event), column.id, task.id);
                    }}
                  >
                    <BoardCard
                      task={task}
                      profileById={profileById}
                      onOpen={onOpenTask}
                      onMove={(item, nextColumn) => void commitMove(item.id, nextColumn)}
                      onDragStart={handleDragStart}
                      onTouchDragStart={startTouchDrag}
                    />
                  </div>
                )) : (
                  <div className="kanban-empty">
                    {tasks.length ? 'No tasks match these filters.' : 'No tasks in this column yet. Drop a task here when it is ready.'}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="kanban-hint">Drag a card to change its lane. Use the card menu to move tasks on touch screens. Task priority colors: high red, medium blue, low yellow.</p>
    </section>
  );
}
