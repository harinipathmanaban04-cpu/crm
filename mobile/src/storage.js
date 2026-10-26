import * as SecureStore from 'expo-secure-store';
let cache = null;
export const getToken = async () => { if (cache) return cache; try { cache = await SecureStore.getItemAsync('crm_token'); } catch { cache = null; } return cache; };
export const setToken = async (t) => { cache = t; try { t ? await SecureStore.setItemAsync('crm_token', t) : await SecureStore.deleteItemAsync('crm_token'); } catch {} };
export const getItem = async (k) => { try { return await SecureStore.getItemAsync(k); } catch { return null; } };
export const setItem = async (k, v) => { try { await SecureStore.setItemAsync(k, String(v)); } catch {} };
