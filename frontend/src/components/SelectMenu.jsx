import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * A dropdown drawn by the app instead of the browser. The native <select> list is painted by the browser outside the
 * page's control (oversized text, wider than its dialog on phones), so form pickers that must look right use this.
 */
export default function SelectMenu({ id, value, onChange, options, disabled = false, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (option) => { onChange(option.value); setOpen(false); };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openMenu(); }
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (options[active]) choose(options[active]); }
    else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={rootRef} className="tf-selectmenu" style={{ position: 'relative' }}>
      <button
        type="button"
        id={id}
        className="input tf-selectmenu-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="tf-selectmenu-label">{selected?.label ?? ''}</span>
        <ChevronDown size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--tf-muted)', transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ul ref={listRef} id={listId} role="listbox" className="tf-selectmenu-list" aria-label={ariaLabel}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`tf-selectmenu-option${i === active ? ' is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={15} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
