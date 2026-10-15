import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { useAuth } from './AuthContext';

export function useProjects() {
  const { profile, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async ({ silent = false } = {}) => {
    if (authLoading) {
      if (!profile?.id) setLoading(true);
      return;
    }
    if (!profile?.id) {
      setLoading(false);
      setProjects([]);
      setError(null);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const { data } = await api.get('/projects');
      setProjects(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      if (!silent) setProjects([]);
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

  async function updateProject(projectId, { name, description }) {
    const { data } = await api.patch(`/projects/${projectId}`, { name, description });
    setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...data } : project)));
    return data;
  }

  async function deleteProject(projectId) {
    await api.delete(`/projects/${projectId}`);
    setProjects((prev) => prev.filter((project) => project.id !== projectId));
  }

  async function getProgress(projectId) {
    const { data } = await api.get(`/projects/${projectId}/progress`);
    return data;
  }

  return { projects, loading, error, refetch: fetch, createProject, updateProject, deleteProject, getProgress };
}
