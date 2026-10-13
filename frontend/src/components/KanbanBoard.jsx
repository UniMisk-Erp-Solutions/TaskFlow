import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, GripVertical, Search } from 'lucide-react';
import { formatDate } from '../lib/dateFormat';
import { KANBAN_COLUMNS, compareKanbanTasks, kanbanColumnForTask, priorityColor } from '../lib/kanban';
import StatusBadge, { PriorityBadge } from './StatusBadge';

function assigneeIds(task) {
  return task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : [];
}

function autoScrollAtPointer(element, clientY) {
  let scrollContainer = element?.parentElement;
  while (scrollContainer && scrollContainer !== document.body) {
    const overflowY = window.getComputedStyle(scrollContainer).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && scrollContainer.scrollHeight > scrollContainer.clientHeight + 1) break;
    scrollContainer = scrollContainer.parentElement;
  }

  if (!scrollContainer) {
    const pageScroller = document.scrollingElement;
    if (pageScroller?.scrollHeight > window.innerHeight + 1) scrollContainer = window;
  }
  if (!scrollContainer) return;

  const bounds = scrollContainer === window
    ? { top: 0, bottom: window.innerHeight }
    : scrollContainer.getBoundingClientRect();
  const edgeSize = 72;
  const fromTop = clientY - bounds.top;
  const fromBottom = bounds.bottom - clientY;
  let delta = 0;
  if (fromBottom < edgeSize) delta = Math.max(4, Math.ceil((edgeSize - fromBottom) / 4));
  else if (fromTop < edgeSize) delta = -Math.max(4, Math.ceil((edgeSize - fromTop) / 4));
  if (!delta) return;

  if (scrollContainer === window) window.scrollBy(0, delta);
  else scrollContainer.scrollBy({ top: delta, behavior: 'auto' });
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
  isAdmin = false,
  loading = false,
  onMoveTask,
  onOpenTask,
}) {
  const [filters, setFilters] = useState({ search: '', project: '', priority: '', assignee: '' });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [error, setError] = useState('');
  const [reviewTaskId, setReviewTaskId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const touchDragCleanup = useRef(null);
  const reviewDialogRef = useRef(null);

  useEffect(() => () => touchDragCleanup.current?.(), []);

  useEffect(() => {
    if (!reviewTaskId) return undefined;
    reviewDialogRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submittingReview) setReviewTaskId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewTaskId, submittingReview]);

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

  async function persistMove(taskId, columnId, beforeTaskId = null) {
    if (!taskId || !columnId) return;
    const order = nextOrder(columnId, beforeTaskId, taskId);
    setError('');
    try {
      await onMoveTask(taskId, columnId, order);
    } catch (moveError) {
      const apiMessage = moveError?.response?.data?.error || moveError?.message;
      let displayError = apiMessage || 'Could not move this task. Your board was restored.';
      if (!isAdmin && apiMessage === 'Admin access required') {
        displayError = 'The connected API still blocks employee board moves. This project’s board endpoint allows assigned employees to move tasks; the hosted API must be updated to match.';
      } else if (apiMessage === 'Not found') {
        displayError = 'The connected API does not recognize the board-move endpoint yet. Deploy the current Supabase API function to enable task moves.';
      }
      setError(displayError);
    } finally {
      setDraggedTaskId(null);
      setOverColumn(null);
    }
  }

  function commitMove(taskId, columnId, beforeTaskId = null) {
    if (!taskId || !columnId) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    if (!isAdmin && columnId === 'done') {
      if (kanbanColumnForTask(task) !== 'in_progress') {
        setError('Move this task to In Progress before sending it for admin review.');
        setDraggedTaskId(null);
        setOverColumn(null);
        return;
      }
      setError('');
      setReviewTaskId(taskId);
      setDraggedTaskId(null);
      setOverColumn(null);
      return;
    }

    return persistMove(taskId, columnId, beforeTaskId);
  }

  async function confirmReviewSubmission() {
    const task = tasks.find((item) => item.id === reviewTaskId);
    if (!task || kanbanColumnForTask(task) !== 'in_progress') {
      setReviewTaskId(null);
      setError('This task changed before it could be submitted. Refresh the board and try again.');
      return;
    }
    setSubmittingReview(true);
    try {
      await persistMove(task.id, 'done');
    } finally {
      setSubmittingReview(false);
      setReviewTaskId(null);
    }
  }

  function taskIdFromDrop(event) {
    return event.dataTransfer.getData('text/plain') || draggedTaskId;
  }

  function handleDragOver(event, columnId) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    setOverColumn(columnId);
    // Admin and employee portals use different vertical scroll containers.
    // Scroll the nearest one so the last cards stay reachable during a drag.
    autoScrollAtPointer(event.currentTarget, event.clientY);
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
      const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      autoScrollAtPointer(target, moveEvent.clientY);
      const lane = target?.closest('[data-kanban-column]');
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
              onDragEnter={(event) => handleDragOver(event, column.id)}
              onDragOver={(event) => handleDragOver(event, column.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOverColumn(null);
              }}
              onDrop={(event) => handleColumnDrop(event, column.id)}
              aria-label={`${column.label}, ${columnTasks.length} tasks`}
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
                    onDragEnter={(event) => handleDragOver(event, column.id)}
                    onDragOver={(event) => handleDragOver(event, column.id)}
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
      {reviewTaskId && !isAdmin && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submittingReview) setReviewTaskId(null);
          }}
        >
          <div ref={reviewDialogRef} tabIndex={-1} className="modal kanban-review-modal" role="dialog" aria-modal="true" aria-busy={submittingReview} aria-labelledby="kanban-review-title" aria-describedby="kanban-review-description">
            <h2 id="kanban-review-title" style={{ margin: '0 0 10px', color: 'var(--tf-text)', fontFamily: 'var(--font-display)' }}>Admin review needed</h2>
            <p id="kanban-review-description" style={{ margin: '0 0 18px', color: 'var(--tf-muted)', fontSize: 14, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--tf-text)' }}>{tasks.find((task) => task.id === reviewTaskId)?.title || 'This task'}</strong> will move to Done as <strong style={{ color: 'var(--status-warning)' }}>Under review</strong>. An administrator must approve it before it is marked complete. If it is rejected, it will return to In Progress.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewTaskId(null)} disabled={submittingReview}>Keep in In Progress</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={confirmReviewSubmission} disabled={submittingReview}>
                {submittingReview ? <><span className="spinner" /> Sending…</> : 'Send for admin review'}
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="kanban-hint">Drag a card to change its lane. Use the card menu to move tasks on touch screens. Task priority colors: high pink, medium green, low blue.</p>
    </section>
  );
}
