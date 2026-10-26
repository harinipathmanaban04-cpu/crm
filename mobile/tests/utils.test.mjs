import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase, waNumber, waUrl, telUrl, mailUrl } from '../src/utils/urls.js';
import { dueState, addDays, initials } from '../src/utils/format.js';

test('API url: explicit env wins and strips trailing slash//api', () => {
  assert.equal(resolveApiBase({ envUrl: 'https://crm.example.com/', isDev: false, platform: 'android' }), 'https://crm.example.com');
  assert.equal(resolveApiBase({ envUrl: 'https://crm.example.com/api', isDev: true, hostUri: '192.168.1.5:8081', platform: 'android' }), 'https://crm.example.com');
});
test('API url: dev uses the PC LAN IP from the Expo host', () => {
  assert.equal(resolveApiBase({ envUrl: '', isDev: true, hostUri: '192.168.1.5:8081', platform: 'android' }), 'http://192.168.1.5:5000');
  assert.equal(resolveApiBase({ envUrl: '', isDev: true, hostUri: 'exp://192.168.1.5:8081', platform: 'android' }), 'http://192.168.1.5:5000');
});
test('API url: emulator fallback is 10.0.2.2', () => { assert.equal(resolveApiBase({ isDev: false, platform: 'android' }), 'http://10.0.2.2:5000'); });
test('WhatsApp / tel / mail links', () => {
  assert.equal(waNumber('98765 43210'), '919876543210'); assert.equal(waNumber('+91 98765-43210'), '919876543210'); assert.equal(waNumber(''), '');
  assert.equal(waUrl('9876543210', 'Hi there'), 'https://wa.me/919876543210?text=Hi%20there');
  assert.equal(telUrl('+91 98765-43210'), 'tel:+919876543210'); assert.equal(mailUrl('a@b.com', 'Hi there'), 'mailto:a@b.com?subject=Hi%20there');
});
test('dueState / helpers', () => {
  assert.equal(dueState(null), null); assert.equal(dueState(addDays(-2)), 'overdue'); assert.equal(dueState(addDays(3)), 'upcoming');
  const t = new Date(); t.setHours(23, 0, 0, 0); assert.equal(dueState(t), 'today'); assert.equal(initials('karthik sales'), 'KS');
});
