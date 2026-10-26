import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api, { errMsg } from '../api';
import { EV } from '../realtime';
import { usePaged } from '../usePaged';
import { useLookups } from '../useLookups';
import { Button, Card, Chip, DateField, Empty, ErrorState, Field, Fab, KV, Loading, SearchBox, SelectField, Sheet, Tag } from '../ui';
import { C, alt } from '../theme';
import { fmtDate, inr, toIsoDate } from '../utils/format';
import { useDebounced } from '../useDebounced';

const o = (a) => a.map((x) => ({ value: x, label: x }));
const METHODS = o(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Online']);
const INV_STATUS = o(['Pending', 'Partially Paid', 'Paid', 'Failed', 'Refunded']);
const PAY_STATUS = o(['Pending', 'Success', 'Failed', 'Refunded']);

/** Log Payment Update (POST /payments). Sales Executives always log as Pending; an Admin verifies it, as on the website. */
function PaymentSheet({ visible, onClose, lk, onSaved }) {
  const blank = { invoice: '', amount: '', method: 'Cash', txnRef: '', paymentDate: toIsoDate(new Date()) };
  const [v, setV] = useState(blank); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setV({ ...blank, paymentDate: toIsoDate(new Date()) }); setErr(''); } }, [visible]); // eslint-disable-line
  const set = (k) => (x) => setV((p) => ({ ...p, [k]: x }));
  const inv = lk.invoices.find((i) => i.value === v.invoice);
  const save = async () => {
    if (!v.invoice) return setErr('Select an invoice.');
    if (!v.amount || Number(v.amount) <= 0) return setErr('Enter a valid amount.');
    setBusy(true); setErr('');
    try { await api.post('/payments', { invoice: v.invoice, amount: Number(v.amount), method: v.method, txnRef: v.txnRef.trim(), paymentDate: v.paymentDate || undefined }); onSaved?.(); onClose(); }
    catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Log payment update">
      {err ? <View style={{ backgroundColor: C.redBg, padding: 10, borderRadius: 10, marginBottom: 12 }}><Text style={{ color: C.red, fontSize: 13 }}>{err}</Text></View> : null}
      <SelectField label="Invoice *" value={v.invoice} options={lk.invoices} onChange={set('invoice')} placeholder={lk.invoices.length ? 'Select invoice' : 'No open invoices'} />
      {inv ? <Text style={{ fontSize: 12, color: C.sub, marginTop: -6, marginBottom: 12 }}>Total {inr(inv.total)} · Paid {inr(inv.paid)} · Balance {inr(inv.total - inv.paid)}</Text> : null}
      <Field label="Amount (₹) *" value={v.amount} onChangeText={(t) => set('amount')(t.replace(/[^\d.]/g, ''))} keyboardType="numeric" />
      <SelectField label="Method" value={v.method} options={METHODS} onChange={set('method')} />
      <Field label="Transaction reference" value={v.txnRef} onChangeText={set('txnRef')} autoCapitalize="characters" />
      <DateField label="Payment date" value={v.paymentDate} onChange={set('paymentDate')} clearable={false} />
      <Text style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>An Admin verifies this update before it counts as paid.</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}><Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} /><Button title="Submit" onPress={save} busy={busy} style={{ flex: 1 }} /></View>
    </Sheet>
  );
}

function List({ list, pad, ...p }) {
  return <FlatList {...p} contentContainerStyle={{ padding: 16, paddingBottom: pad, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[C.brand500]} />} onEndReachedThreshold={0.4} onEndReached={list.loadMore} ListFooterComponent={list.more ? <ActivityIndicator color={C.brand500} style={{ margin: 16 }} /> : null} />;
}

/** "Payment Updates" — Invoices (GET /invoices, read-only) and Payments (GET/POST /payments). */
export default function Payments() {
  const insets = useSafeAreaInsets(); const lk = useLookups(); const [tab, setTab] = useState('Invoices'); const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(''); const dq = useDebounced(q.trim()); const [invSt, setInvSt] = useState(''); const [payMethod, setPayMethod] = useState(''); const [paySt, setPaySt] = useState('');
  const inv = usePaged('/invoices', { q: dq, status: invSt }, [...EV.pay, ...EV.customer]);
  const pay = usePaged('/payments', { q: dq, status: paySt, method: payMethod }, EV.pay);
  const reloadAll = () => { inv.reload(); pay.reload(); lk.reload(); };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>Log payment updates; an Admin verifies them before they count as paid</Text>
        <View style={{ flexDirection: 'row' }}><Chip label="Invoices" active={tab === 'Invoices'} onPress={() => { setTab('Invoices'); setQ(''); }} /><Chip label="Payments" active={tab === 'Payments'} onPress={() => { setTab('Payments'); setQ(''); }} /></View>
        <SearchBox value={q} onChangeText={setQ} placeholder={tab === 'Invoices' ? 'Search invoice number' : 'Search transaction reference'} style={{ marginTop: 12, marginBottom: 10 }} />
        {tab === 'Invoices' ? <SelectField value={invSt} options={INV_STATUS} onChange={setInvSt} placeholder="Status: All" allowClear style={{ marginBottom: 0 }} /> : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SelectField value={paySt} options={PAY_STATUS} onChange={setPaySt} placeholder="Status: All" allowClear style={{ flex: 1, marginBottom: 0 }} />
            <SelectField value={payMethod} options={METHODS} onChange={setPayMethod} placeholder="Method: All" allowClear style={{ flex: 1, marginBottom: 0 }} />
          </View>)}
      </View>
      {tab === 'Invoices' ? (inv.loading ? <Loading /> : inv.error && !inv.items.length ? <ErrorState message={inv.error} onRetry={inv.retry} /> : (
        <List list={inv} pad={insets.bottom + 96} data={inv.items} keyExtractor={(i) => i._id} ListEmptyComponent={<Empty icon="receipt-outline" title="No invoices found" sub="Invoices are created by your Admin." />}
          renderItem={({ item: i, index }) => (
            <Card accent={alt(index)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Text style={{ fontWeight: '700', fontSize: 15, color: C.text }}>{i.invoiceNo}</Text><Tag text={i.status} /></View>
              <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }} numberOfLines={1}>{i.customer?.name || '—'} · {i.course?.name || 'No course'}</Text>
              <View style={{ marginTop: 8 }}><KV label="Total" value={inr(i.total)} /><KV label="Paid" value={inr(i.paid)} color={C.green} /><KV label="Balance" value={inr(i.total - i.paid)} color={i.total - i.paid > 0 ? C.red : C.text} /><KV label="Last payment" value={i.paymentDate ? `${fmtDate(i.paymentDate)}${i.method ? ` · ${i.method}` : ''}` : '—'} /></View>
            </Card>)} />
      )) : (pay.loading ? <Loading /> : pay.error && !pay.items.length ? <ErrorState message={pay.error} onRetry={pay.retry} /> : (
        <List list={pay} pad={insets.bottom + 96} data={pay.items} keyExtractor={(p) => p._id} ListEmptyComponent={<Empty icon="cash-outline" title="No payments logged" sub="Tap + to log a payment update." />}
          renderItem={({ item: p, index }) => (
            <Card accent={alt(index)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Text style={{ fontWeight: '800', fontSize: 17, color: C.text }}>{inr(p.amount)}</Text><Tag text={p.status} /></View>
              <Text style={{ fontSize: 13, color: C.sub, marginTop: 2 }} numberOfLines={1}>{p.customer?.name || '—'} · {p.invoice?.invoiceNo || '—'}</Text>
              <View style={{ marginTop: 8 }}><KV label="Method" value={p.method} /><KV label="Txn ref" value={p.txnRef || '—'} /><KV label="Date" value={fmtDate(p.paymentDate)} /><KV label="Recorded by" value={p.recordedBy?.name} /></View>
            </Card>)} />
      ))}
      {tab === 'Payments' ? <Fab onPress={() => setSheet(true)} label="Log payment" icon="add" /> : null}
      <PaymentSheet visible={sheet} onClose={() => setSheet(false)} lk={lk} onSaved={reloadAll} />
    </View>
  );
}
