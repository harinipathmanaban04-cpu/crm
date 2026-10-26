import { useState } from 'react';
import { ScrollView, Text, View, Alert } from 'react-native';
import api, { errMsg } from '../api';
import { useAuth } from '../auth';
import { Button, Field } from '../ui';
import { C } from '../theme';

export default function ChangePassword({ navigation }) {
  const { user, applySession, logout } = useAuth();
  const forced = !!user?.mustChangePassword;
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async () => {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setErr('New password must be 8+ characters with letters and numbers.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setBusy(true); setErr('');
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: cur, newPassword: pw });
      await applySession(data);
      if (!forced) { Alert.alert('Password changed', 'Your password was updated.'); navigation.goBack(); }
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingTop: forced ? 70 : 20 }} keyboardShouldPersistTaps="handled">
      {forced && <><Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Set a new password</Text><Text style={{ color: C.sub, marginTop: 6, marginBottom: 20 }}>For your security, please change the temporary password before continuing.</Text></>}
      {err ? <View style={{ backgroundColor: C.redBg, padding: 12, borderRadius: 12, marginBottom: 14 }}><Text style={{ color: C.red, fontSize: 13 }}>{err}</Text></View> : null}
      <Field label="Current password" value={cur} onChangeText={setCur} secureTextEntry autoCapitalize="none" />
      <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
      <Field label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" />
      <Button title="Update password" onPress={submit} busy={busy} />
      {forced && <Button title="Log out" variant="ghost" onPress={() => logout()} style={{ marginTop: 12 }} />}
    </ScrollView>
  );
}
