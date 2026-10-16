import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Load data from a GET endpoint. Returns { data, error, loading, reload }. */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api.get(path));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
export const peso = (v) => pesoFormat.format(Number(v || 0));

export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d) ? v : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(String(v).replace(' ', 'T'));
  return isNaN(d) ? v : d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(v) {
  if (!v) return '';
  const d = new Date(String(v).replace(' ', 'T'));
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(v);
}

export const fullName = (p) => (p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '');

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const gradeText = (value, mark) => mark || (value != null ? Number(value).toFixed(2) : '—');

export const gwaText = (v) => (v == null ? '—' : Number(v).toFixed(2));

export const yearLevel = (n) => ['', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'][n] || `${n}`;
