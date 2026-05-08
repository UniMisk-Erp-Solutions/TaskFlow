import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AiMessage({ role, content }) {
  const isAi = role === 'assistant';
  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isAi ? 'row' : 'row-reverse' }}>
      <div style={{
        width: 24, height: 24, borderRadius: 4, flexShrink: 0,
        background: isAi ? '#191919' : '#131313',
        border: '1px solid #222',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isAi
          ? <Sparkles size={11} color="#818cf8" strokeWidth={1.5} />
          : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#444' }} />}
      </div>
      <div style={{
        maxWidth: '82%', padding: '9px 12px',
        background: isAi ? '#131313' : '#0f0f0f',
        border: '1px solid #1e1e1e',
        borderRadius: isAi ? '2px 6px 6px 6px' : '6px 2px 6px 6px',
        fontSize: 12.5, lineHeight: 1.65, color: '#ccc',
        whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    </div>
  );
}
