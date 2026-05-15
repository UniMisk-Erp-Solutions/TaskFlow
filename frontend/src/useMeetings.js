import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { useAuth } from './AuthContext';

export function useMeetings() {
  const { profile, loading: authLoading } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (authLoading && !profile?.id) {
      setLoading(true);
      return;
    }
    if (!profile?.id) {
      setLoading(false);
      setMeetings([]);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      const { data } = await api.get('/meetings');
      setMeetings(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, profile?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  async function createMeeting(payload) {
    const { data } = await api.post('/meetings', payload);
    setMeetings((prev) => [data, ...prev]);
    return data;
  }

  async function updateStatus(id, status) {
    const { data } = await api.patch(`/meetings/${id}/status`, { status });
    setMeetings((prev) => prev.map((m) => (m.id === id ? data : m)));
    return data;
  }

  async function deleteMeeting(id) {
    await api.delete(`/meetings/${id}`);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }

  async function getMeeting(id) {
    const { data } = await api.get(`/meetings/${id}`);
    return data;
  }

  async function updateMeeting(id, payload) {
    const { data } = await api.patch(`/meetings/${id}`, payload);
    setMeetings((prev) => prev.map((m) => (m.id === id ? data : m)));
    return data;
  }

  async function submitMeeting(id, note) {
    const { data } = await api.post(`/meetings/${id}/submit`, { note: note ?? '' });
    setMeetings((prev) => prev.map((m) => (m.id === id ? data : m)));
    return data;
  }

  async function approveMeeting(id, note) {
    const { data } = await api.post(`/meetings/${id}/approve`, { note: note ?? '' });
    setMeetings((prev) => prev.map((m) => (m.id === id ? data : m)));
    return data;
  }

  async function requestMeetingChanges(id, note) {
    const { data } = await api.post(`/meetings/${id}/request-changes`, { note });
    setMeetings((prev) => prev.map((m) => (m.id === id ? data : m)));
    return data;
  }

  async function getMeetingHistory(id) {
    const { data } = await api.get(`/meetings/${id}/history`);
    return Array.isArray(data) ? data : [];
  }

  return {
    meetings,
    loading,
    error,
    refetch: fetch,
    createMeeting,
    updateStatus,
    deleteMeeting,
    getMeeting,
    updateMeeting,
    submitMeeting,
    approveMeeting,
    requestMeetingChanges,
    getMeetingHistory,
  };
}
