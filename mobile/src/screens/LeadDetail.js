import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import api, { errMsg } from '../api';
import { useFetch } from '../useFetch';
import { EV, useLive } from '../realtime';
import { Avatar, Button, Card, Chip, ErrorState, Field, InfoRow, Loading, Pill, PriorityDot, SectionTitle, StatusBadge } from '../ui';
import { C, LEAD_STATUSES, PRIORITIES, STATUS, dedupeStatuses, alt } from '../theme';
import { addDays, dueState, fmtDate, fmtDateTime, timeAgo } from '../utils/format';
import { mailUrl, telUrl, waUrl } from '../utils/urls';
import { DEFAULT_COUNTRY_CODE } from '../config';

const open = (url, what) => Linking.openURL(url).catch(() => Alert.alert('Unavailable', `No app found to ${what} on this device.`));

function pickDateTime(initial) {
  return new Promise((resolve) => {
    if (Platform.OS !== 'android') return resolve(null);
    const base = initial && new Date(initial) > new Date() ? new Date(initial) : addDays(1);
    DateTimePickerAndroid.open({ value: base, mode: 'date', minimumDate: new Date(), onChange: (e, d) => {
      if (e.type !== 'set') return resolve(null);
      DateTimePickerAndroid.open({ value: d, mode: 'time', is24Hour: false, onChange: (e2, t) => { if (e2.type !== 'set') return resolve(null); const r = new Date(d); r.setHours(t.getHours(), t.getMinutes(), 0, 0); resolve(r); } });
    } });
  });
}

const Action = ({ icon, label, color, bg, onPress, disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1, alignItems: 'center', opacity: disabled ? 0.4 : 1 }}>
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={24} color={color} /></View>
    <Text style={{ fontSize: 12, color: C.text, marginTop: 6, fontWeight: '600' }}>{label}</Text>
  </Pressable>
);

export default function LeadDetail({ route, navigation }) {
  const { id } = route.params; const insets = useSafeAreaInsets();
  const { data: lead, loading, error, refreshing, refresh, reload, retry } = useFetch(async () => {
    const { data } = await api.get(`/leads/${id}`);
    let customer = null;
    if (data.customer) { try { customer = (await api.get(`/customers/${data.customer}`)).data; } catch { /* customer may be hidden */ } }
    navigation.setOptions({ title: data.name });
    return { ...data, customerDoc: customer };
  }, [id]);
  useLive(EV.lead, reload);
  const [note, setNote] = useState(''); const [noteNext, setNoteNext] = useState(null); const [busy, setBusy] = useState('');

  if (loading) return <Loading />;
  if (error && !lead) return <ErrorState message={error} onRetry={retry} />;

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); await reload(); if (okMsg) Alert.alert('Done', okMsg); } catch (e) { Alert.alert('Could not save', errMsg(e)); } finally { setBusy(''); }
  };
  const put = (body) => api.put(`/leads/${id}`, body);
  const setStatus = (s) => { if (s === lead.status) return; Alert.alert('Update status', `Change status to "${s}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Update', onPress: () => run('status', () => put({ status: s })) }]); };
  const setPriority = (p) => p !== lead.priority && run('priority', () => put({ priority: p }));
  const setFollow = (d) => run('follow', () => put({ nextFollowUp: d ? d.toISOString() : null }));
  const customPick = async () => { const d = await pickDateTime(lead.nextFollowUp); if (d) setFollow(d); };
  const addNote = () => {
    if (!note.trim()) return Alert.alert('Note is empty', 'Write something before saving.');
    run('note', async () => { await api.post(`/leads/${id}/followup`, { note: note.trim(), next: (noteNext || (lead.nextFollowUp ? new Date(lead.nextFollowUp) : null))?.toISOString() || null }); setNote(''); setNoteNext(null); }, 'Note added.');
  };
  const convert = () => Alert.alert('Convert to customer', `Create a customer record for ${lead.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Convert', onPress: () => run('convert', () => api.post(`/leads/${id}/convert`), 'Lead converted to customer.') }]);

  const ds = lead.nextFollowUp && !['Converted', 'Lost'].includes(lead.status) ? dueState(lead.nextFollowUp) : null;
  const timeline = [
    ...(lead.followUps || []).map((f) => ({ k: `f${f._id}`, at: f.date, icon: 'chatbubble-ellipses', title: f.note, sub: `${f.by?.name || 'You'}${f.next ? ` · next: ${fmtDateTime(f.next)}` : ''}` })),
    ...(lead.history || []).map((h) => ({ k: `h${h._id}`, at: h.at, icon: 'swap-horizontal', title: h.type === 'created' ? 'Lead created' : h.type === 'reassigned' ? 'Lead re-assigned' : 'Lead assigned', sub: `${h.by?.name ? `by ${h.by.name}` : ''}${h.to?.name ? ` → ${h.to.name}` : ''}` })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const cd = lead.customerDoc;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.brand500]} />}>
        <Card accent={alt(0)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={lead.name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: '800', color: C.text }}>{lead.name}</Text>
              <Text style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>{lead.leadId} · created {fmtDate(lead.createdAt)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><StatusBadge status={lead.status} /><PriorityDot p={lead.priority} /></View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginTop: 18 }}>
            <Action icon="call" label="Call" color={C.green} bg={C.greenBg} onPress={() => open(telUrl(lead.phone), 'place a call')} />
            <Action icon="logo-whatsapp" label="WhatsApp" color="#15803D" bg="#DCFCE7" onPress={() => open(waUrl(lead.phone, `Hi ${lead.name}, this is from Eco Friendly Tech Solutions.`, DEFAULT_COUNTRY_CODE), 'open WhatsApp')} />
            <Action icon="mail" label="Email" color={C.blue} bg={C.blueBg} disabled={!lead.email} onPress={() => open(mailUrl(lead.email, 'Eco Friendly Tech Solutions'), 'send email')} />
            <Action icon="chatbox" label="SMS" color={C.brand700} bg={C.brand100} onPress={() => open(`sms:${lead.phone}`, 'send SMS')} />
          </View>
        </Card>

        <SectionTitle>Customer information</SectionTitle>
        <Card accent={alt(1)}>
          <InfoRow icon="call-outline" label="Phone" value={lead.phone} onPress={() => open(telUrl(lead.phone), 'place a call')} />
          <InfoRow icon="mail-outline" label="Email" value={lead.email} onPress={lead.email ? () => open(mailUrl(lead.email), 'send email') : undefined} />
          {lead.address ? <InfoRow icon="location-outline" label="Address" value={lead.address} /> : null}
          <InfoRow icon="school-outline" label="Interested course" value={lead.course?.name} />
          <InfoRow icon="megaphone-outline" label="Source" value={lead.source} />
          <InfoRow icon="person-outline" label="Assigned by" value={lead.createdBy?.name || lead.admin?.name} />
          <InfoRow icon="people-outline" label="Team" value={lead.team?.name} />
          {lead.notes ? <InfoRow icon="document-text-outline" label="Lead notes" value={lead.notes} /> : null}
          {cd ? (<View style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
            <Pill text="Customer record" fg={C.green} bg={C.greenBg} icon="checkmark-circle" />
            <InfoRow icon="school-outline" label="Admission status" value={cd.admissionStatus} />
            <InfoRow icon="calendar-outline" label="Customer since" value={fmtDate(cd.createdAt)} />
          </View>) : null}
        </Card>

        <SectionTitle>Update lead status</SectionTitle>
        <Card accent={alt(2)}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
            {dedupeStatuses(LEAD_STATUSES).map((s) => {
              const active = !!lead.status && lead.status.trim().toLowerCase() === s.trim().toLowerCase();
              return <Chip key={s} label={s} active={active} color={STATUS[s]?.[0]} onPress={() => setStatus(s)} />;
            })}
          </View>
          <Text style={{ fontSize: 12, fontWeight: '600', color: C.sub, marginTop: 14, marginBottom: 8 }}>Priority</Text>
          <View style={{ flexDirection: 'row' }}>{PRIORITIES.map((p) => <Chip key={p} label={p} active={lead.priority === p} onPress={() => setPriority(p)} />)}</View>
          {busy === 'status' || busy === 'priority' ? <Text style={{ color: C.sub, fontSize: 12, marginTop: 8 }}>Saving…</Text> : null}
          {!lead.customer && lead.status !== 'Lost' ? <Button title="Convert to customer" icon="person-add" variant="soft" onPress={convert} busy={busy === 'convert'} style={{ marginTop: 14 }} /> : null}
        </Card>

        <SectionTitle>Next follow-up</SectionTitle>
        <Card accent={alt(3)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Ionicons name="alarm-outline" size={20} color={ds === 'overdue' ? C.red : C.brand700} />
            <Text style={{ fontWeight: '700', color: ds === 'overdue' ? C.red : C.text }}>{lead.nextFollowUp ? fmtDateTime(lead.nextFollowUp) : 'Not scheduled'}</Text>
            {ds === 'overdue' ? <Pill text="Overdue" fg={C.red} bg={C.redBg} /> : ds === 'today' ? <Pill text="Today" fg={C.warn} bg={C.warnBg} /> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
            <Chip label="Tomorrow" onPress={() => setFollow(addDays(1))} /><Chip label="In 3 days" onPress={() => setFollow(addDays(3))} /><Chip label="Next week" onPress={() => setFollow(addDays(7))} />
            <Chip label="Pick date…" onPress={customPick} />{lead.nextFollowUp ? <Chip label="Clear" onPress={() => setFollow(null)} /> : null}
          </View>
        </Card>

        <SectionTitle>Add note</SectionTitle>
        <Card accent={alt(4)}>
          <Field value={note} onChangeText={setNote} multiline placeholder="What did you discuss with the customer?" maxLength={500} style={{ marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <Chip label={noteNext ? `Follow-up: ${fmtDateTime(noteNext)}` : 'Set next follow-up (optional)'} active={!!noteNext} onPress={async () => { const d = await pickDateTime(noteNext); if (d) setNoteNext(d); }} />
            {noteNext ? <Ionicons name="close-circle" size={20} color={C.muted} onPress={() => setNoteNext(null)} /> : null}
          </View>
          <Button title="Save note" icon="save-outline" onPress={addNote} busy={busy === 'note'} />
        </Card>

        <SectionTitle>Activity</SectionTitle>
        {timeline.length === 0 ? <Text style={{ color: C.muted, textAlign: 'center', marginTop: 4 }}>No activity yet.</Text> : timeline.map((t) => (
          <View key={t.k} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.brand100, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={t.icon} size={15} color={C.brand700} /></View>
            <View style={{ flex: 1 }}><Text style={{ color: C.text, fontSize: 14 }}>{t.title}</Text><Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{t.sub ? `${t.sub} · ` : ''}{timeAgo(t.at)}</Text></View>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
