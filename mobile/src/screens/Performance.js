import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api, { errMsg } from '../api';
import { useFetch } from '../useFetch';
import { EV, useLive } from '../realtime';
import { Button, Card, DateField, Empty, ErrorState, KV, Loading, SectionTitle, Tag } from '../ui';
import { C, alt } from '../theme';
import { inr } from '../utils/format';

const Stat = ({ icon, label, value, i }) => (
  <Card accent={alt(i)} style={{ width: '48%', marginBottom: 12, padding: 12 }}>
    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.brand100, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={17} color={C.brand700} /></View>
    <Text style={{ fontSize: 24, fontWeight: '800', color: C.text, marginTop: 8 }}>{value ?? 0}</Text>
    <Text style={{ fontSize: 12, color: C.sub }} numberOfLines={1}>{label}</Text>
  </Card>
);

/** "My Performance" — GET /reports/summary (+ CSV exports via GET /reports/export/:type, shared through the Android share sheet). */
export default function Performance() {
  const insets = useSafeAreaInsets(); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [busy, setBusy] = useState('');
  const f = useFetch(async () => (await api.get('/reports/summary', { params: { ...(from && { from }), ...(to && { to }) } })).data, [from, to]);
  useLive([...EV.lead, ...EV.task, ...EV.customer, ...EV.adm, ...EV.pay], f.reload);
  const d = f.data;
  const exportCsv = async (type) => {
    setBusy(type);
    try {
      const { data } = await api.get(`/reports/export/${type}`, { params: { ...(from && { from }), ...(to && { to }) }, responseType: 'text', transformResponse: (r) => r });
      await Share.share({ title: `${type}.csv`, message: String(data).replace(/^\uFEFF/, '') });
    } catch (e) { Alert.alert('Could not export', errMsg(e)); } finally { setBusy(''); }
  };
  if (f.loading) return <Loading />;
  if (f.error && !d) return <ErrorState message={f.error} onRetry={f.retry} />;
  const me = d.byExecutive[0];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} refreshControl={<RefreshControl refreshing={f.refreshing} onRefresh={f.refresh} colors={[C.brand500]} />}>
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <DateField label="From" value={from} onChange={setFrom} style={{ flex: 1, marginBottom: 10 }} />
        <DateField label="To" value={to} onChange={setTo} style={{ flex: 1, marginBottom: 10 }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Stat icon="alarm-outline" label="Follow-ups overdue" value={d.followUps.overdue} i={0} />
        <Stat icon="today-outline" label="Follow-ups today" value={d.followUps.today} i={1} />
        <Stat icon="calendar-outline" label="Follow-ups next 7 days" value={d.followUps.next7} i={2} />
      </View>

      <SectionTitle>My lead & task performance</SectionTitle>
      {me ? (
        <Card accent={alt(0)}>
          <KV label="Leads" value={me.leads} /><KV label="Converted" value={me.converted} color={C.green} /><KV label="Lost" value={me.lost} /><KV label="Conversion" value={`${me.rate}%`} />
          <KV label="Follow-ups logged" value={me.followUps} /><KV label="Tasks done" value={`${me.completed}/${me.tasks}`} /><KV label="Open tasks" value={me.open} /><KV label="Overdue tasks" value={me.overdue} color={me.overdue ? C.red : C.text} />
        </Card>) : <Card><Empty title="No data for this range" /></Card>}

      <SectionTitle>Course admissions</SectionTitle>
      {d.admissionsByCourse.length ? d.admissionsByCourse.map((a, i) => (
        <Card key={`${a.course}-${i}`} accent={alt(i)} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: '700', color: C.text, marginBottom: 4 }} numberOfLines={2}>{a.course}</Text>
          <KV label="Admissions" value={a.admissions} /><KV label="Confirmed" value={a.confirmed} color={C.green} /><KV label="Fees" value={inr(a.fees)} />
        </Card>)) : <Card><Empty title="No data for this range" /></Card>}

      <SectionTitle>Outstanding invoices</SectionTitle>
      {d.payments.list.length ? d.payments.list.map((i, k) => (
        <Card key={i._id} accent={alt(k)} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontWeight: '700', color: C.text }}>{i.invoiceNo}</Text><Tag text={i.status} /></View>
          <Text style={{ fontSize: 12, color: C.sub, marginVertical: 4 }}>{i.customer?.name || '—'}</Text>
          <KV label="Total" value={inr(i.total)} /><KV label="Paid" value={inr(i.paid)} color={C.green} /><KV label="Balance" value={inr(i.total - i.paid)} color={C.red} />
        </Card>)) : <Card><Empty title="No outstanding invoices" /></Card>}

      <SectionTitle>Export CSV</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['leads', 'customers', 'tasks'].map((t) => <Button key={t} small variant="ghost" icon="download-outline" title={`${t[0].toUpperCase()}${t.slice(1)} CSV`} busy={busy === t} onPress={() => exportCsv(t)} />)}
      </View>
    </ScrollView>
  );
}
