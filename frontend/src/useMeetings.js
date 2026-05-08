import { useState, useEffect, useCallback } from 'react';
import api from './api';

export function useMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/meetings');
      setMeetings(data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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

  return { meetings, loading, error, refetch: fetch, createMeeting, updateStatus, deleteMeeting };
}
