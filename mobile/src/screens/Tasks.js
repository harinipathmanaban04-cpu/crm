import { useState } from 'react';
import { Alert, RefreshControl, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import api, { errMsg } from '../api';
import { useFetch } from '../useFetch';
import { EV, useLive } from '../realtime';
import { Button, Card, Chip, Empty, ErrorState, Loading, Pill, PriorityDot } from '../ui';
import { C, alt } from '../theme';
import { dueState, fmtDateTime } from '../utils/format';

function TaskCard({ t, onChange, navigation, i }) {
  const [busy, setBusy] = useState(false); const ds = ['To Do', 'In Progress'].includes(t.status) ? dueState(t.dueDate) : null;
  const set = async (status) => { setBusy(true); try { await api.put(`/tasks/${t._id}`, { status }); await onChange(); } catch (e) { Alert.alert('Could not update task', errMsg(e)); } finally { setBusy(false); } };
  return (
    <Card accent={alt(i)} style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ flex: 1, fontWeight: '700', fontSize: 15, color: C.text, textDecorationLine: t.status === 'Completed' ? 'line-through' : 'none' }}>{t.title}</Text>
        <PriorityDot p={t.priority} />
      </View>
      {t.description ? <Text style={{ color: C.sub, fontSize: 13, marginTop: 4 }} numberOfLines={3}>{t.description}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <Pill text={t.status} fg={t.status === 'Completed' ? C.green : C.blue} bg={t.status === 'Completed' ? C.greenBg : C.blueBg} />
        {t.dueDate ? <Pill icon="time-outline" text={`Due ${fmtDateTime(t.dueDate)}`} fg={ds === 'overdue' ? C.red : C.sub} bg={ds === 'overdue' ? C.redBg : C.border} /> : null}
        {t.lead ? <Pill icon="person-outline" text={t.lead.name} fg={C.brand700} bg={C.brand100} /> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {t.lead ? <Button small variant="ghost" title="Open lead" icon="open-outline" onPress={() => navigation.navigate('LeadDetail', { id: t.lead._id })} /> : null}
        {t.status === 'To Do' ? <Button small variant="soft" title="Start" icon="play" busy={busy} onPress={() => set('In Progress')} /> : null}
        {['To Do', 'In Progress'].includes(t.status) ? <Button small title="Complete" icon="checkmark" busy={busy} onPress={() => set('Completed')} /> : null}
        {t.status === 'Completed' ? <Button small variant="ghost" title="Reopen" icon="refresh" busy={busy} onPress={() => set('To Do')} /> : null}
      </View>
    </Card>
  );
}

/** "My Tasks" — tasks assigned to the Sales Executive (GET/PUT /tasks), live-updated over the socket. */
export default function MyTasks({ navigation }) {
  const insets = useSafeAreaInsets(); const [filter, setFilter] = useState('open');
  const tasks = useFetch(async () => (await api.get('/tasks', { params: { limit: 100 } })).data.items, []);
  useLive([...EV.task, ...EV.lead], tasks.reload);
  const T = tasks.data || [];
  const open = T.filter((t) => ['To Do', 'In Progress'].includes(t.status));
  const sections = filter === 'open'
    ? [['Overdue', open.filter((t) => dueState(t.dueDate) === 'overdue')], ['Due today', open.filter((t) => dueState(t.dueDate) === 'today')], ['Upcoming / no date', open.filter((t) => !['overdue', 'today'].includes(dueState(t.dueDate)))]]
    : [['Completed', T.filter((t) => t.status === 'Completed')], ['Cancelled', T.filter((t) => t.status === 'Cancelled')]];
  const head = (txt, n, color) => <Text style={{ fontSize: 13, fontWeight: '800', color: color || C.sub, marginTop: 8, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{txt} ({n})</Text>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row' }}><Chip label={`Open${tasks.data ? ` (${open.length})` : ''}`} active={filter === 'open'} onPress={() => setFilter('open')} /><Chip label="Done / cancelled" active={filter === 'done'} onPress={() => setFilter('done')} /></View>
      </View>
      {tasks.loading ? <Loading /> : tasks.error && !tasks.data ? <ErrorState message={tasks.error} onRetry={tasks.retry} /> : (
        <SectionList sections={sections.filter(([, d]) => d.length).map(([title, data]) => ({ title, data }))} keyExtractor={(t) => t._id} stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => head(section.title, section.data.length, section.title === 'Overdue' ? C.red : undefined)} renderItem={({ item, index }) => <TaskCard t={item} i={index} onChange={tasks.reload} navigation={navigation} />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={tasks.refreshing} onRefresh={tasks.refresh} colors={[C.brand500]} />}
          ListEmptyComponent={<Empty icon="checkmark-done-circle-outline" title={filter === 'open' ? 'No open tasks' : 'Nothing here yet'} sub="Tasks assigned to you by your admin appear here." />} />
      )}
    </View>
  );
}
