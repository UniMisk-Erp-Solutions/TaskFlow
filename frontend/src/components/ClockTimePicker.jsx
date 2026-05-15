import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

/**
 * Analog clock-face time picker.
 *
 * Input value/onChange use a 24-hour "HH:MM" string (compatible with the
 * backend's `time` columns). The popover lets the user click hour positions
 * around a clock circle, then click minute positions (5-minute granularity),
 * then confirm with Done.
 *
 *   <ClockTimePicker value="14:30" onChange={(v) => setForm({...form, due_time: v})} />
 *
 * Pure presentation — no API calls. Closes on outside click / Esc.
 */

const SIZE = 220;             // px diameter of clock face
const CENTER = SIZE / 2;
const RING_PAD = 28;          // distance of number ring from edge
const HAND_LEN = CENTER - RING_PAD - 8;

function pad(n) {
  return String(n).padStart(2, '0');
}

function parse(v) {
  if (!v) return { h24: 9, m: 0 };
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { h24: 9, m: 0 };
  return { h24: Number(m[1]) % 24, m: Number(m[2]) % 60 };
}

function format24(h24, min) {
  return `${pad(h24)}:${pad(min)}`;
}

function formatDisplay(v) {
  if (!v) return 'Pick a time';
  const { h24, m } = parse(v);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${period}`;
}

function polar(cx, cy, r, angleDeg) {
  // 12 at top → angle measured clockwise from -90deg
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export default function ClockTimePicker({ value = '', onChange, disabled = false, placeholder = 'Pick a time' }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('hour'); // 'hour' | 'minute'
  const popRef = useRef(null);
  const btnRef = useRef(null);

  const { h24, m } = parse(value || '09:00');
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = ((h24 + 11) % 12) + 1;

  // Outside click / Esc to close
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!popRef.current || !btnRef.current) return;
      if (popRef.current.contains(e.target) || btnRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // When opening, default to hour mode
  useEffect(() => {
    if (open) setMode('hour');
  }, [open]);

  function emit(nextH24, nextMin) {
    onChange?.(format24(nextH24, nextMin));
  }

  function pickHour(label12) {
    // label12 is 1..12. Combine with current period.
    const isPM = period === 'PM';
    let nextH24;
    if (label12 === 12) nextH24 = isPM ? 12 : 0;
    else nextH24 = isPM ? label12 + 12 : label12;
    emit(nextH24, m);
    setMode('minute');
  }

  function pickMinute(min) {
    emit(h24, min);
  }

  function togglePeriod() {
    const nextH24 = period === 'AM' ? (h24 + 12) % 24 : (h24 + 12) % 24;
    emit(nextH24, m);
  }

  function clear(e) {
    e.stopPropagation();
    onChange?.('');
  }

  // Hand angle
  const handAngle = mode === 'hour' ? (h12 % 12) * 30 : m * 6;
  const handEnd = polar(CENTER, CENTER, HAND_LEN, handAngle);

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 14px',
          background: 'var(--tf-panel, #fff)',
          color: value ? 'var(--tf-text)' : 'var(--tf-muted)',
          border: `1px solid ${open ? 'var(--color-primary)' : 'var(--tf-border)'}`,
          borderRadius: 10,
          fontSize: 14,
          cursor: disabled ? 'default' : 'pointer',
          textAlign: 'left',
          transition: 'border-color 120ms',
          fontFamily: 'inherit',
        }}
      >
        <Clock size={15} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: value ? 500 : 400 }}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear time"
            onClick={clear}
            onKeyDown={(e) => { if (e.key === 'Enter') clear(e); }}
            style={{
              fontSize: 11,
              color: 'var(--tf-muted)',
              padding: '2px 6px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Clear
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          ref={popRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            background: 'var(--tf-panel)',
            border: '1px solid var(--tf-border)',
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 20px 50px -20px rgba(15,23,42,0.25), 0 4px 12px -4px rgba(15,23,42,0.10)',
            width: SIZE + 36,
          }}
        >
          {/* Time readout */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setMode('hour')}
              style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", system-ui, sans-serif)',
                fontSize: 30,
                fontWeight: 600,
                color: mode === 'hour' ? 'var(--color-primary)' : 'var(--tf-text)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 4px',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {pad(h12)}
            </button>
            <span style={{ fontSize: 26, color: 'var(--tf-muted)', fontWeight: 500 }}>:</span>
            <button
              type="button"
              onClick={() => setMode('minute')}
              style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", system-ui, sans-serif)',
                fontSize: 30,
                fontWeight: 600,
                color: mode === 'minute' ? 'var(--color-primary)' : 'var(--tf-text)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 4px',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {pad(m)}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 6 }}>
              {['AM', 'PM'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { if (period !== p) togglePeriod(); }}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid ' + (period === p ? 'var(--color-primary)' : 'var(--tf-border)'),
                    background: period === p ? 'rgba(86,69,212,0.10)' : 'transparent',
                    color: period === p ? 'var(--color-primary)' : 'var(--tf-muted)',
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Clock face */}
          <div style={{ position: 'relative', width: SIZE, height: SIZE, margin: '0 auto' }}>
            {/* Outer disc */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'var(--tf-pearl)',
                border: '1px solid var(--tf-border)',
              }}
            />
            {/* Numbers ring (12 positions) */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = i * 30; // 0deg = 12 o'clock
              const label = mode === 'hour' ? (i === 0 ? 12 : i) : pad(i * 5);
              const pos = polar(CENTER, CENTER, CENTER - RING_PAD, angle);
              const labelNumeric = mode === 'hour' ? (i === 0 ? 12 : i) : i * 5;
              const isSelected =
                mode === 'hour'
                  ? labelNumeric === h12
                  : labelNumeric === m;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => (mode === 'hour' ? pickHour(labelNumeric) : pickMinute(labelNumeric))}
                  style={{
                    position: 'absolute',
                    left: pos.x,
                    top: pos.y,
                    transform: 'translate(-50%, -50%)',
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    border: 'none',
                    background: isSelected ? 'var(--color-primary)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--tf-text)',
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    zIndex: 2,
                    fontFamily: 'inherit',
                    transition: 'background 100ms, color 100ms',
                  }}
                >
                  {label}
                </button>
              );
            })}
            {/* Hand */}
            <svg
              width={SIZE}
              height={SIZE}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <line
                x1={CENTER}
                y1={CENTER}
                x2={handEnd.x}
                y2={handEnd.y}
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={CENTER} cy={CENTER} r="4" fill="var(--color-primary)" />
              <circle cx={handEnd.x} cy={handEnd.y} r="14" fill="var(--color-primary)" fillOpacity="0.18" />
            </svg>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>
              {mode === 'hour' ? 'Pick an hour' : '5-minute steps'}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                padding: '7px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
