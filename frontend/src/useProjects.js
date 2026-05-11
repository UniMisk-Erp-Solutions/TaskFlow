import { useState, useEffect, useCallback } from 'react';
import api from './api';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/projects');
      setProjects(data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function createProject({ name, description }) {
    const { data } = await api.post('/projects', { name, description });
    setProjects((prev) => [data, ...prev]);
    return data;
  }

  async function getProgress(projectId) {
    const { data } = await api.get(`/projects/${projectId}/progress`);
    return data;
  }

  return { projects, loading, error, refetch: fetch, createProject, getProgress };
}
