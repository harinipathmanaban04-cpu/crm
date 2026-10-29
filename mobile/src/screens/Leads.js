import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import api, { errMsg } from '../api';
import { EV, useLive } from '../realtime';
import { Avatar, Card, Chip, Empty, ErrorState, Loading, Pill, PriorityDot, SearchBox, StatusBadge } from '../ui';
import { ScreenHeader } from '../drawer';
import { C, LEAD_STATUSES, dedupeStatuses, alt } from '../theme';
import { dueState, fmtDate } from '../utils/format';
import { telUrl } from '../utils/urls';

const LIMIT = 20;
export default function Leads({ navigation, route }) {
  const focused = useIsFocused();
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [dq, setDq] = useState('');
  const [items, setItems] = useState([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); const [more, setMore] = useState(false); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const reqId = useRef(0);
  const statusFilters = dedupeStatuses(LEAD_STATUSES);

  useEffect(() => {
    if (route.params?.status !== undefined) {
      const raw = route.params.status;
      const matched = statusFilters.find((s) => s.trim().toLowerCase() === String(raw).trim().toLowerCase());
      setStatus(matched !== undefined ? matched : raw);
      navigation.setParams({ status: undefined });
    }
  }, [route.params?.status]); // eslint-disable-line
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async (p = 1, mode = 'initial') => {
    const id = ++reqId.current;
    if (mode === 'initial') setLoading(true); if (mode === 'more') setMore(true); if (mode === 'pull') setRefreshing(true);
    try {
      const { data } = await api.get('/leads', { params: { page: p, limit: LIMIT, ...(status && { status }), ...(dq && { q: dq }) } });
      if (id !== reqId.current) return;
      setItems((prev) => (p === 1 ? data.items : [...prev, ...data.items.filter((n) => !prev.some((x) => x._id === n._id))]));
      setPage(data.page); setPages(data.pages); setTotal(data.total); setError('');
    } catch (e) { if (id === reqId.current) setError(errMsg(e)); }
    finally { if (id === reqId.current) { setLoading(false); setMore(false); setRefreshing(false); } }
  }, [status, dq]);
  useEffect(() => { load(1, 'initial'); }, [load]);
  useLive(EV.lead, () => load(1, 'silent'));

  const call = (p) => Linking.openURL(telUrl(p)).catch(() => {});
  const renderItem = ({ item: l, index }) => {
    const ds = l.status !== 'Converted' && l.status !== 'Lost' ? dueState(l.nextFollowUp) : null;
    return (
      <Card accent={alt(index)} onPress={() => navigation.navigate('LeadDetail', { id: l._id })} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={l.name} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }} numberOfLines={1}>{l.name}</Text>
            <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }} numberOfLines={1}>{l.leadId} · {l.course?.name || 'No course'}</Text>
          </View>
          <Pressable onPress={() => call(l.phone)} hitSlop={8} accessibilityLabel={`Call ${l.name}`} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="call" size={18} color={C.green} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><StatusBadge status={l.status} /><PriorityDot p={l.priority} /></View>
          {l.nextFollowUp && ds ? <Pill icon="time-outline" text={ds === 'overdue' ? `Overdue · ${fmtDate(l.nextFollowUp)}` : ds === 'today' ? 'Follow-up today' : fmtDate(l.nextFollowUp)} fg={ds === 'overdue' ? C.red : ds === 'today' ? C.warn : C.sub} bg={ds === 'overdue' ? C.redBg : ds === 'today' ? C.warnBg : C.border} /> : null}
        </View>
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {focused && <StatusBar style="dark" />}
      <ScreenHeader title="My Leads" subtitle={`${total} assigned to you`}>
        <SearchBox value={q} onChangeText={setQ} placeholder="Search name, phone, email, ID" style={{ marginHorizontal: 16, marginBottom: 10 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Chip label="All" active={!status} onPress={() => setStatus('')} />
          {statusFilters.map((s) => {
            const active = !!status && status.trim().toLowerCase() === s.trim().toLowerCase();
            return <Chip key={s} label={s} active={active} onPress={() => setStatus(s)} />;
          })}
        </ScrollView>
      </ScreenHeader>
      {loading ? <Loading /> : error && !items.length ? <ErrorState message={error} onRetry={() => load(1)} /> : (
        <FlatList data={items} keyExtractor={(l) => l._id} renderItem={renderItem} contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1, 'pull')} colors={[C.brand500]} />}
          onEndReachedThreshold={0.4} onEndReached={() => { if (!more && page < pages) load(page + 1, 'more'); }}
          ListEmptyComponent={<Empty icon="people-outline" title={dq || status ? 'No matching leads' : 'No leads assigned yet'} sub={dq || status ? 'Try a different search or filter.' : 'When your admin assigns leads to you, they show up here instantly.'} />}
          ListFooterComponent={more ? <ActivityIndicator color={C.brand500} style={{ margin: 16 }} /> : error ? <Text style={{ color: C.red, textAlign: 'center', margin: 12 }}>{error}</Text> : null} />
      )}
    </View>
  );
}
