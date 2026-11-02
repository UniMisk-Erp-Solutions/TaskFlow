import { useCallback, useEffect, useState } from 'react';
import supabase from './supabaseClient';

/**
 * Total unread chat messages for the signed-in user, for the badge next to "Chat" in the sidebar. It refreshes when a
 * message arrives, when a conversation is read (ChatPage fires `taskflow:chat-read`), and every 30 seconds as a fallback.
 */
export function useChatUnread(enabled = true) {
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('chat_unread_counts');
      setTotal((data || []).reduce((sum, c) => sum + Number(c.unread || 0), 0));
    } catch {
      /* keep the last count */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    window.addEventListener('taskflow:chat-read', refresh);
    let channel = null;
    if (import.meta.env.VITE_DISABLE_REALTIME !== 'true') {
      channel = supabase
        .channel(`taskflow:chat-unread:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, refresh)
        .subscribe();
    }
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('taskflow:chat-read', refresh);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  return total;
}
