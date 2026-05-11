import { useState, useEffect, useCallback } from 'react';
import api from './api';

export function useTasks() {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/tasks');
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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

  return { tasks, loading, error, refetch: fetch, createTask, updateStatus, deleteTask, getTask, updateTask };
}
