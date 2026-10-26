import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api, { errMsg } from '../api';
import { EV } from '../realtime';
import { usePaged } from '../usePaged';
import { useLookups } from '../useLookups';
import { Button, Card, Chip, DateField, Empty, ErrorState, Fab, KV, Loading, SearchBox, SelectField, Sheet, Tag, Field } from '../ui';
import { C, alt } from '../theme';
import { fmtDate, inr } from '../utils/format';
import { useDebounced } from '../useDebounced';

const o = (a) => a.map((x) => ({ value: x, label: x }));
const STAGES = o(['Enquiry', 'Counselling', 'Registered', 'Enrolled', 'Completed', 'Dropped']);
const STATUSES = o(['Pending', 'Confirmed', 'Cancelled']);

/** New / edit admission (POST /admissions, PUT /admissions/:id). Customer & course are fixed once created, exactly like the website. */
function AdmissionSheet({ visible, onClose, row, lk, onSaved }) {
  const blank = { customer: '', course: '', stage: 'Enquiry', status: 'Pending', admissionDate: '', fee: '' };
  const [v, setV] = useState(blank); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (!visible) return; setErr(''); setV(row ? { customer: row.customer?._id, course: row.course?._id, stage: row.stage, status: row.status, admissionDate: row.admissionDate ? String(row.admissionDate).slice(0, 10) : '', fee: row.fee != null ? String(row.fee) : '' } : blank); }, [visible, row]); // eslint-disable-line
  const set = (k) => (x) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    if (!row && (!v.customer || !v.course)) return setErr('Select a customer and a course.');
    setBusy(true); setErr('');
    try {
      const body = { stage: v.stage, status: v.status, admissionDate: v.admissionDate || undefined, ...(v.fee !== '' ? { fee: Number(v.fee) } : {}) };
      if (row) await api.put(`/admissions/${row._id}`, body); else await api.post('/admissions', { ...body, customer: v.customer, course: v.course });
      onSaved?.(); onClose();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={row ? 'Edit admission' : 'New admission'}>
      {err ? <View style={{ backgroundColor: C.redBg, padding: 10, borderRadius: 10, marginBottom: 12 }}><Text style={{ color: C.red, fontSize: 13 }}>{err}</Text></View> : null}
      {row ? <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 14 }}>{row.customer?.name} · {row.course?.name}</Text> : <>
        <SelectField label="Customer *" value={v.customer} options={lk.customers} onChange={set('customer')} placeholder="Select customer" />
        <SelectField label="Course *" value={v.course} options={lk.courses} onChange={(x) => { set('course')(x); const c = lk.courses.find((k) => k.value === x); if (c && v.fee === '' && c.fee != null) set('fee')(String(c.fee)); }} placeholder="Select course" />
      </>}
      <SelectField label="Enrollment stage" value={v.stage} options={STAGES} onChange={set('stage')} />
      <SelectField label="Admission status" value={v.status} options={STATUSES} onChange={set('status')} />
      <DateField label="Admission date" value={v.admissionDate} onChange={set('admissionDate')} />
      <Field label="Fee amount (₹)" value={v.fee} onChangeText={(t) => set('fee')(t.replace(/[^\d.]/g, ''))} keyboardType="numeric" />
      <View style={{ flexDirection: 'row', gap: 10 }}><Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} /><Button title="Save" onPress={save} busy={busy} style={{ flex: 1 }} /></View>
    </Sheet>
  );
}

function List({ list, pad, ...p }) {
  return <FlatList {...p} contentContainerStyle={{ padding: 16, paddingBottom: pad, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[C.brand500]} />} onEndReachedThreshold={0.4} onEndReached={list.loadMore} ListFooterComponent={list.more ? <ActivityIndicator color={C.brand500} style={{ margin: 16 }} /> : null} />;
}

/** "Courses & Admissions" — Admissions (GET/POST/PUT /admissions) and Courses (GET /courses, read-only for Sales Executives). */
export default function Admissions() {
  const insets = useSafeAreaInsets(); const lk = useLookups(); const [tab, setTab] = useState('Admissions');
  const [q, setQ] = useState(''); const dq = useDebounced(q.trim()); const [stage, setStage] = useState(''); const [status, setStatus] = useState(''); const [course, setCourse] = useState(''); const [sheet, setSheet] = useState(null);
  const adm = usePaged('/admissions', { stage, status, course }, [...EV.adm, ...EV.customer]);
  const crs = usePaged('/courses', { q: dq }, []);
  const pad = insets.bottom + 96;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>Track enrollment stages, fees and admission status</Text>
        <View style={{ flexDirection: 'row' }}><Chip label="Admissions" active={tab === 'Admissions'} onPress={() => setTab('Admissions')} /><Chip label="Courses" active={tab === 'Courses'} onPress={() => setTab('Courses')} /></View>
        {tab === 'Admissions' ? <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SelectField value={stage} options={STAGES} onChange={setStage} placeholder="Stage: All" allowClear style={{ flex: 1, marginBottom: 10 }} />
            <SelectField value={status} options={STATUSES} onChange={setStatus} placeholder="Status: All" allowClear style={{ flex: 1, marginBottom: 10 }} />
          </View>
          <SelectField value={course} options={lk.courses} onChange={setCourse} placeholder="Course: All" allowClear style={{ marginBottom: 0 }} />
        </View> : <SearchBox value={q} onChangeText={setQ} placeholder="Search courses" style={{ marginTop: 12 }} />}
      </View>
      {tab === 'Admissions' ? (adm.loading ? <Loading /> : adm.error && !adm.items.length ? <ErrorState message={adm.error} onRetry={adm.retry} /> : (
        <List list={adm} pad={pad} data={adm.items} keyExtractor={(a) => a._id} ListEmptyComponent={<Empty icon="school-outline" title="No admissions found" sub="Tap + to create an admission for one of your customers." />}
          renderItem={({ item: a, index }) => (
            <Card accent={alt(index)} onPress={() => setSheet(a)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', fontSize: 15, color: C.text }} numberOfLines={1}>{a.customer?.name || '—'}</Text><Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }} numberOfLines={1}>{a.customer?.phone}</Text></View>
                <Ionicons name="create-outline" size={18} color={C.muted} />
              </View>
              <Text style={{ fontSize: 13, color: C.text, marginTop: 8 }} numberOfLines={1}>{a.course?.name || '—'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}><Tag text={a.stage} /><Tag text={a.status} /></View>
              <KV label="Admission date" value={fmtDate(a.admissionDate)} /><KV label="Fee" value={inr(a.fee)} />
            </Card>)} />
      )) : (crs.loading ? <Loading /> : crs.error && !crs.items.length ? <ErrorState message={crs.error} onRetry={crs.retry} /> : (
        <List list={crs} pad={insets.bottom + 24} data={crs.items} keyExtractor={(c) => c._id} ListEmptyComponent={<Empty icon="book-outline" title="No courses found" />}
          renderItem={({ item: c, index }) => (
            <Card accent={alt(index)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><Text style={{ flex: 1, fontWeight: '700', fontSize: 15, color: C.text }} numberOfLines={2}>{c.name}</Text><Tag text={c.active ? 'Active' : 'Inactive'} /></View>
              <View style={{ marginTop: 8 }}><KV label="Fee" value={inr(c.fee)} /><KV label="Duration" value={c.duration || '—'} /></View>
              {c.description ? <Text style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{c.description}</Text> : null}
            </Card>)} />
      ))}
      {tab === 'Admissions' ? <Fab onPress={() => setSheet('new')} label="New admission" icon="add" /> : null}
      <AdmissionSheet visible={!!sheet} onClose={() => setSheet(null)} row={sheet && sheet !== 'new' ? sheet : null} lk={lk} onSaved={adm.reload} />
    </View>
  );
}
