import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { useAuth } from './AuthContext';

export function useTasks() {
  const { profile, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    // Wait for auth only when we do not yet have a profile id; if profile is already set (e.g. during TOKEN_REFRESHED), still fetch so lists load without a hard refresh.
    if (authLoading && !profile?.id) {
      setLoading(true);
      return;
    }
    if (!profile?.id) {
      setLoading(false);
      setTasks([]);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.get('/tasks');
      setTasks(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function createTask(payload) {
    const { data } = await api.post('/tasks', payload);
    setTasks((prev) => [data, ...prev]);
    return data;
  }

  async function updateStatus(id, status) {
    const { data } = await api.patch(`/tasks/${id}/status`, { status });
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }

  async function deleteTask(id) {
    await api.delete(`/tasks/${id}`);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function getTask(id) {
    const { data } = await api.get(`/tasks/${id}`);
    return data;
  }

  async function updateTask(id, payload) {
    const { data } = await api.patch(`/tasks/${id}`, payload);
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }

  async function submitTask(id, note) {
    const { data } = await api.post(`/tasks/${id}/submit`, { note: note ?? '' });
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }

  async function approveTask(id, note) {
    const { data } = await api.post(`/tasks/${id}/approve`, { note: note ?? '' });
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }

  async function requestTaskChanges(id, note) {
    const { data } = await api.post(`/tasks/${id}/request-changes`, { note });
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    return data;
  }

  async function getTaskHistory(id) {
    const { data } = await api.get(`/tasks/${id}/history`);
    return Array.isArray(data) ? data : [];
  }

  return {
    tasks,
    loading,
    error,
    refetch: fetch,
    createTask,
    updateStatus,
    deleteTask,
    getTask,
    updateTask,
    submitTask,
    approveTask,
    requestTaskChanges,
    getTaskHistory,
  };
}
