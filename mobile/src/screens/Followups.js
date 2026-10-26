import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { useFetch } from '../useFetch';
import { EV, useLive } from '../realtime';
import { Avatar, Card, Empty, ErrorState, Loading, StatusBadge } from '../ui';
import { ScreenHeader } from '../drawer';
import { C, alt } from '../theme';
import { dueState, fmtDateTime } from '../utils/format';

/** "Follow-ups" — the lead follow-up schedule (GET /mobile/followups): overdue / today / upcoming. */
export default function Followups({ navigation }) {
  const focused = useIsFocused(); const insets = useSafeAreaInsets();
  const fups = useFetch(async () => (await api.get('/mobile/followups')).data, []);
  useLive([...EV.lead, ...EV.task], fups.reload);
  const F = fups.data;
  const due = F ? F.overdue.length + F.today.length : 0;
  const row = (l, i) => (
    <Card accent={alt(i)} key={l._id} onPress={() => navigation.navigate('LeadDetail', { id: l._id })} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar name={l.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>{l.name}</Text>
        <Text style={{ fontSize: 12, color: dueState(l.nextFollowUp) === 'overdue' ? C.red : C.sub, marginTop: 2 }} numberOfLines={1}>{fmtDateTime(l.nextFollowUp)} · {l.course?.name || l.leadId}</Text>
      </View>
      <StatusBadge status={l.status} />
    </Card>
  );
  const head = (txt, n, color) => (n ? <Text style={{ fontSize: 13, fontWeight: '800', color: color || C.sub, marginTop: 8, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{txt} ({n})</Text> : null);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {focused && <StatusBar style="dark" />}
      <ScreenHeader title="Follow-ups" subtitle={F ? `${due} due today or overdue` : 'Leads to call back'} />
      {fups.loading ? <Loading /> : fups.error && !F ? <ErrorState message={fups.error} onRetry={fups.retry} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={fups.refreshing} onRefresh={fups.refresh} colors={[C.brand500]} />}>
          {due + F.upcoming.length === 0 ? <Empty icon="calendar-outline" title="No follow-ups scheduled" sub="Open a lead and set a next follow-up date to see it here." /> : <>
            {head('Overdue', F.overdue.length, C.red)}{F.overdue.map(row)}
            {head('Today', F.today.length, C.warn)}{F.today.map(row)}
            {head('Upcoming', F.upcoming.length)}{F.upcoming.map(row)}
          </>}
        </ScrollView>
      )}
    </View>
  );
}
