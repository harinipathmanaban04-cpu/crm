import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useRealtime } from '../realtime';
import { Card, Empty, ErrorState } from '../ui';
import { ScreenHeader } from '../drawer';
import { C, alt } from '../theme';
import { timeAgo } from '../utils/format';

const META = { lead_assigned: ['person-add', C.blue, C.blueBg], task_assigned: ['clipboard', '#7E22CE', '#F3E8FF'], followup_due: ['alarm', C.warn, C.warnBg], task_overdue: ['alert-circle', C.red, C.redBg] };

export default function Notifications({ navigation }) {
  const focused = useIsFocused(); const { items, unread, markAllRead, refreshNotifications, notifError } = useRealtime();
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { refreshNotifications(); return () => markAllRead(); }, [])); // eslint-disable-line
  const pull = async () => { setRefreshing(true); await refreshNotifications(); setRefreshing(false); };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {focused && <StatusBar style="dark" />}
      <ScreenHeader title="Notifications" subtitle={unread ? `${unread} new` : 'You are up to date'} />
      {notifError && !items.length ? <ErrorState message={notifError} onRetry={refreshNotifications} /> : (
        <FlatList data={items} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} colors={[C.brand500]} />}
          ListEmptyComponent={<Empty icon="notifications-off-outline" title="No notifications" sub="New lead assignments, tasks and follow-up reminders will show up here." />}
          renderItem={({ item: n, index }) => { const [icon, fg, bg] = META[n.type] || META.lead_assigned; return (
            <Card accent={alt(index)} onPress={n.leadId ? () => navigation.navigate('LeadDetail', { id: n.leadId }) : () => navigation.navigate('MyTasks')} style={{ marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={fg} /></View>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: C.text }}>{n.title}</Text><Text style={{ color: C.sub, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{n.body}</Text><Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{['followup_due', 'task_overdue'].includes(n.type) ? 'Scheduled ' : ''}{timeAgo(n.at)}</Text></View>
              {items.findIndex((x) => x.id === n.id) < unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.brand500 }} /> : null}
            </Card>); }} />
      )}
    </View>
  );
}
// A dot is shown on the `unread` newest items (the feed is sorted newest first); they are marked read when you leave the tab.
