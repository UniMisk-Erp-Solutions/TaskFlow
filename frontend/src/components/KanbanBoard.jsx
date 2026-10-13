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
  if (fromBottom < edgeSize) delta = Math.min(14, Math.max(3, (edgeSize - fromBottom) * 0.2));
  else if (fromTop < edgeSize) delta = -Math.min(14, Math.max(3, (edgeSize - fromTop) * 0.2));
  if (!delta) return;

  if (scrollContainer === window) window.scrollBy(0, delta);
  else scrollContainer.scrollBy({ top: delta, behavior: 'auto' });
}

function BoardCard({ task, profileById, onOpen, onMove, onPointerDragStart, consumeDraggedClick, isDragging }) {
  const lane = kanbanColumnForTask(task);
  const names = assigneeIds(task).map((id) => profileById?.[id] || id.slice(0, 8));
  const locked = task.status === 'completed' || task.status === 'submitted';

  return (
    <article
      className={`kanban-card${isDragging ? ' is-pointer-dragging' : ''}`}
      draggable={false}
      onPointerDown={(event) => !locked && onPointerDragStart(event, task)}
      onClick={(event) => {
        if (consumeDraggedClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onOpen(task);
      }}
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
          onClick={(event) => event.stopPropagation()}
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
  const [dragPreview, setDragPreview] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [error, setError] = useState('');
  const [reviewTaskId, setReviewTaskId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const pointerDragCleanup = useRef(null);
  const dragRuntimeRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const overColumnRef = useRef(null);
  const dropTargetRef = useRef(null);
  const suppressCardClickRef = useRef(false);
  const reviewDialogRef = useRef(null);

  useEffect(() => () => pointerDragCleanup.current?.(), []);

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

  function consumeDraggedClick() {
    if (!suppressCardClickRef.current) return false;
    suppressCardClickRef.current = false;
    return true;
  }

  function setDropColumn(columnId) {
    if (overColumnRef.current === columnId) return;
    overColumnRef.current = columnId;
    setOverColumn(columnId);
  }

  function setDropPosition(target) {
    const next = target?.columnId ? target : null;
    const current = dropTargetRef.current;
    if (current?.columnId === next?.columnId && current?.beforeTaskId === next?.beforeTaskId) return;
    dropTargetRef.current = next;
    setDropTarget(next);
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
      setDragPreview(null);
      setDropColumn(null);
      setDropPosition(null);
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
        setDragPreview(null);
        setDropColumn(null);
        setDropPosition(null);
        return;
      }
      setError('');
      setReviewTaskId(taskId);
      setDraggedTaskId(null);
      setDragPreview(null);
      setDropColumn(null);
      setDropPosition(null);
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

  function startPointerDrag(event, task) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('button, a, input, select, textarea')) return;
    // Touch drags start from the explicit grip so swipes elsewhere on a card
    // remain available for scrolling the board.
    if (event.pointerType === 'touch' && !event.target.closest('.kanban-grip')) return;
    pointerDragCleanup.current?.();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const sourceBounds = event.currentTarget.getBoundingClientRect();
    const runtime = {
      pointerId,
      task,
      x: startX,
      y: startY,
      startX,
      startY,
      width: sourceBounds.width,
      dragging: false,
      frameId: null,
    };
    dragRuntimeRef.current = runtime;
    const removeListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      if (runtime.frameId !== null) window.cancelAnimationFrame(runtime.frameId);
      runtime.frameId = null;
      if (dragRuntimeRef.current === runtime) dragRuntimeRef.current = null;
      if (pointerDragCleanup.current === removeListeners) pointerDragCleanup.current = null;
    };
    const getDropTarget = (pointerEvent) => {
      const target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
      const lane = target?.closest('[data-kanban-column]');
      const before = target?.closest('[data-kanban-task]');
      let beforeTaskId = before?.getAttribute('data-kanban-task');
      if (beforeTaskId && beforeTaskId !== task.id) {
        const bounds = before.getBoundingClientRect();
        if (pointerEvent.clientY >= bounds.top + bounds.height / 2) {
          beforeTaskId = before.nextElementSibling?.getAttribute('data-kanban-task') || null;
        }
      }
      return {
        columnId: lane?.getAttribute('data-kanban-column'),
        beforeTaskId,
      };
    };
    const animateDrag = () => {
      if (dragRuntimeRef.current !== runtime || !runtime.dragging) return;
      const target = document.elementFromPoint(runtime.x, runtime.y);
      const targetPosition = getDropTarget({ clientX: runtime.x, clientY: runtime.y });
      const { columnId } = targetPosition;
      setDropColumn(columnId || null);
      setDropPosition(columnId ? targetPosition : null);
      autoScrollAtPointer(target, runtime.y);
      if (dragPreviewRef.current) {
        const previewBounds = dragPreviewRef.current.getBoundingClientRect();
        const previewX = runtime.x + previewBounds.width + 24 > window.innerWidth
          ? runtime.x - previewBounds.width - 14
          : runtime.x + 14;
        const previewY = runtime.y + previewBounds.height + 24 > window.innerHeight
          ? runtime.y - previewBounds.height - 14
          : runtime.y + 14;
        dragPreviewRef.current.style.transform = `translate3d(${previewX}px, ${previewY}px, 0)`;
      }
      runtime.frameId = window.requestAnimationFrame(animateDrag);
    };
    const onPointerMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      runtime.x = moveEvent.clientX;
      runtime.y = moveEvent.clientY;
      if (!runtime.dragging && Math.hypot(runtime.x - startX, runtime.y - startY) < 4) return;
      if (!runtime.dragging) {
        runtime.dragging = true;
        setDraggedTaskId(task.id);
        setDragPreview({ task, width: runtime.width });
        runtime.frameId = window.requestAnimationFrame(animateDrag);
      }
      moveEvent.preventDefault();
    };
    const onPointerUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      runtime.x = upEvent.clientX;
      runtime.y = upEvent.clientY;
      removeListeners();
      if (!runtime.dragging) return;
      suppressCardClickRef.current = true;
      window.setTimeout(() => { suppressCardClickRef.current = false; }, 0);
      const { columnId, beforeTaskId } = getDropTarget(upEvent);
      if (columnId && beforeTaskId === task.id) {
        setDraggedTaskId(null);
        setDragPreview(null);
        setDropColumn(null);
        setDropPosition(null);
        return;
      }
      if (columnId) {
        void commitMove(task.id, columnId, beforeTaskId && beforeTaskId !== task.id ? beforeTaskId : null);
      } else {
        setDraggedTaskId(null);
        setDragPreview(null);
        setDropColumn(null);
        setDropPosition(null);
      }
    };
    const onPointerCancel = () => {
      removeListeners();
      setDraggedTaskId(null);
      setDragPreview(null);
      setDropColumn(null);
      setDropPosition(null);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    pointerDragCleanup.current = removeListeners;
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
              aria-label={`${column.label}, ${columnTasks.length} tasks`}
            >
              <header className="kanban-column-heading">
                <div>
                  <h2>{column.label}<span className="kanban-count">{columnTasks.length}</span></h2>
                  <p>{column.description}</p>
                </div>
              </header>
              <div className={`kanban-column-cards${overColumn === column.id && dropTarget?.columnId === column.id && !dropTarget.beforeTaskId ? ' is-append-target' : ''}`}>
                {columnTasks.length ? columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`kanban-drop-before${dropTarget?.columnId === column.id && dropTarget.beforeTaskId === task.id ? ' is-insertion-target' : ''}`}
                    data-kanban-task={task.id}
                  >
                    <BoardCard
                      task={task}
                      profileById={profileById}
                      onOpen={onOpenTask}
                      onMove={(item, nextColumn) => void commitMove(item.id, nextColumn)}
                      onPointerDragStart={startPointerDrag}
                      consumeDraggedClick={consumeDraggedClick}
                      isDragging={draggedTaskId === task.id}
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
      {dragPreview && (
        <div
          ref={dragPreviewRef}
          className="kanban-drag-preview"
          style={{
            width: `min(${dragPreview.width}px, calc(100vw - 32px))`,
            '--kanban-priority': priorityColor(dragPreview.task.priority),
            transform: `translate3d(${(dragRuntimeRef.current?.x ?? 0) + 14}px, ${(dragRuntimeRef.current?.y ?? 0) + 14}px, 0)`,
          }}
          aria-hidden="true"
        >
          <span className="kanban-priority-label"><PriorityBadge priority={dragPreview.task.priority} /></span>
          <h3 className="kanban-card-title">{dragPreview.task.title}</h3>
          {dragPreview.task.project_name && <div className="kanban-project">{dragPreview.task.project_name}</div>}
        </div>
      )}
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
      <p className="kanban-hint">Drag a card to change its lane. On touch screens, drag using the grip. Task priority colors: high pink, medium green, low blue.</p>
    </section>
  );
}
