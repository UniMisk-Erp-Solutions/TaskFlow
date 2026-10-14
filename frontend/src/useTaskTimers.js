import { useCallback, useEffect, useState } from 'react';
import api from './api';
import { useAuth } from './AuthContext';
import { useRealtime } from './useRealtime';

export function useTaskTimers() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    if (!profile?.id) {
      setSessions([]);
      setPeople([]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/tasks/timer-analytics');
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
      setPeople(Array.isArray(data?.people) ? data.people : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Timer data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { void refetch(); }, [refetch]);
  useRealtime('task_timer_sessions', useCallback(() => { void refetch(); }, [refetch]));

  const start = useCallback(async (taskId) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/start`);
      setSessions((current) => [...current.filter((session) => session.id !== data.id), data]);
      setError('');
      void refetch();
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start the timer.');
      throw err;
    }
  }, [refetch]);

  const pause = useCallback(async (taskId) => {
    try {
      const { data } = await api.post(`/tasks/${taskId}/timer/pause`);
      setSessions((current) => current.map((session) => session.id === data.id ? data : session));
      setError('');
      void refetch();
      return data;
    } catch (err) {
      setError(err.response?.data?.error || 'Could not pause the timer.');
      throw err;
    }
  }, [refetch]);

  return { sessions, people, loading, error, refetch, start, pause };
}
