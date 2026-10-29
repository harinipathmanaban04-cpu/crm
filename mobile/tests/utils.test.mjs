import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase, waNumber, waUrl, telUrl, mailUrl } from '../src/utils/urls.js';
import { dueState, addDays, initials, dedupeStatuses } from '../src/utils/format.js';
import { LEAD_STATUSES, STATUS } from '../src/theme.js';

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

test('dedupeStatuses: removes duplicates regardless of case and whitespace while preserving original display labels', () => {
  const input = [
    'Not Reachable',
    'not reachable',
    'Not Reachable',
    '  not reachable  ',
    'Not Interested',
    'not interested',
    'Not interested',
    ' New ',
    'new',
    'Contacted',
  ];
  const expected = ['Not Reachable', 'Not Interested', 'New', 'Contacted'];
  assert.deepEqual(dedupeStatuses(input), expected);

  // Full filter-chip simulation with "All" and duplicate case variants
  const filterChipsWithDuplicates = [
    'All',
    'New',
    'Contacted',
    'Interested',
    'Follow-up',
    'Qualified',
    'Admission in Progress',
    'Converted',
    'Lost',
    'RNR (Ring No Response)',
    'Busy',
    'Switch Off',
    'Not Reachable',
    'not reachable',
    'Not Interested',
    'Not interested',
  ];
  const dedupedFilterChips = dedupeStatuses(filterChipsWithDuplicates);
  assert.deepEqual(dedupedFilterChips, [
    'All',
    'New',
    'Contacted',
    'Interested',
    'Follow-up',
    'Qualified',
    'Admission in Progress',
    'Converted',
    'Lost',
    'RNR (Ring No Response)',
    'Busy',
    'Switch Off',
    'Not Reachable',
    'Not Interested',
  ]);
  assert.equal(dedupedFilterChips.length, 14); // "All" + 13 lead statuses

  // Edge cases
  assert.deepEqual(dedupeStatuses(null), []);
  assert.deepEqual(dedupeStatuses(undefined), []);
  assert.deepEqual(dedupeStatuses(['', '   ', null, 123]), []);
});

test('lead statuses: exact 13 required statuses appear once, matching backend and web app', () => {
  const requiredStatuses = [
    'New',
    'Contacted',
    'Interested',
    'Follow-up',
    'Qualified',
    'Admission in Progress',
    'Converted',
    'Lost',
    'RNR (Ring No Response)',
    'Busy',
    'Switch Off',
    'Not Reachable',
    'Not Interested',
  ];

  assert.deepEqual(LEAD_STATUSES, requiredStatuses);
  assert.equal(LEAD_STATUSES.length, 13);
  assert.equal(new Set(LEAD_STATUSES).size, 13);

  // Ensure case-variants are not present as separate items
  assert.ok(!LEAD_STATUSES.includes('Not reachable'));
  assert.ok(!LEAD_STATUSES.includes('not reachable'));
  assert.ok(!LEAD_STATUSES.includes('Not interested'));
  assert.ok(!LEAD_STATUSES.includes('not interested'));

  // STATUS Object.keys has exactly 13 canonical keys
  assert.deepEqual(Object.keys(STATUS), requiredStatuses);
});

test('STATUS lookup: case-insensitive and whitespace tolerant color resolution', () => {
  const reachableColors = ['#C2410C', '#FFEDD5'];
  assert.deepEqual(STATUS['Not Reachable'], reachableColors);
  assert.deepEqual(STATUS['Not reachable'], reachableColors);
  assert.deepEqual(STATUS['not reachable'], reachableColors);
  assert.deepEqual(STATUS[' NOT REACHABLE '], reachableColors);

  const interestedColors = ['#B91C1C', '#FEE2E2'];
  assert.deepEqual(STATUS['Not Interested'], interestedColors);
  assert.deepEqual(STATUS['Not interested'], interestedColors);
  assert.deepEqual(STATUS['not interested'], interestedColors);
  assert.deepEqual(STATUS['  not interested  '], interestedColors);
});
