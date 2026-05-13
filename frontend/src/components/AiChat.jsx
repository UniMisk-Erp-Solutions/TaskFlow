import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import AiMessage from './AiMessage';
import api from '../api';

const SUGGESTIONS = [
  'Who has overdue tasks?',
  'What tasks are blocked?',
  "Summarize this week's workload",
  'Who completed the most tasks?',
];

export default function AiChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Ask me anything about your team's tasks — workload, deadlines, blockers, or progress." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(q) {
    q = q.trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/query', { question: q });
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.response?.data?.error || err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(400px, 100vw)',
        background: 'var(--tf-panel)',
        borderLeft: '1px solid var(--tf-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        animation: 'slideIn 180ms ease',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--tf-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--tf-pearl)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="var(--color-primary)" strokeWidth={2} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.015em' }}>AI Assistant</div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 2 }}>Answers from live task data</div>
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-muted)', display: 'flex', padding: 6 }} aria-label="Close">
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--tf-page)' }}>
        {messages.map((m, i) => (
          <AiMessage key={i} role={m.role} content={m.content} />
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--tf-panel)',
                border: '1px solid var(--tf-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={14} color="var(--color-primary)" strokeWidth={2} />
            </div>
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--tf-panel)',
                border: '1px solid var(--tf-border)',
                borderRadius: 16,
                display: 'flex',
                gap: 5,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    animation: `blink 1.2s ease ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: '10px 14px 0', display: 'flex', flexWrap: 'wrap', gap: 8, background: 'var(--tf-page)' }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              style={{
                background: 'var(--tf-pearl)',
                border: '1px solid var(--tf-border)',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13,
                color: 'var(--tf-text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color 120ms ease',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 14, borderTop: '1px solid var(--tf-border)', flexShrink: 0, background: 'var(--tf-pearl)' }}>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <input
            className="input"
            placeholder="Ask about your tasks…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{ flex: 1, fontSize: 15 }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn btn-primary btn-icon"
            style={{ alignSelf: 'stretch', minHeight: 44 }}
            aria-label="Send"
          >
            <Send size={18} strokeWidth={1.8} />
          </button>
        </form>
      </div>
    </div>
  );
}
