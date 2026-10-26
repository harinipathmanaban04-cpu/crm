import { RefreshControl, ScrollView, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import api from '../api';
import { useAuth } from '../auth';
import { useFetch } from '../useFetch';
import { EV, useLive, useRealtime } from '../realtime';
import { Avatar, Card, Empty, ErrorState, Loading, OfflineBanner, SectionTitle, StatusBadge } from '../ui';
import { MenuButton } from '../drawer';
import { C, STATUS, alt } from '../theme';
import { fmtDateTime } from '../utils/format';

const Stat = ({ icon, label, value, tint, bg, onPress, i }) => (
  <Card accent={alt(i)} onPress={onPress} style={{ width: '48.5%', marginBottom: 12 }}>
    <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={18} color={tint} /></View>
    <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, marginTop: 10 }}>{value ?? 0}</Text>
    <Text style={{ fontSize: 12, color: C.sub }} numberOfLines={1}>{label}</Text>
  </Card>
);

export default function Dashboard({ navigation }) {
  const { user } = useAuth(); const { connected } = useRealtime(); const insets = useSafeAreaInsets(); const focused = useIsFocused();
  const { data, loading, error, refreshing, refresh, reload, retry } = useFetch(async () => {
    const [d, f] = await Promise.all([api.get('/dashboard'), api.get('/mobile/followups')]);
    return { ...d.data, followups: f.data };
  }, []);
  useLive([...EV.lead, ...EV.task], reload);
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (loading) return <Loading />;
  if (error && !data) return <ErrorState message={error} onRetry={retry} />;
  const st = data.stats; const due = [...data.followups.overdue, ...data.followups.today].slice(0, 5);
  const maxBar = Math.max(1, ...data.charts.leadStatus.map((x) => x.value));
  const goLeads = (status) => navigation.navigate('Leads', { status });
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {focused && <StatusBar style="light" />}
      <View style={{ backgroundColor: C.hero, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <MenuButton light />
          <Avatar name={user.name} size={46} uri={user.avatar} />
          <View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: '#fff', opacity: 0.75 }} numberOfLines={1}>{greet}</Text><Text style={{ fontSize: 19, fontWeight: '800', color: '#fff' }} numberOfLines={1}>{user.name}</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected ? C.green : C.coral }} /><Text style={{ fontSize: 11, fontWeight: '700', color: C.text }}>{connected ? 'Live' : 'Offline'}</Text>
          </View>
        </View>
      </View>
      <OfflineBanner show={!connected} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[C.brand500]} />}>
        {error ? <Text style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Stat icon="people" label="My leads" value={st.totalLeads} tint={C.blue} bg={C.blueBg} onPress={() => goLeads('')}  i={0} />
          <Stat icon="sparkles" label="New leads" value={st.newLeads} tint={C.brand700} bg={C.brand100} onPress={() => goLeads('New')}  i={1} />
          <Stat icon="call" label="Follow-ups due" value={st.dueToday} tint="#7E22CE" bg="#F3E8FF" onPress={() => navigation.navigate('Followups')}  i={2} />
          <Stat icon="checkmark-done" label="Converted" value={st.converted} tint={C.green} bg={C.greenBg} onPress={() => goLeads('Converted')}  i={3} />
          <Stat icon="list" label="Open tasks" value={st.pending} tint="#0E7490" bg="#CFFAFE" onPress={() => navigation.navigate('MyTasks')}  i={4} />
          <Stat icon="alert-circle" label="Overdue tasks" value={st.overdue} tint={C.red} bg={C.redBg} onPress={() => navigation.navigate('MyTasks')}  i={5} />
        </View>

        <SectionTitle right={<Pressable onPress={() => navigation.navigate('Followups')} hitSlop={10}><Text style={{ color: C.brand700, fontWeight: '700', fontSize: 13 }}>See all</Text></Pressable>}>Follow-ups to do</SectionTitle>
        {due.length === 0 ? <Card><Empty icon="happy-outline" title="You're all caught up" sub="No follow-ups due today." /></Card> :
          due.map((l, i) => (
            <Card accent={alt(i)} key={l._id} onPress={() => navigation.navigate('LeadDetail', { id: l._id })} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={l.name} size={38} />
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>{l.name}</Text><Text style={{ fontSize: 12, color: new Date(l.nextFollowUp) < new Date() ? C.red : C.sub }}>{fmtDateTime(l.nextFollowUp)}</Text></View>
              <StatusBadge status={l.status} />
            </Card>
          ))}

        <SectionTitle>Lead pipeline</SectionTitle>
        <Card accent={alt(0)}>
          {data.charts.leadStatus.map((x) => (
            <Pressable key={x.name} onPress={() => goLeads(x.name)} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 5 }}>
              <Text style={{ width: 124, fontSize: 12, color: C.sub }} numberOfLines={1}>{x.name}</Text>
              <View style={{ flex: 1, height: 10, backgroundColor: C.bg, borderRadius: 5 }}><View style={{ width: `${(x.value / maxBar) * 100}%`, height: 10, borderRadius: 5, backgroundColor: STATUS[x.name]?.[0] || C.brand500 }} /></View>
              <Text style={{ width: 30, textAlign: 'right', fontWeight: '700', color: C.text, fontSize: 13 }}>{x.value}</Text>
            </Pressable>
          ))}
        </Card>

        <SectionTitle>Recently assigned</SectionTitle>
        {data.recent.leads.length === 0 ? <Card><Empty title="No leads yet" sub="Leads assigned to you by your admin will appear here." /></Card> :
          data.recent.leads.map((l, i) => (
            <Card accent={alt(i)} key={l._id} onPress={() => navigation.navigate('LeadDetail', { id: l._id })} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={l.name} size={38} />
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>{l.name}</Text><Text style={{ fontSize: 12, color: C.sub }}>{l.leadId}</Text></View>
              <StatusBadge status={l.status} />
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}
