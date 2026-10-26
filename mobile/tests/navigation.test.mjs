import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_ITEMS } from '../src/navItems.js';
import { inr, toIsoDate } from '../src/utils/format.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const glyphs = JSON.parse(read('node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'));
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []));

test('drawer = exactly the website Sales Executive menu (same labels, same order)', () => {
  const layoutPath = path.join(root, '..', 'client/src/Layout.jsx');
  if (!fs.existsSync(layoutPath)) return; // mobile folder used on its own
  const sales = fs.readFileSync(layoutPath, 'utf8').match(/sales: \[(.*)\],\n\};/s)[1];
  const web = [...sales.matchAll(/\['\/[a-z]*', '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(NAV_ITEMS.map((i) => i.label), web);
  assert.equal(web.length, 9);
});
test('every menu item has a valid Ionicons icon and a destination', () => {
  for (const i of NAV_ITEMS) { assert.ok(glyphs[i.icon], `${i.label}: unknown icon ${i.icon}`); assert.ok(i.tab || i.route, `${i.label}: no destination`); }
  assert.equal(new Set(NAV_ITEMS.map((i) => i.icon)).size, NAV_ITEMS.length, 'icons must be unique per option');
});
test('every Ionicons name used in the app exists in the font', () => {
  const bad = [];
  for (const f of [...walk('src'), 'App.js']) {
    const s = read(f);
    for (const m of s.matchAll(/(?:\bname|\bicon)=["']([a-z0-9-]+)["']/g)) if (!glyphs[m[1]]) bad.push(`${f}: ${m[1]}`);
    for (const m of s.matchAll(/\bicon: '([a-z0-9-]+)'/g)) if (!glyphs[m[1]] && !glyphs[`${m[1]}-outline`]) bad.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
test('Profile screen no longer offers Change Password; auth code is untouched', () => {
  assert.doesNotMatch(read('src/screens/Profile.js'), /Change password|ChangePassword|key-outline/i);
  assert.match(read('src/screens/ChangePassword.js'), /auth\/change-password/); // forced first-login change still works
  assert.match(read('App.js'), /ForcePassword/);
});
test('no Settings icon / button exists anywhere in the app source', () => {
  for (const f of [...walk('src'), 'App.js']) assert.doesNotMatch(read(f), /settings|cog-|['"]cog['"]/i, f);
});
test('money / date helpers', () => {
  assert.equal(inr(150000), '₹1,50,000'); assert.equal(inr(null), '₹0'); assert.equal(toIsoDate(new Date(2026, 0, 5)), '2026-01-05');
});
