import { useEffect } from 'react';
import supabase from './supabaseClient';

export function useRealtime(table, onChange) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] ${table}:`, status, err?.message || err || '');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onChange]);
}
