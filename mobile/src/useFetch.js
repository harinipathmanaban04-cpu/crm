import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from './api';

/** Loads data on mount / when deps change. `reload()` refetches silently (no spinner flash). */
export function useFetch(fn, deps = []) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true); const fnRef = useRef(fn); fnRef.current = fn; const seq = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = useCallback(async (mode) => {
    const id = ++seq.current;
    if (mode === 'initial') setLoading(true); if (mode === 'pull') setRefreshing(true);
    try { const d = await fnRef.current(); if (alive.current && id === seq.current) { setData(d); setError(''); } }
    catch (e) { if (alive.current && id === seq.current) setError(errMsg(e)); }
    finally { if (alive.current && id === seq.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useEffect(() => { run('initial'); }, deps); // eslint-disable-line
  return { data, loading, error, refreshing, reload: () => run('silent'), refresh: () => run('pull'), retry: () => run('initial') };
}
