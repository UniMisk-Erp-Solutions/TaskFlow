import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AiMessage({ role, content }) {
  const isAi = role === 'assistant';
  return (
    <div style={{ display: 'flex', gap: 10, flexDirection: isAi ? 'row' : 'row-reverse', alignItems: 'flex-end' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          background: isAi ? 'var(--tf-panel)' : 'var(--color-primary)',
          border: isAi ? `1px solid var(--tf-border)` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isAi ? (
          <Sparkles size={14} color="var(--color-primary)" strokeWidth={2} />
        ) : (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-on-primary)' }} />
        )}
      </div>
      <div
        style={{
          maxWidth: '82%',
          padding: '12px 14px',
          background: isAi ? 'var(--tf-panel)' : 'var(--color-primary)',
          border: isAi ? `1px solid var(--tf-border)` : '1px solid transparent',
          borderRadius: isAi ? '8px 18px 18px 18px' : '18px 8px 18px 18px',
          fontSize: 15,
          lineHeight: 1.47,
          color: isAi ? 'var(--tf-text)' : 'var(--color-on-primary)',
          whiteSpace: 'pre-wrap',
          letterSpacing: '-0.022em',
        }}
      >
        {content}
      </div>
    </div>
  );
}
