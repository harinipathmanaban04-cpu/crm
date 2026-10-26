import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, PRIORITY, STATUS, TONE, shadow } from './theme';
import { fmtDate, initials, toIsoDate } from './utils/format';

export const Card = ({ children, style, onPress, accent }) => {
  const top = accent ? { borderTopWidth: 4, borderTopColor: accent } : null;
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => [s.card, top, pressed && { opacity: 0.85 }, style]}>{children}</Pressable>
    : <View style={[s.card, top, style]}>{children}</View>;
};

export function Button({ title, onPress, icon, variant = 'primary', busy, disabled, style, small }) {
  const v = { primary: [C.hero, '#fff', C.hero], ghost: [C.card, C.text, C.border], danger: [C.red, '#fff', C.red], soft: [C.brand100, C.brand700, C.brand100] }[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={({ pressed }) => [s.btn, small && s.btnSm, { backgroundColor: v[0], borderColor: v[2] }, (disabled || busy) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}>
      {busy ? <ActivityIndicator color={v[1]} size="small" /> : <>{icon && <Ionicons name={icon} size={small ? 16 : 18} color={v[1]} />}<Text style={[s.btnText, small && { fontSize: 13 }, { color: v[1] }]}>{title}</Text></>}
    </Pressable>
  );
}

export const Field = ({ label, error, style, ...p }) => (
  <View style={[{ marginBottom: 14 }, style]}>
    {label && <Text style={s.label}>{label}</Text>}
    <TextInput placeholderTextColor={C.muted} style={[s.input, p.multiline && { minHeight: 90, textAlignVertical: 'top' }, error && { borderColor: C.red }]} {...p} />
    {error ? <Text style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
  </View>
);

export const StatusBadge = ({ status }) => { const [fg, bg] = STATUS[status] || [C.sub, C.border]; return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color: fg }]}>{status}</Text></View>; };
export const Pill = ({ text, fg = C.sub, bg = C.border, icon }) => <View style={[s.badge, { backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>{icon && <Ionicons name={icon} size={11} color={fg} />}<Text style={[s.badgeText, { color: fg }]}>{text}</Text></View>;
export const PriorityDot = ({ p }) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRIORITY[p] || C.muted }} /><Text style={{ fontSize: 12, color: C.sub }}>{p}</Text></View>;

export const Chip = ({ label, active, onPress, color }) => (
  <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: color || C.brand400, borderColor: color || C.brand400 }]}>
    <Text style={[s.chipText, active && { color: color ? '#fff' : C.text, fontWeight: '700' }]}>{label}</Text>
  </Pressable>
);

export const Avatar = ({ name, size = 40, uri }) => uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.brand100 }} /> : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.brand400, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontWeight: '700', color: C.text, fontSize: size * 0.4 }}>{initials(name)}</Text></View>;

export const Loading = ({ text }) => <View style={s.center}><ActivityIndicator size="large" color={C.brand500} />{text ? <Text style={{ color: C.sub, marginTop: 10 }}>{text}</Text> : null}</View>;
export const ErrorState = ({ message, onRetry }) => (
  <View style={s.center}><View style={[s.iconCircle, { backgroundColor: C.redBg }]}><Ionicons name="cloud-offline-outline" size={30} color={C.red} /></View>
    <Text style={s.emptyTitle}>Something went wrong</Text><Text style={s.emptySub}>{message}</Text>{onRetry && <Button title="Try again" icon="refresh" onPress={onRetry} style={{ marginTop: 16 }} />}</View>
);
export const Empty = ({ icon = 'file-tray-outline', title, sub }) => <View style={s.center}><View style={s.iconCircle}><Ionicons name={icon} size={30} color={C.brand700} /></View><Text style={s.emptyTitle}>{title}</Text>{sub ? <Text style={s.emptySub}>{sub}</Text> : null}</View>;
export const SectionTitle = ({ children, right }) => <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 }}><Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{children}</Text>{right}</View>;
export const InfoRow = ({ icon, label, value, onPress }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 }}>
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.brand50, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={16} color={C.brand700} /></View>
    <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: C.muted }}>{label}</Text><Text style={{ fontSize: 14, color: onPress ? C.blue : C.text, marginTop: 1 }}>{value || '—'}</Text></View>
  </Pressable>
);
export const OfflineBanner = ({ show }) => show ? <View style={{ backgroundColor: C.warnBg, paddingVertical: 5, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}><Ionicons name="wifi-outline" size={13} color={C.warn} /><Text style={{ fontSize: 12, color: C.warn }}>Reconnecting to live updates…</Text></View> : null;

/** Coloured status pill for admission / payment / invoice / course states. */
export const Tag = ({ text }) => { const [fg, bg] = TONE[text] || [C.sub, C.border]; return <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeText, { color: fg }]}>{text}</Text></View>; };

export const SearchBox = ({ value, onChangeText, placeholder = 'Search…', style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }, style]}>
    <Ionicons name="search-outline" size={18} color={C.muted} />
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: C.text, fontSize: 14 }} />
    {value ? <Pressable onPress={() => onChangeText('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable> : null}
  </View>
);

export const Fab = ({ onPress, icon = 'add', label }) => {
  const insets = useSafeAreaInsets();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label || 'Add'} style={({ pressed }) => [{ position: 'absolute', right: 16, bottom: 16 + insets.bottom, minWidth: 56, height: 56, borderRadius: 28, paddingHorizontal: label ? 18 : 0, backgroundColor: C.hero, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={24} color="#fff" />{label ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{label}</Text> : null}
    </Pressable>
  );
};

/** Bottom sheet used for forms and pickers. */
export function Sheet({ visible, onClose, title, children }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingBottom: insets.bottom + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: C.text }} numberOfLines={1}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Ionicons name="close" size={22} color={C.sub} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 8 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Dropdown: tap to open a searchable list. options = [{ value, label }] */
export function SelectField({ label, value, options = [], onChange, placeholder = 'Select', allowClear, error, style }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const cur = options.find((o) => String(o.value) === String(value));
  const list = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const close = () => { setOpen(false); setQ(''); };
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, error && { borderColor: C.red }]}>
        <Text style={{ flex: 1, fontSize: 15, color: cur ? C.text : C.muted }} numberOfLines={1}>{cur ? cur.label : placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={C.muted} />
      </Pressable>
      {error ? <Text style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
      <Sheet visible={open} onClose={close} title={label || placeholder}>
        {options.length > 8 ? <SearchBox value={q} onChangeText={setQ} placeholder="Search…" style={{ marginBottom: 10 }} /> : null}
        {allowClear && value ? <Pressable onPress={() => { onChange(''); close(); }} style={s.opt}><Text style={{ color: C.red, fontSize: 15 }}>Clear selection</Text></Pressable> : null}
        {list.length === 0 ? <Text style={{ color: C.muted, textAlign: 'center', padding: 16 }}>No options</Text> : null}
        {list.slice(0, 150).map((o) => { const on = String(o.value) === String(value); return (
          <Pressable key={String(o.value)} onPress={() => { onChange(o.value); close(); }} style={[s.opt, on && { backgroundColor: C.brand50 }]}>
            <Text style={{ flex: 1, fontSize: 15, color: C.text, fontWeight: on ? '700' : '400' }}>{o.label}</Text>{on ? <Ionicons name="checkmark" size={18} color={C.brand700} /> : null}
          </Pressable>); })}
        {list.length > 150 ? <Text style={{ color: C.muted, textAlign: 'center', padding: 10, fontSize: 12 }}>Type in the search box to narrow {list.length} results</Text> : null}
      </Sheet>
    </View>
  );
}

/** Date input (YYYY-MM-DD string) using the native Android date picker. */
export function DateField({ label, value, onChange, placeholder = 'Select date', clearable = true, style }) {
  const pick = () => { if (Platform.OS !== 'android') return; DateTimePickerAndroid.open({ value: value ? new Date(`${value}T12:00:00`) : new Date(), mode: 'date', onChange: (e, d) => { if (e.type === 'set' && d) onChange(toIsoDate(d)); } }); };
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable onPress={pick} style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={{ flex: 1, fontSize: 15, color: value ? C.text : C.muted }}>{value ? fmtDate(`${value}T12:00:00`) : placeholder}</Text>
        {value && clearable ? <Pressable onPress={() => onChange('')} hitSlop={10}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable> : <Ionicons name="calendar-outline" size={18} color={C.muted} />}
      </Pressable>
    </View>
  );
}

/** Two-column label/value line used in detail cards. */
export const KV = ({ label, value, color }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4, gap: 12 }}>
    <Text style={{ fontSize: 12, color: C.sub }}>{label}</Text><Text style={{ flexShrink: 1, fontSize: 13, fontWeight: '600', color: color || C.text, textAlign: 'right' }}>{value ?? '—'}</Text>
  </View>
);

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, ...shadow },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  btnSm: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', color: C.sub, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', marginRight: 8 },
  chipText: { fontSize: 13, color: C.sub },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.brand100, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'center' },
  opt: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
  emptySub: { fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
