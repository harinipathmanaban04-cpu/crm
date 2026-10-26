import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './auth';
import { Avatar } from './ui';
import { C } from './theme';
import { activeNavKey, goTo } from './navigation';
import { NAV_ITEMS } from './navItems';

const Ctx = createContext({ open: () => {}, close: () => {} });
export const useDrawer = () => useContext(Ctx);

/** Hamburger button that opens the navigation drawer. `light` = white icon for teal headers. */
export const MenuButton = ({ light, style }) => {
  const { open } = useDrawer();
  return (
    <Pressable onPress={open} accessibilityLabel="Open menu" hitSlop={6} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: light ? 'rgba(255,255,255,0.16)' : C.bg, borderWidth: light ? 0 : 1, borderColor: C.border }, pressed && { opacity: 0.7 }, style]}>
      <Ionicons name="menu" size={22} color={light ? '#fff' : C.text} />
    </Pressable>
  );
};

/** White page header used by the tab screens: menu button, title/subtitle, optional right slot and extra rows below. */
export function ScreenHeader({ title, subtitle, right, children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: '#fff', paddingTop: insets.top + 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 }}>
        <MenuButton />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 12, color: C.sub, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function DrawerProvider({ children, currentRoute }) {
  const [visible, setVisible] = useState(false); const [shown, setShown] = useState(false);
  const { width } = useWindowDimensions(); const W = Math.min(310, Math.round(width * 0.84));
  const x = useRef(new Animated.Value(-W)).current; const fade = useRef(new Animated.Value(0)).current; const insets = useSafeAreaInsets(); const { user } = useAuth();

  const open = useCallback(() => { setVisible(true); setShown(true); }, []);
  const close = useCallback(() => setShown(false), []);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(x, { toValue: shown ? 0 : -W, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: shown ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished && !shown) setVisible(false); });
  }, [shown, W]); // eslint-disable-line
  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [visible, close]);

  const active = activeNavKey(currentRoute);
  const pick = (item) => { close(); setTimeout(() => goTo(item), 120); };

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {visible ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }} pointerEvents="box-none">
          <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', opacity: fade }}>
            <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close menu" />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: W, backgroundColor: '#fff', transform: [{ translateX: x }], paddingTop: insets.top, paddingBottom: insets.bottom, elevation: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 68, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Image source={require('../assets/logo-icon.png')} style={{ width: 52, height: 38 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }} numberOfLines={1}>Eco Friendly Tech</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.brand500, letterSpacing: 0.3 }} numberOfLines={1}>Solutions CRM</Text>
              </View>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close menu"><Ionicons name="close" size={22} color={C.sub} /></Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 2 }}>
              {NAV_ITEMS.map((it) => {
                const on = active === (it.tab || it.route);
                return (
                  <Pressable key={it.label} onPress={() => pick(it)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: on ? C.coral50 : 'transparent' }, pressed && !on && { backgroundColor: C.bg }]}>
                    <View style={{ width: 24, alignItems: 'center' }}><Ionicons name={it.icon} size={22} color={on ? C.coral600 : '#4B5563'} /></View>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: on ? '700' : '500', color: on ? C.coral600 : '#374151' }} numberOfLines={1}>{it.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {user ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Avatar name={user.name} size={36} uri={user.avatar} />
                <View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: '700', color: C.text }} numberOfLines={1}>{user.name}</Text><Text style={{ fontSize: 11, color: C.sub }}>Sales Executive</Text></View>
              </View>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}
