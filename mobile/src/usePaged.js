import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from './api';
import { useLive } from './realtime';

const LIMIT = 20;
/** Paged list loader for the scoped CRUD endpoints (same `{items,total,page,pages}` shape the website uses). Reloads on live events. */
export function usePaged(endpoint, params = {}, events = []) {
  const [items, setItems] = useState([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [more, setMore] = useState(false); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const reqId = useRef(0); const key = JSON.stringify(params);
  const load = useCallback(async (p = 1, mode = 'initial') => {
    const id = ++reqId.current;
    if (mode === 'initial') setLoading(true); if (mode === 'more') setMore(true); if (mode === 'pull') setRefreshing(true);
    try {
      const clean = {}; Object.entries(JSON.parse(key)).forEach(([k, v]) => { if (v) clean[k] = v; });
      const { data } = await api.get(endpoint, { params: { ...clean, page: p, limit: LIMIT } });
      if (id !== reqId.current) return;
      setItems((prev) => (p === 1 ? data.items : [...prev, ...data.items.filter((n) => !prev.some((x) => x._id === n._id))]));
      setPage(data.page); setPages(data.pages); setTotal(data.total); setError('');
    } catch (e) { if (id === reqId.current) setError(errMsg(e)); }
    finally { if (id === reqId.current) { setLoading(false); setMore(false); setRefreshing(false); } }
  }, [endpoint, key]);
  useEffect(() => { load(1, 'initial'); }, [load]);
  useLive(events, () => load(1, 'silent'));
  return { items, total, loading, more, refreshing, error, retry: () => load(1, 'initial'), refresh: () => load(1, 'pull'), reload: () => load(1, 'silent'), loadMore: () => { if (!more && !loading && page < pages) load(page + 1, 'more'); } };
}
