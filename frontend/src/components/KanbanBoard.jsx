import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock3, Filter, FolderKanban, GripVertical, Search, UserRound } from 'lucide-react';
import { formatDate } from '../lib/dateFormat';
import { KANBAN_COLUMNS, compareKanbanTasks, kanbanColumnForTask, priorityColor } from '../lib/kanban';
import StatusBadge, { PriorityBadge } from './StatusBadge';
import { elapsedSecondsForSession, formatElapsedSeconds } from '../lib/taskTimer';

function assigneeIds(task) {
  return task.assignee_ids?.length ? task.assignee_ids : task.assignee_id ? [task.assignee_id] : [];
}

const APPROVED_TASK_VISIBLE_MS = 60_000;

function approvedTaskTimeLeft(task, now) {
  // Older approvals have no approval stamp, so fall back to the last update.
  const approvedAt = Date.parse(task.kanban_approved_at || task.updated_at || '');
  if (!Number.isFinite(approvedAt)) return null;
  return Math.max(0, Math.min(APPROVED_TASK_VISIBLE_MS, approvedAt + APPROVED_TASK_VISIBLE_MS - now));
}

// Value for <input type="datetime-local"> in the user's local time.
function localInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
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

function BoardCard({ task, profileById, onOpen, onMove, onPointerDragStart, consumeDraggedClick, isDragging, completionTimeLeft, timerSessions, currentUserId, isAdmin, timerNow, onStartTimer, onPauseTimer, showKind, isProjectTask }) {
  const lane = kanbanColumnForTask(task);
  const names = assigneeIds(task).map((id) => profileById?.[id] || id.slice(0, 8));
  const locked = task.status === 'completed' || task.status === 'submitted';
  const activeSession = timerSessions.find((session) => session.task_id === task.id && session.user_id === currentUserId && !session.ended_at);
  const ownTaskSeconds = timerSessions.filter((session) => session.task_id === task.id && session.user_id === currentUserId)
    .reduce((total, session) => total + elapsedSecondsForSession(session, timerNow), 0);
  // Admins don't run timers: they see everyone's tracked time on the card and who is running now.
  const taskSessions = timerSessions.filter((session) => session.task_id === task.id);
  const teamSeconds = taskSessions.reduce((total, session) => total + elapsedSecondsForSession(session, timerNow), 0);
  const runningNames = [...new Set(taskSessions.filter((session) => !session.ended_at).map((session) => profileById?.[session.user_id] || 'Someone'))];

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
      role="group"
      tabIndex={0}
      aria-label={`${task.title}, ${task.priority || 'medium'} priority. Press Enter to open task details.`}
      style={{ '--kanban-priority': priorityColor(task.priority) }}
    >
      <div className="kanban-card-topline">
        <span className="kanban-priority-label"><PriorityBadge priority={task.priority} /></span>
        {showKind && (
          <span
            className={`kanban-kind ${isProjectTask ? 'is-project' : 'is-individual'}`}
            title={isProjectTask ? `Project task${task.project_name ? ` · ${task.project_name}` : ''}` : 'Individual task'}
            aria-label={isProjectTask ? 'Project task' : 'Individual task'}
          >
            {isProjectTask ? <FolderKanban size={12} aria-hidden="true" /> : <UserRound size={12} aria-hidden="true" />}
            <span>{isProjectTask ? 'Project' : 'Individual'}</span>
          </span>
        )}
        {task.parent_task_id && (
          <span className="subtask-badge" title="This task is a subtask of another task" aria-label="Subtask">Subtask</span>
        )}
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

      {!locked && (
        <label className="kanban-mobile-move" onClick={(event) => event.stopPropagation()}>
          <span>Move to</span>
          <select
            aria-label={`Move ${task.title} to status`}
            value={lane}
            onChange={(event) => {
              event.stopPropagation();
              if (event.target.value !== lane) onMove(task, event.target.value);
            }}
          >
            {KANBAN_COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
          </select>
        </label>
      )}

      {(task.status === 'submitted' || task.status === 'rejected' || task.status === 'blocked' || task.status === 'changes_requested') && (
        <div className="kanban-workflow-status"><StatusBadge status={task.status} /></div>
      )}
      {completionTimeLeft !== null && completionTimeLeft > 0 && (
        <div className="kanban-completion-countdown" aria-label={`Removed from the board in ${formatCountdown(completionTimeLeft)}`}>
          <Clock3 size={12} aria-hidden="true" />
          <span>Clears in {formatCountdown(completionTimeLeft)}</span>
        </div>
      )}
      {lane === 'in_progress' && (
        isAdmin ? (
          <div className="kanban-task-timer" title={runningNames.length ? `Running now: ${runningNames.join(', ')}` : 'No timer running'}>
            <span className="kanban-task-timer-value"><Clock3 size={13} aria-hidden="true" />{formatElapsedSeconds(teamSeconds)}</span>
            <span className={`kanban-timer-state${runningNames.length ? ' is-running' : ''}`}>
              {runningNames.length ? `${runningNames.join(', ')} working` : 'Not running'}
            </span>
          </div>
        ) : (
        <div className="kanban-task-timer">
          <span className="kanban-task-timer-value"><Clock3 size={13} aria-hidden="true" />{formatElapsedSeconds(ownTaskSeconds)}</span>
          <button type="button" className="kanban-task-timer-button" onClick={(event) => {
            event.stopPropagation();
            (activeSession ? onPauseTimer : onStartTimer)(task.id).catch(() => {});
          }} onKeyDown={(event) => event.stopPropagation()} aria-label={`${activeSession ? 'Pause' : 'Start'} timer for ${task.title}`} title={activeSession ? 'Pause timer' : 'Start timer'}>
            {activeSession ? 'Pause' : 'Start'}
          </button>
        </div>
        )
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
  timerSessions = [],
  currentUserId,
  onStartTimer = async () => {},
  onPauseTimer = async () => {},
  timerError = '',
  actions = null,
}) {
  const [filters, setFilters] = useState({ search: '', project: '', priority: '', assignee: '' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileLane, setMobileLane] = useState('to_do');
  const mobileLaneTouched = useRef(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [error, setError] = useState('');
  const [scopeNotice, setScopeNotice] = useState('');
  const [reviewTaskId, setReviewTaskId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const pointerDragCleanup = useRef(null);
  const dragRuntimeRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const overColumnRef = useRef(null);
  const dropTargetRef = useRef(null);
  const suppressCardClickRef = useRef(false);
  const reviewDialogRef = useRef(null);
  const [useCustomEnd, setUseCustomEnd] = useState(false);
  const [customEnd, setCustomEnd] = useState('');
  const [endError, setEndError] = useState('');
  // Employees choose what the board shows: 'individual' = everything assigned to them
  // (own tasks and project tasks, tagged); 'project' = only tasks that belong to a project.
  const [scope, setScope] = useState(() => {
    try { return window.localStorage.getItem('taskflow:kanban-scope') === 'project' ? 'project' : 'individual'; } catch { return 'individual'; }
  });
  const isLinkedProject = (task) => Boolean(task.project_id);
  function changeScope(next) {
    setScope(next);
    setScopeNotice('');
    try { window.localStorage.setItem('taskflow:kanban-scope', next); } catch { /* ignore */ }
  }

  useEffect(() => {
    if (isAdmin || scope !== 'project' || loading || !tasks.length) return;
    if (tasks.some((task) => Boolean(task.project_id))) return;
    setScope('individual');
    setScopeNotice('No project-linked tasks were found, so all your tasks are shown.');
    try { window.localStorage.setItem('taskflow:kanban-scope', 'individual'); } catch { /* ignore */ }
  }, [isAdmin, scope, loading, tasks]);

  useEffect(() => () => pointerDragCleanup.current?.(), []);

  useEffect(() => {
    if (!timerSessions.some((session) => !session.ended_at)) return undefined;
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerSessions]);

  useEffect(() => {
    const hasActiveCountdown = tasks.some((task) =>
      task.status === 'completed' && approvedTaskTimeLeft(task, Date.now()) > 0,
    );
    if (!hasActiveCountdown) return undefined;
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setClockNow(currentTime);
      if (!tasks.some((task) => task.status === 'completed' && approvedTaskTimeLeft(task, currentTime) > 0)) {
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [tasks]);

  useEffect(() => {
    setUseCustomEnd(false);
    setCustomEnd('');
    setEndError('');
  }, [reviewTaskId]);

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
      if (!isAdmin && scope === 'project' && !isLinkedProject(task)) return false;
      if (search && !`${task.title || ''} ${task.description || ''} ${task.project_name || ''}`.toLowerCase().includes(search)) return false;
      if (filters.project && task.project_id !== filters.project) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assignee && !assigneeIds(task).includes(filters.assignee)) return false;
      return true;
    });
  }, [tasks, filters, isAdmin, scope]);

  const visibleByColumn = useMemo(() => {
    const grouped = Object.fromEntries(KANBAN_COLUMNS.map((column) => [column.id, []]));
    filteredTasks.forEach((task) => {
      const timeLeft = approvedTaskTimeLeft(task, clockNow);
      if (task.status === 'completed' && timeLeft !== null && timeLeft <= 0) return;
      grouped[kanbanColumnForTask(task)].push(task);
    });
    Object.values(grouped).forEach((columnTasks) => columnTasks.sort(compareKanbanTasks));
    return grouped;
  }, [filteredTasks, clockNow]);

  useEffect(() => {
    if (mobileLaneTouched.current) return;
    if (visibleByColumn[mobileLane]?.length) return;
    const firstPopulatedLane = KANBAN_COLUMNS.find((column) => visibleByColumn[column.id].length);
    if (firstPopulatedLane) setMobileLane(firstPopulatedLane.id);
  }, [mobileLane, visibleByColumn]);

  const visibleTaskCount = Object.values(visibleByColumn).reduce((count, columnTasks) => count + columnTasks.length, 0);
  const timerSessionsByTask = useMemo(() => {
    const grouped = new Map();
    timerSessions.forEach((session) => {
      const current = grouped.get(session.task_id) || [];
      current.push(session);
      grouped.set(session.task_id, current);
    });
    return grouped;
  }, [timerSessions]);

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

  async function persistMove(taskId, columnId, beforeTaskId = null, extras = {}) {
    if (!taskId || !columnId) return;
    const order = nextOrder(columnId, beforeTaskId, taskId);
    setError('');
    try {
      await onMoveTask(taskId, columnId, order, extras);
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

    if (!isAdmin && kanbanColumnForTask(task) === 'in_progress' && (columnId === 'to_do' || columnId === 'backlog')) {
      setError('A task that is In Progress cannot be moved back to To Do or Backlog.');
      setDraggedTaskId(null);
      setDragPreview(null);
      setDropColumn(null);
      setDropPosition(null);
      return;
    }

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
    let workEndedAt = null;
    if (useCustomEnd) {
      const picked = Date.parse(customEnd);
      if (!Number.isFinite(picked)) { setEndError('Choose a valid end date and time.'); return; }
      if (picked > Date.now()) { setEndError('The end time cannot be in the future.'); return; }
      workEndedAt = new Date(picked).toISOString();
    }
    setEndError('');
    setSubmittingReview(true);
    try {
      await persistMove(task.id, 'done', null, workEndedAt ? { work_ended_at: workEndedAt } : {});
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
      document.body.classList.remove('is-kanban-dragging');
      if (runtime.frameId !== null) window.cancelAnimationFrame(runtime.frameId);
      runtime.frameId = null;
      if (dragRuntimeRef.current === runtime) dragRuntimeRef.current = null;
      if (pointerDragCleanup.current === removeListeners) pointerDragCleanup.current = null;
    };
    const getDropTarget = (pointerEvent, hit) => {
      const target = hit || document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
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
      // Move the preview first so it never lags behind the pointer; the
      // hit-testing below is the expensive part of each frame.
      if (dragPreviewRef.current) {
        if (!runtime.previewSize) {
          const bounds = dragPreviewRef.current.getBoundingClientRect();
          runtime.previewSize = { width: bounds.width, height: bounds.height };
        }
        const { width, height } = runtime.previewSize;
        const previewX = runtime.x + width + 24 > window.innerWidth ? runtime.x - width - 14 : runtime.x + 14;
        const previewY = runtime.y + height + 24 > window.innerHeight ? runtime.y - height - 14 : runtime.y + 14;
        dragPreviewRef.current.style.transform = `translate3d(${previewX}px, ${previewY}px, 0)`;
      }
      const target = document.elementFromPoint(runtime.x, runtime.y);
      const targetPosition = getDropTarget({ clientX: runtime.x, clientY: runtime.y }, target);
      const { columnId } = targetPosition;
      setDropColumn(columnId || null);
      setDropPosition(columnId ? targetPosition : null);
      autoScrollAtPointer(target, runtime.y);
      runtime.frameId = window.requestAnimationFrame(animateDrag);
    };
    const onPointerMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      runtime.x = moveEvent.clientX;
      runtime.y = moveEvent.clientY;
      if (!runtime.dragging && Math.hypot(runtime.x - startX, runtime.y - startY) < 4) return;
      if (!runtime.dragging) {
        runtime.dragging = true;
        // Stop the browser from turning the drag into a text selection.
        document.body.classList.add('is-kanban-dragging');
        window.getSelection?.()?.removeAllRanges();
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
        <div className="kanban-toolbar-actions">
          <div className="kanban-filter-menu-wrap">
            <button type="button" className="kanban-filter-trigger" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="kanban-filter-menu">
              <Filter size={15} aria-hidden="true" /> Filters
              {Object.values(filters).filter(Boolean).length > 0 && <span className="kanban-filter-count">{Object.values(filters).filter(Boolean).length}</span>}
            </button>
            {filtersOpen && (
              <div className="kanban-filter-menu" id="kanban-filter-menu" aria-label="Task filters">
                <label>Project
                  <select value={filters.project} onChange={(event) => setFilter('project', event.target.value)} aria-label="Filter by project">
                    <option value="">All projects</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </label>
                <label>Priority
                  <select value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)} aria-label="Filter by priority">
                    <option value="">All priorities</option>
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                </label>
                <label>Assignee
                  <select value={filters.assignee} onChange={(event) => setFilter('assignee', event.target.value)} aria-label="Filter by assignee">
                    <option value="">All assignees</option>
                    {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.full_name || assignee.email}</option>)}
                  </select>
                </label>
                <div className="kanban-filter-menu-actions">
                  <button type="button" className="kanban-filter-clear" onClick={() => setFilters((current) => ({ ...current, project: '', priority: '', assignee: '' }))}>Clear filters</button>
                  <button type="button" className="kanban-filter-apply" onClick={() => setFiltersOpen(false)}>Apply filters</button>
                </div>
              </div>
            )}
          </div>
          {actions}
        </div>
        {!isAdmin && (
          <div className="kanban-scope" role="group" aria-label="Board scope">
            <button type="button" className={scope === 'individual' ? 'is-active' : ''} aria-pressed={scope === 'individual'} onClick={() => changeScope('individual')} title="All your tasks: individual and project">
              <UserRound size={14} aria-hidden="true" /> Individual
            </button>
            <button type="button" className={scope === 'project' ? 'is-active' : ''} aria-pressed={scope === 'project'} onClick={() => changeScope('project')} title="Only tasks that belong to a project">
              <FolderKanban size={14} aria-hidden="true" /> Project
            </button>
          </div>
        )}
        <label className="kanban-search">
          <Search size={16} aria-hidden="true" />
          <input value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
        </label>
        <span className="kanban-result-count">{visibleTaskCount} task{visibleTaskCount === 1 ? '' : 's'}</span>
      </div>

      {scopeNotice && <div className="kanban-scope-notice" role="status">{scopeNotice}</div>}

      {error && (
        <div className="kanban-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">Dismiss</button>
        </div>
      )}
      {timerError && <div className="kanban-error" role="alert"><span>{timerError}</span></div>}

      <div className="kanban-mobile-lanes" role="tablist" aria-label="Task status">
        {KANBAN_COLUMNS.map((column) => (
          <button
            key={column.id}
            type="button"
            role="tab"
            id={`kanban-tab-${column.id}`}
            aria-selected={mobileLane === column.id}
            aria-controls={`kanban-panel-${column.id}`}
            tabIndex={mobileLane === column.id ? 0 : -1}
            className={mobileLane === column.id ? 'is-active' : ''}
            onClick={() => {
              mobileLaneTouched.current = true;
              setMobileLane(column.id);
            }}
          >
            <span>{column.label}</span>
            <span className="kanban-mobile-lane-count">{visibleByColumn[column.id].length}</span>
          </button>
        ))}
      </div>
      <div className="kanban-board">
        {KANBAN_COLUMNS.map((column) => {
          const columnTasks = visibleByColumn[column.id];
          return (
            <section
              key={column.id}
              className={`kanban-column${overColumn === column.id ? ' is-drop-target' : ''}${mobileLane === column.id ? ' is-mobile-active' : ''}`}
              data-kanban-column={column.id}
              role="tabpanel"
              id={`kanban-panel-${column.id}`}
              aria-labelledby={`kanban-tab-${column.id}`}
              tabIndex={0}
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
                      completionTimeLeft={task.status === 'completed' ? approvedTaskTimeLeft(task, clockNow) : null}
                      timerSessions={timerSessionsByTask.get(task.id) || []}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      timerNow={clockNow}
                      onStartTimer={onStartTimer}
                      onPauseTimer={onPauseTimer}
                      showKind={!isAdmin && scope === 'individual'}
                      isProjectTask={isLinkedProject(task)}
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
            <div className="kanban-end-time">
              <label className="kanban-end-toggle">
                <input
                  type="checkbox"
                  checked={useCustomEnd}
                  disabled={submittingReview}
                  onChange={(event) => {
                    setUseCustomEnd(event.target.checked);
                    setEndError('');
                    if (event.target.checked && !customEnd) setCustomEnd(localInputValue(new Date()));
                  }}
                />
                <span>Set a different end time</span>
              </label>
              {useCustomEnd ? (
                <>
                  <input
                    type="datetime-local"
                    className="kanban-end-input"
                    value={customEnd}
                    max={localInputValue(new Date())}
                    disabled={submittingReview}
                    onChange={(event) => { setCustomEnd(event.target.value); setEndError(''); }}
                    aria-label="Task end date and time"
                  />
                  <small>Cannot be in the future. Running timers stop at this time.</small>
                </>
              ) : <small>The end time will be recorded as the moment you send it for review.</small>}
              {endError && <div className="kanban-end-error" role="alert">{endError}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewTaskId(null)} disabled={submittingReview}>Keep in In Progress</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={confirmReviewSubmission} disabled={submittingReview}>
                {submittingReview ? <><span className="spinner" /> Sending…</> : 'Send for admin review'}
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="kanban-hint"><span className="kanban-desktop-hint">Drag a card to change its lane.</span><span className="kanban-mobile-hint">Use the “Move to” control on a task to change its status.</span> Task priority colors: high pink, medium green, low blue.</p>
    </section>
  );
}
