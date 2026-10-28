import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../AuthContext';

const SIZE = 52;
const MARGIN = 8;
const DEFAULT_POSITION = { right: 28, bottom: 28 };
const DRAG_THRESHOLD = 5;

function storageKey(userId) {
  return `taskflow:ai-fab-position:${userId || 'anonymous'}`;
}

function clampPosition(position) {
  const mobile = window.matchMedia('(max-width: 760px)').matches;
  const safeBottom = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tf-safe-bottom')) || 0;
  const minBottom = mobile ? 66 + safeBottom + 14 : MARGIN;
  const maxRight = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxBottom = Math.max(minBottom, window.innerHeight - SIZE - MARGIN);
  return {
    right: Math.min(maxRight, Math.max(MARGIN, position.right)),
    bottom: Math.min(maxBottom, Math.max(minBottom, position.bottom)),
  };
}

function readPosition(userId) {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed?.right) && Number.isFinite(parsed?.bottom)) return parsed;
  } catch { /* storage unavailable or corrupt */ }
  return DEFAULT_POSITION;
}

/**
 * Floating AI button. Starts bottom-right for everyone; each signed-in user can drag it
 * anywhere and the spot is remembered for that user only (in this browser).
 */
export default function AiFab({ onOpen }) {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [position, setPosition] = useState(() => clampPosition(readPosition(userId)));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const positionRef = useRef(position);
  positionRef.current = position;

  // Switching accounts in the same browser loads that account's own position.
  useEffect(() => {
    setPosition(clampPosition(readPosition(userId)));
  }, [userId]);

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const persist = useCallback((next) => {
    try { window.localStorage.setItem(storageKey(userId), JSON.stringify(next)); } catch { /* ignore */ }
  }, [userId]);

  const onPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: positionRef.current,
    };
    movedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!movedRef.current) {
      movedRef.current = true;
      setDragging(true);
    }
    // right/bottom grow as the button moves left/up.
    setPosition(clampPosition({ right: drag.origin.right - dx, bottom: drag.origin.bottom - dy }));
  };

  const finishDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (movedRef.current) {
      setDragging(false);
      persist(positionRef.current);
    }
  };

  const onClick = () => {
    // A drag ends with a click event; only a plain click opens the assistant.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    onOpen();
  };

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 48 : 16;
    const delta = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
    if (!delta || !event.altKey) return;
    event.preventDefault();
    const next = clampPosition({ right: positionRef.current.right + delta[0], bottom: positionRef.current.bottom + delta[1] });
    setPosition(next);
    persist(next);
  };

  return (
    <button
      type="button"
      className={`tf-fab${dragging ? ' is-dragging' : ''}`}
      style={{ right: position.right, bottom: position.bottom, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onClick={onClick}
      onKeyDown={onKeyDown}
      title="AI Assistant — drag to move"
      aria-label="Open AI assistant. Drag to move; with the button focused, Alt plus arrow keys also move it."
    >
      <Sparkles size={20} color="#ffffff" strokeWidth={1.8} />
    </button>
  );
}
