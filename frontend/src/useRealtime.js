import { useEffect, useRef } from 'react';
import supabase from './supabaseClient';

/**
 * Subscribes to public table changes. Keeps callback in a ref so the channel is not
 * torn down on every parent render (which caused CHANNEL_ERROR / websocket churn).
 *
 * If your reverse proxy returns 403 on wss://…/realtime (common with mis-tunneled WS),
 * set VITE_DISABLE_REALTIME=true in the frontend env and rely on manual refetch / navigation.
 */
export function useRealtime(table, onChange) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (import.meta.env.VITE_DISABLE_REALTIME === 'true') {
      return undefined;
    }
    const channelName = `taskflow:${table}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        onChangeRef.current?.(payload);
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const detail = err && typeof err === 'object' && 'message' in err ? err.message : err;
          console.warn(`[Realtime] ${table}:`, status, detail ?? '');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);
}
