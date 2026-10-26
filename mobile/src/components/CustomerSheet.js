import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import api, { errMsg } from '../api';
import { Button, Field, Sheet, SelectField } from '../ui';
import { C, ADMISSION_STATUS } from '../theme';

export const ADMISSION_OPTIONS = Object.keys(ADMISSION_STATUS).map((v) => ({ value: v, label: v }));

/** Add / edit customer form (POST /customers, PUT /customers/:id) — same fields the website's customer form uses for Sales Executives. */
export default function CustomerSheet({ visible, onClose, customer, courses, onSaved }) {
  const blank = { name: '', phone: '', email: '', course: '', admissionStatus: 'Not Started', notes: '' };
  const [v, setV] = useState(blank); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => {
    if (!visible) return;
    setErr('');
    setV(customer ? { name: customer.name || '', phone: customer.phone || '', email: customer.email || '', course: customer.course?._id || customer.course || '', admissionStatus: customer.admissionStatus || 'Not Started', notes: customer.notes || '' } : blank);
  }, [visible, customer]); // eslint-disable-line
  const set = (k) => (x) => setV((p) => ({ ...p, [k]: x }));
  const save = async () => {
    if (!v.name.trim()) return setErr('Name is required.');
    if (!v.phone.trim()) return setErr('Phone is required.');
    setBusy(true); setErr('');
    try {
      const body = { ...v, name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim() };
      const { data } = customer ? await api.put(`/customers/${customer._id}`, body) : await api.post('/customers', body);
      onSaved?.(data); onClose();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={customer ? 'Edit customer' : 'Add customer'}>
      {err ? <View style={{ backgroundColor: C.redBg, padding: 10, borderRadius: 10, marginBottom: 12 }}><Text style={{ color: C.red, fontSize: 13 }}>{err}</Text></View> : null}
      <Field label="Name *" value={v.name} onChangeText={set('name')} />
      <Field label="Phone *" value={v.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Email" value={v.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <SelectField label="Course interest" value={v.course} options={courses} onChange={set('course')} placeholder="Select course" allowClear />
      <SelectField label="Admission status" value={v.admissionStatus} options={ADMISSION_OPTIONS} onChange={set('admissionStatus')} />
      <Field label="Notes" value={v.notes} onChangeText={set('notes')} multiline />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button title="Save" onPress={save} busy={busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}
