import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { EV } from '../realtime';
import { usePaged } from '../usePaged';
import { useLookups } from '../useLookups';
import { Avatar, Card, Chip, Empty, ErrorState, Fab, Loading, SearchBox, SelectField, Tag } from '../ui';
import CustomerSheet, { ADMISSION_OPTIONS } from '../components/CustomerSheet';
import { C, alt } from '../theme';
import { fmtDate } from '../utils/format';
import { telUrl } from '../utils/urls';
import { useDebounced } from '../useDebounced';

/** "My Customers" — GET /customers (own customers only; scoped by the server), search + Course / Admission filters, add & edit. */
export default function Customers({ navigation }) {
  const insets = useSafeAreaInsets(); const lk = useLookups();
  const [q, setQ] = useState(''); const [adm, setAdm] = useState(''); const [course, setCourse] = useState(''); const [form, setForm] = useState(false); const dq = useDebounced(q.trim());
  const list = usePaged('/customers', { q: dq, admissionStatus: adm, course }, [...EV.customer, ...EV.adm]);
  const filtered = !!(dq || adm || course);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: '#fff', paddingTop: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <SearchBox value={q} onChangeText={setQ} placeholder="Search name, phone, email" style={{ marginHorizontal: 16, marginBottom: 10 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <Chip label="All" active={!adm} onPress={() => setAdm('')} />
          {ADMISSION_OPTIONS.map((o) => <Chip key={o.value} label={o.label} active={adm === o.value} onPress={() => setAdm(o.value)} />)}
        </ScrollView>
        <SelectField value={course} options={lk.courses} onChange={setCourse} placeholder="Course: All" allowClear style={{ marginHorizontal: 16, marginBottom: 12 }} />
      </View>
      {list.loading ? <Loading /> : list.error && !list.items.length ? <ErrorState message={list.error} onRetry={list.retry} /> : (
        <FlatList data={list.items} keyExtractor={(c) => c._id} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 96, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[C.brand500]} />}
          onEndReachedThreshold={0.4} onEndReached={list.loadMore}
          ListHeaderComponent={list.items.length ? <Text style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>{list.total} customer{list.total === 1 ? '' : 's'}</Text> : null}
          ListEmptyComponent={<Empty icon="id-card-outline" title={filtered ? 'No matching customers' : 'No customers yet'} sub={filtered ? 'Try a different search or filter.' : 'Convert a lead or tap + to add a customer.'} />}
          ListFooterComponent={list.more ? <ActivityIndicator color={C.brand500} style={{ margin: 16 }} /> : null}
          renderItem={({ item: c, index }) => (
            <Card accent={alt(index)} onPress={() => navigation.navigate('CustomerDetail', { id: c._id, name: c.name })} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={c.name} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: C.text }} numberOfLines={1}>{c.name}</Text>
                  <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }} numberOfLines={1}>{c.phone}{c.email ? ` · ${c.email}` : ''}</Text>
                </View>
                <Pressable onPress={() => Linking.openURL(telUrl(c.phone)).catch(() => {})} hitSlop={8} accessibilityLabel={`Call ${c.name}`} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="call" size={18} color={C.green} /></Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
                <Tag text={c.admissionStatus} />
                <Text style={{ flexShrink: 1, fontSize: 12, color: C.sub }} numberOfLines={1}>{c.course?.name || 'No course'} · Added {fmtDate(c.createdAt)}</Text>
              </View>
            </Card>
          )} />
      )}
      <Fab onPress={() => setForm(true)} label="Add customer" icon="person-add" />
      <CustomerSheet visible={form} onClose={() => setForm(false)} courses={lk.courses} onSaved={list.reload} />
    </View>
  );
}
