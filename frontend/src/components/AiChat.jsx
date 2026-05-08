import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import AiMessage from './AiMessage';
import api from '../api';

const SUGGESTIONS = [
  'Who has overdue tasks?',
  'What tasks are blocked?',
  'Summarize this week\'s workload',
  'Who completed the most tasks?',
];

export default function AiChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Ask me anything about your team\'s tasks — workload, deadlines, blockers, or progress.' },
  ]);
  const [input,   setInput]   = useState('');
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
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 360,
      background: '#0c0c0c', borderLeft: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, animation: 'slideIn 180ms ease',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Sparkles size={14} color="#818cf8" strokeWidth={1.5} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>AI Assistant</div>
            <div style={{ fontSize: 10, color: '#444' }}>Answers from live task data</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', display: 'flex', padding: 4 }}>
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => <AiMessage key={i} role={m.role} content={m.content} />)}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 24, borderRadius: 4, background: '#191919', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={11} color="#818cf8" />
            </div>
            <div style={{ padding: '8px 12px', background: '#131313', border: '1px solid #1e1e1e', borderRadius: '2px 6px 6px 6px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#818cf8', animation: `blink 1.2s ease ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ padding: '10px 14px 0', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} style={{
              background: 'none', border: '1px solid #1e1e1e', borderRadius: 3,
              padding: '5px 10px', fontSize: 11, color: '#555', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 100ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color='#bbb'; e.currentTarget.style.borderColor='#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color='#555'; e.currentTarget.style.borderColor='#1e1e1e'; }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid #1a1a1a', flexShrink: 0 }}>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 6 }}>
          <input
            className="input" placeholder="Ask about your tasks…"
            value={input} onChange={(e) => setInput(e.target.value)}
            disabled={loading} style={{ flex: 1, fontSize: 13 }}
          />
          <button type="submit" disabled={loading || !input.trim()}
            style={{
              background: input.trim() && !loading ? '#e4e4e4' : '#191919',
              border: '1px solid #222', borderRadius: 4, cursor: 'pointer',
              padding: '0 12px', color: input.trim() && !loading ? '#080808' : '#444',
              display: 'flex', alignItems: 'center', transition: 'all 100ms ease', flexShrink: 0,
            }}>
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}
