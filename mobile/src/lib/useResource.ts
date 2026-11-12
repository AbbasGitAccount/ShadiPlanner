import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { request } from './api';

export function useResource<T>(path: string | null, pollMs = 0) {
  const [dataState, setData] = useState<{ path: string | null; value: T | null }>({ path: null, value: null }); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const sequence = useRef(0); const running = useRef(false);
  const reload = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    const id = ++sequence.current; running.current = true; setLoading(true); setError('');
    try { const value = await request<T>(path); if (id === sequence.current) setData({ path, value }); }
    catch (e) { if (id === sequence.current) setError((e as Error).message); }
    finally { if (id === sequence.current) { running.current = false; setLoading(false); } }
  }, [path]);
  useFocusEffect(useCallback(() => { void reload(); const timer = pollMs ? setInterval(() => { if (!running.current) void reload(); }, pollMs) : null; return () => { sequence.current++; running.current = false; if (timer) clearInterval(timer); }; }, [reload, pollMs]));
  return { data: dataState.path === path ? dataState.value : null, error, loading, reload };
}
