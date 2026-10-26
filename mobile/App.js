import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth';
import { RealtimeProvider, useRealtime } from './src/realtime';
import { DrawerProvider, MenuButton } from './src/drawer';
import { navRef } from './src/navigation';
import { C } from './src/theme';
import { Button, ErrorState } from './src/ui';
import Login from './src/screens/Login';
import ChangePassword from './src/screens/ChangePassword';
import Dashboard from './src/screens/Dashboard';
import Leads from './src/screens/Leads';
import LeadDetail from './src/screens/LeadDetail';
import Followups from './src/screens/Followups';
import MyTasks from './src/screens/Tasks';
import Customers from './src/screens/Customers';
import CustomerDetail from './src/screens/CustomerDetail';
import Admissions from './src/screens/Admissions';
import Payments from './src/screens/Payments';
import Performance from './src/screens/Performance';
import Notifications from './src/screens/Notifications';
import Profile from './src/screens/Profile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Same icons as the drawer (src/navigation.js); filled when selected. One icon set (Ionicons) across the whole app.
const TABS = {
  Home: { label: 'Dashboard', icon: 'grid' },
  Leads: { label: 'My Leads', icon: 'disc' },
  Followups: { label: 'Follow-ups', icon: 'call' },
  Alerts: { label: 'Alerts', icon: 'notifications' },
  Profile: { label: 'My Profile', icon: 'person-circle' },
};

function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index; const t = TABS[route.name]; const badge = descriptors[route.key].options.tabBarBadge;
        const press = () => { const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!focused && !e.defaultPrevented) navigation.navigate(route.name); };
        return (
          <Pressable key={route.key} onPress={press} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: focused }} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.brand400 : 'transparent' }}>
              <Ionicons name={focused ? t.icon : `${t.icon}-outline`} size={22} color={focused ? C.text : C.sub} />
              {badge ? <View style={{ position: 'absolute', top: -4, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{badge}</Text></View> : null}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: focused ? '700' : '600', color: focused ? C.text : C.sub, marginTop: 4 }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Tabs() {
  const { unread } = useRealtime();
  return (
    <Tab.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={Dashboard} />
      <Tab.Screen name="Leads" component={Leads} />
      <Tab.Screen name="Followups" component={Followups} />
      <Tab.Screen name="Alerts" component={Notifications} options={{ tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined }} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

// In-app banner shown when the server pushes a new lead / task assignment over the WebSocket.
function Toast() {
  const { toast, dismissToast } = useRealtime(); const insets = useSafeAreaInsets();
  if (!toast) return null;
  const go = () => { dismissToast(); if (toast.leadId && navRef.isReady()) navRef.navigate('LeadDetail', { id: toast.leadId }); };
  return (
    <Pressable onPress={go} style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, backgroundColor: C.hero, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 8, zIndex: 99 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.brand400, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="notifications" size={18} color={C.text} /></View>
      <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '700' }}>{toast.title}</Text><Text style={{ color: '#D1D5DB', fontSize: 13 }} numberOfLines={1}>{toast.body}</Text></View>
      <Pressable onPress={dismissToast} hitSlop={10} accessibilityLabel="Dismiss"><Ionicons name="close" size={18} color="#9CA3AF" /></Pressable>
    </Pressable>
  );
}

// Full-screen routes reachable from the drawer: teal header, back arrow, and the menu button on the right.
const menuScreen = (title) => ({ title, headerRight: () => <MenuButton light /> });

function Root() {
  const { user, booting, bootError, retry, logout } = useAuth();
  if (booting) return <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Image source={require('./assets/logo.png')} style={{ width: 170, height: 136 }} resizeMode="contain" /><ActivityIndicator color={C.brand500} style={{ marginTop: 24 }} /></View>;
  if (bootError) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}><ErrorState message={bootError} onRetry={retry} /><Button title="Sign out" variant="ghost" onPress={() => logout()} style={{ margin: 24 }} /></View>;
  return (
    <>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: C.hero }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' }, headerShadowVisible: false }}>
        {!user ? <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          : user.mustChangePassword ? <Stack.Screen name="ForcePassword" component={ChangePassword} options={{ headerShown: false }} />
          : <>
            <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="LeadDetail" component={LeadDetail} options={{ title: 'Lead details' }} />
            <Stack.Screen name="MyTasks" component={MyTasks} options={menuScreen('My Tasks')} />
            <Stack.Screen name="Customers" component={Customers} options={menuScreen('My Customers')} />
            <Stack.Screen name="CustomerDetail" component={CustomerDetail} options={{ title: 'Customer' }} />
            <Stack.Screen name="Admissions" component={Admissions} options={menuScreen('Courses & Admissions')} />
            <Stack.Screen name="Payments" component={Payments} options={menuScreen('Payment Updates')} />
            <Stack.Screen name="Performance" component={Performance} options={menuScreen('My Performance')} />
          </>}
      </Stack.Navigator>
      {user && !user.mustChangePassword ? <Toast /> : null}
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState('Home');
  useEffect(() => {
    try {
      const devMenu = requireOptionalNativeModule('DevMenuPreferences');
      devMenu?.setPreferencesAsync?.({ showFloatingActionButton: false });
    } catch (_) {}
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RealtimeProvider>
          <NavigationContainer ref={navRef} onReady={() => setRoute(navRef.getCurrentRoute()?.name)} onStateChange={() => setRoute(navRef.getCurrentRoute()?.name)}>
            <DrawerProvider currentRoute={route}><Root /></DrawerProvider>
          </NavigationContainer>
        </RealtimeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
