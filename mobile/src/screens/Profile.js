import { useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import api, { errMsg } from '../api';
import { API_BASE } from '../config';
import { useAuth } from '../auth';
import { useRealtime } from '../realtime';
import { Avatar, Button, Card, Field, InfoRow, Pill, Sheet } from '../ui';
import { MenuButton } from '../drawer';
import { C, alt } from '../theme';
import { fmtDate } from '../utils/format';

export default function Profile() {
  const insets = useSafeAreaInsets(); const focused = useIsFocused(); const { user, logout, setUser } = useAuth(); const { connected } = useRealtime();
  const [edit, setEdit] = useState(false); const [name, setName] = useState(user.name); const [phone, setPhone] = useState(user.phone || ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const save = async () => {
    if (!name.trim()) return setErr('Name is required.');
    setBusy(true); setErr('');
    try { const { data } = await api.put('/auth/profile', { name: name.trim(), phone: phone.trim() }); setUser(data); setEdit(false); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const out = () => Alert.alert('Log out', 'Are you sure you want to log out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => logout() }]);
  return (
    <>
    {focused && <StatusBar style="light" />}
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ backgroundColor: C.hero, paddingTop: insets.top + 24, paddingBottom: 30, alignItems: 'center', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <MenuButton light style={{ position: 'absolute', left: 16, top: insets.top + 8 }} />
        <View style={{ borderWidth: 3, borderColor: '#fff', borderRadius: 50 }}><Avatar name={user.name} size={84} uri={user.avatar} /></View>
        <Text style={{ fontSize: 21, fontWeight: '800', color: '#fff', marginTop: 12 }}>{user.name}</Text>
        <Text style={{ color: '#fff', opacity: 0.8, paddingHorizontal: 24 }} numberOfLines={1}>{user.email}</Text>
        <View style={{ marginTop: 10 }}><Pill text="Sales Executive" fg="#fff" bg="rgba(255,255,255,0.2)" /></View>
      </View>
      <View style={{ padding: 16 }}>
        <Card accent={alt(0)}>
          <InfoRow icon="person-outline" label="Name" value={user.name} />
          <InfoRow icon="mail-outline" label="Email" value={user.email} />
          <InfoRow icon="call-outline" label="Phone" value={user.phone} />
          <InfoRow icon="people-outline" label="Team" value={user.team?.name || 'Not assigned to a team'} />
          {user.team?.admin ? <InfoRow icon="shield-checkmark-outline" label="Your Admin" value={`${user.team.admin.name}${user.team.admin.phone ? ` · ${user.team.admin.phone}` : ''}`} onPress={user.team.admin.phone ? () => Linking.openURL(`tel:${user.team.admin.phone}`).catch(() => {}) : undefined} /> : null}
          <InfoRow icon="time-outline" label="Last login" value={fmtDate(user.lastLogin)} />
          <InfoRow icon={connected ? 'wifi' : 'wifi-outline'} label="Live updates" value={connected ? 'Connected' : 'Reconnecting…'} />
        </Card>
        <Button title="Edit profile" icon="create-outline" variant="ghost" onPress={() => { setName(user.name); setPhone(user.phone || ''); setErr(''); setEdit(true); }} style={{ marginTop: 14 }} />
        <Button title="Log out" icon="log-out-outline" variant="danger" onPress={out} style={{ marginTop: 10 }} />
        <Text style={{ textAlign: 'center', color: C.muted, fontSize: 11, marginTop: 24 }}>Eco CRM Sales v1.0.0{__DEV__ ? `\nServer: ${API_BASE}` : ''}</Text>
      </View>
      <Sheet visible={edit} onClose={() => setEdit(false)} title="Edit profile">
        {err ? <Text style={{ color: C.red, marginBottom: 10 }}>{err}</Text> : null}
        <Field label="Name" value={name} onChangeText={setName} /><Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={{ flexDirection: 'row', gap: 10 }}><Button title="Cancel" variant="ghost" onPress={() => setEdit(false)} style={{ flex: 1 }} /><Button title="Save" onPress={save} busy={busy} style={{ flex: 1 }} /></View>
      </Sheet>
    </ScrollView>
    </>
  );
}
