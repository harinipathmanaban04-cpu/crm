import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { errMsg } from '../api';
import { API_BASE } from '../config';
import { Button, Field } from '../ui';
import { C } from '../theme';

export default function Login() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async () => {
    if (!email.trim() || !pw) return setErr('Enter your email and password.');
    setBusy(true); setErr('');
    try { await login(email, pw); } catch (e) { setErr(e.response ? errMsg(e) : e.request ? errMsg(e) : e.message); } finally { setBusy(false); }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.brand50 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', paddingTop: 64, paddingBottom: 28 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 190, height: 152 }} resizeMode="contain" />
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.brand700, marginTop: 6, letterSpacing: 1 }}>SALES EXECUTIVE APP</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 30, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Welcome back</Text>
          <Text style={{ color: C.sub, marginTop: 4, marginBottom: 22 }}>Sign in to see your assigned leads.</Text>
          {(err || notice) ? <View style={{ backgroundColor: err ? C.redBg : C.brand100, padding: 12, borderRadius: 12, marginBottom: 16 }}><Text style={{ color: err ? C.red : C.brand700, fontSize: 13 }}>{err || notice}</Text></View> : null}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="you@gmail.com" textContentType="username" />
          <View>
            <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry={!show} autoCapitalize="none" placeholder="••••••••" textContentType="password" onSubmitEditing={submit} />
            <Pressable onPress={() => setShow(!show)} style={{ position: 'absolute', right: 14, top: 33 }} hitSlop={10}><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} /></Pressable>
          </View>
          <Button title="Sign in" onPress={submit} busy={busy} style={{ marginTop: 6 }} />
          <Text style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 22 }}>Accounts are created by your Super Admin.</Text>
          {__DEV__ && <Text style={{ textAlign: 'center', color: C.muted, fontSize: 11, marginTop: 10 }}>Server: {API_BASE}</Text>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
