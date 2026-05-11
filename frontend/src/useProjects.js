import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { useAuth } from './AuthContext';

export function useProjects() {
  const { profile, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (authLoading || !profile?.id) {
      setLoading(false);
      setProjects([]);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.get('/projects');
      setProjects(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile?.id]);

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
