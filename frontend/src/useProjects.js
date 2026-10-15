import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { useAuth } from './AuthContext';

export function useProjects() {
  const { profile, loading: authLoading } = useAuth();
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async ({ silent = false } = {}) => {
    if (authLoading) {
      if (!profile?.id) setLoading(true);
      return;
    }
    if (!profile?.id) {
      setLoading(false);
      setAllProjects([]);
      setError(null);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const { data } = await api.get('/projects');
      setAllProjects(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      if (!silent) setAllProjects([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function createProject({ name, description }) {
    const { data } = await api.post('/projects', { name, description });
    setAllProjects((prev) => [data, ...prev]);
    return data;
  }

  async function updateProject(projectId, { name, description }) {
    const { data } = await api.patch(`/projects/${projectId}`, { name, description });
    setAllProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...data } : project)));
    return data;
  }

  // Projects are never deleted: archiving keeps the project and all its history.
  async function archiveProject(projectId) {
    const { data } = await api.post(`/projects/${projectId}/archive`);
    setAllProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...data } : project)));
  }

  async function restoreProject(projectId) {
    const { data } = await api.post(`/projects/${projectId}/unarchive`);
    setAllProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...data, archived_at: null } : project)));
  }

  async function getProgress(projectId) {
    const { data } = await api.get(`/projects/${projectId}/progress`);
    return data;
  }

  // `projects` only holds active projects so selects and boards never offer archived ones.
  const projects = allProjects.filter((p) => !p.archived_at);
  const archivedProjects = allProjects.filter((p) => p.archived_at);

  return { projects, archivedProjects, loading, error, refetch: fetch, createProject, updateProject, archiveProject, restoreProject, getProgress };
}
