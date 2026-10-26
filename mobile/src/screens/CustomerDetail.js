import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api from '../api';
import { useFetch } from '../useFetch';
import { useLookups } from '../useLookups';
import { EV, useLive } from '../realtime';
import { Avatar, Card, ErrorState, InfoRow, KV, Loading, SectionTitle, Tag } from '../ui';
import CustomerSheet from '../components/CustomerSheet';
import { C, alt } from '../theme';
import { fmtDate, fmtDateTime, inr, timeAgo } from '../utils/format';
import { DEFAULT_COUNTRY_CODE } from '../config';
import { mailUrl, telUrl, waUrl } from '../utils/urls';

const open = (url, what) => Linking.openURL(url).catch(() => Alert.alert('Unavailable', `No app found to ${what} on this device.`));
const Action = ({ icon, label, color, bg, onPress, disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}>
    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={22} color={color} /></View>
    <Text style={{ fontSize: 12, color: C.text, marginTop: 6, fontWeight: '600' }}>{label}</Text>
  </Pressable>
);

/** Customer profile (GET /customers/:id/profile): details, admissions, invoices & payments, change history, activity. */
export default function CustomerDetail({ route, navigation }) {
  const { id } = route.params; const insets = useSafeAreaInsets(); const lk = useLookups(); const [edit, setEdit] = useState(false);
  const f = useFetch(async () => (await api.get(`/customers/${id}/profile`)).data, [id]);
  useLive([...EV.customer, ...EV.adm, ...EV.pay], f.reload);
  const d = f.data; const c = d?.customer;
  useEffect(() => {
    if (!c) return;
    navigation.setOptions({ title: c.name, headerRight: () => <Pressable onPress={() => setEdit(true)} hitSlop={10} accessibilityLabel="Edit customer"><Ionicons name="create-outline" size={22} color="#fff" /></Pressable> });
  }, [c?.name]); // eslint-disable-line
  if (f.loading) return <Loading />;
  if (f.error && !d) return <ErrorState message={f.error} onRetry={f.retry} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} refreshControl={<RefreshControl refreshing={f.refreshing} onRefresh={f.refresh} colors={[C.brand500]} />}>
        <Card accent={alt(0)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={c.name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: C.text }} numberOfLines={2}>{c.name}</Text>
              <Text style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>Customer since {fmtDate(c.createdAt)}</Text>
              <Tag text={c.admissionStatus} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 18 }}>
            <Action icon="call" label="Call" color={C.green} bg={C.greenBg} onPress={() => open(telUrl(c.phone), 'place a call')} />
            <Action icon="logo-whatsapp" label="WhatsApp" color="#15803D" bg="#DCFCE7" onPress={() => open(waUrl(c.phone, `Hi ${c.name}, this is from Eco Friendly Tech Solutions.`, DEFAULT_COUNTRY_CODE), 'open WhatsApp')} />
            <Action icon="mail" label="Email" color={C.blue} bg={C.blueBg} disabled={!c.email} onPress={() => open(mailUrl(c.email, 'Eco Friendly Tech Solutions'), 'send email')} />
            <Action icon="chatbox" label="SMS" color={C.brand700} bg={C.brand100} onPress={() => open(`sms:${c.phone}`, 'send SMS')} />
          </View>
        </Card>

        <SectionTitle>Details</SectionTitle>
        <Card accent={alt(1)}>
          <InfoRow icon="call-outline" label="Phone" value={c.phone} onPress={() => open(telUrl(c.phone), 'place a call')} />
          <InfoRow icon="mail-outline" label="Email" value={c.email} />
          <InfoRow icon="school-outline" label="Course" value={c.course?.name} />
          <InfoRow icon="person-outline" label="Owner" value={c.owner?.name} />
          <InfoRow icon="people-outline" label="Team" value={c.team?.name} />
          <InfoRow icon="create-outline" label="Created by" value={c.createdBy?.name} />
          {c.notes ? <InfoRow icon="document-text-outline" label="Notes" value={c.notes} /> : null}
        </Card>

        <SectionTitle>Admissions</SectionTitle>
        {d.admissions.length ? d.admissions.map((a, i) => (
          <Card key={a._id} accent={alt(i)} style={{ marginBottom: 10 }}>
            <Text style={{ fontWeight: '700', color: C.text }}>{a.course?.name || '—'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}><Tag text={a.stage} /><Tag text={a.status} /></View>
            <KV label="Admission date" value={fmtDate(a.admissionDate)} /><KV label="Fee" value={inr(a.fee)} />
          </Card>
        )) : <Text style={{ color: C.muted, textAlign: 'center' }}>No admissions yet.</Text>}

        <SectionTitle>Invoices & payments</SectionTitle>
        {d.invoices.length ? d.invoices.map((inv, i) => (
          <Card key={inv._id} accent={alt(i)} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontWeight: '700', color: C.text }}>{inv.invoiceNo}</Text><Tag text={inv.status} /></View>
            <View style={{ marginTop: 8 }}><KV label="Total" value={inr(inv.total)} /><KV label="Paid" value={inr(inv.paid)} color={C.green} /><KV label="Balance" value={inr(inv.total - inv.paid)} color={inv.total - inv.paid > 0 ? C.red : C.text} /></View>
          </Card>
        )) : <Text style={{ color: C.muted, textAlign: 'center' }}>No invoices yet.</Text>}
        {d.payments.map((p) => (
          <View key={p._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Ionicons name="cash-outline" size={18} color={C.brand700} />
            <Text style={{ flex: 1, fontSize: 13, color: C.text }} numberOfLines={1}>{inr(p.amount)} · {p.method} · {p.invoice?.invoiceNo || '—'}</Text><Tag text={p.status} />
          </View>
        ))}

        <SectionTitle>Change history</SectionTitle>
        {c.history?.length ? [...c.history].reverse().map((h, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: C.text }}>{h.changes.map((x) => (x.field === 'created' ? 'Created record' : `${x.field}: ${x.from || '∅'} → ${x.to || '∅'}`)).join('; ')}</Text>
            <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{h.by?.name || '—'} · {fmtDateTime(h.at)}</Text>
          </View>
        )) : <Text style={{ color: C.muted, textAlign: 'center' }}>None</Text>}

        <SectionTitle>Activity</SectionTitle>
        {d.activity.length ? d.activity.map((a) => (
          <View key={a._id} style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: C.text }}>{a.summary}</Text>
            <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{a.actorName} · {timeAgo(a.createdAt)}</Text>
          </View>
        )) : <Text style={{ color: C.muted, textAlign: 'center' }}>None</Text>}
      </ScrollView>
      <CustomerSheet visible={edit} onClose={() => setEdit(false)} customer={c} courses={lk.courses} onSaved={f.reload} />
    </View>
  );
}
