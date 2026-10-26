// Integration tests against a RUNNING backend with demo data (npm run seed:demo in /server).
// Usage:  API=http://localhost:5000/api npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const API = process.env.API || 'http://localhost:5000/api';
const BASE = API.replace(/\/api$/, '');
const call = async (path, { method = 'GET', token, body } = {}) => {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const login = async (email, password = 'Welcome@123') => { const r = await call('/auth/login', { method: 'POST', body: { email, password } }); return { ...r, token: r.data?.token, user: r.data?.user }; };
const S = {}; // shared state

test('login: valid sales executive', async () => {
  const r = await login('sales1.demo@gmail.com'); assert.equal(r.status, 200); assert.equal(r.user.role, 'sales'); assert.ok(r.token); assert.equal(r.user.passwordHash, undefined);
  S.s1 = r; S.s2 = await login('sales2.demo@gmail.com'); S.admin = await login('admin.demo@gmail.com'); S.sa = await login('superadmin@gmail.com', 'Admin@12345');
});
test('login: wrong password, unknown user, empty body are rejected', async () => {
  assert.equal((await login('sales1.demo@gmail.com', 'nope')).status, 401);
  assert.equal((await login('ghost@gmail.com')).status, 401);
  assert.equal((await call('/auth/login', { method: 'POST', body: {} })).status, 401);
});
test('login: NoSQL injection attempt is rejected', async () => {
  const r = await call('/auth/login', { method: 'POST', body: { email: { $gt: '' }, password: { $gt: '' } } }); assert.ok([400, 401].includes(r.status));
});
test('auth: protected routes need a token / reject garbage tokens', async () => {
  assert.equal((await call('/leads')).status, 401);
  assert.equal((await call('/leads', { token: 'abc.def.ghi' })).status, 401);
  assert.equal((await call('/mobile/notifications')).status, 401);
});
test('auth: /auth/me returns the logged-in sales exec and never exposes password data', async () => {
  const r = await call('/auth/me', { token: S.s1.token }); assert.equal(r.status, 200); assert.equal(r.data.email, 'sales1.demo@gmail.com');
  for (const o of [r.data, S.s1.user]) { assert.equal(o.plainPassword, undefined); assert.equal(o.passwordHash, undefined); }
  assert.ok(r.data.team && r.data.team.name, 'team is populated');
});
test('DATA: a sales executive can never read other users\' accounts or passwords', async () => {
  const u = await call('/users?limit=100', { token: S.s1.token }); assert.equal(u.status, 200);
  assert.equal(u.data.items.length, 1); assert.equal(u.data.items[0].email, 'sales1.demo@gmail.com'); assert.equal(u.data.items[0].plainPassword, undefined);
  assert.equal((await call('/users', { token: S.s1.token, method: 'POST', body: { name: 'x', email: 'x@gmail.com', role: 'admin', password: 'Welcome@123' } })).status, 403);
});

test('SCOPE: sales sees ONLY leads assigned to them', async () => {
  const r = await call('/leads?limit=100', { token: S.s1.token }); assert.equal(r.status, 200); assert.ok(r.data.items.length > 0);
  for (const l of r.data.items) assert.equal(String(l.assignedTo._id), String(S.s1.user._id));
  const r2 = await call('/leads?limit=100', { token: S.s2.token });
  const ids1 = new Set(r.data.items.map((l) => l._id)); assert.ok(r2.data.items.every((l) => !ids1.has(l._id)), 'two executives must never share leads');
  S.l1 = r.data.items[0]; S.l2 = r2.data.items[0];
});
test('SCOPE: filter params cannot be used to see someone else\'s leads', async () => {
  const r = await call(`/leads?assignedTo=${S.s2.user._id}&limit=100`, { token: S.s1.token }); assert.equal(r.data.items.length, 0);
  const u = await call('/leads?unassigned=1', { token: S.s1.token }); assert.equal(u.data.items.length, 0);
});
test('SCOPE: opening / editing / following-up another executive\'s lead returns 404', async () => {
  assert.equal((await call(`/leads/${S.l2._id}`, { token: S.s1.token })).status, 404);
  assert.equal((await call(`/leads/${S.l2._id}`, { token: S.s1.token, method: 'PUT', body: { status: 'Lost' } })).status, 404);
  assert.equal((await call(`/leads/${S.l2._id}/followup`, { token: S.s1.token, method: 'POST', body: { note: 'hack' } })).status, 404);
  assert.equal((await call(`/leads/${S.l2._id}/convert`, { token: S.s1.token, method: 'POST' })).status, 404);
  assert.equal((await call(`/leads/${S.l2._id}`, { token: S.s2.token })).status, 200);
});
test('SCOPE: sales cannot create / delete / assign leads', async () => {
  assert.equal((await call('/leads', { token: S.s1.token, method: 'POST', body: { name: 'x', phone: '9999999999' } })).status, 403);
  assert.equal((await call(`/leads/${S.l1._id}`, { token: S.s1.token, method: 'DELETE' })).status, 403);
  assert.equal((await call(`/leads/${S.l1._id}/assign`, { token: S.s1.token, method: 'POST', body: { assignedTo: S.s2.user._id } })).status, 403);
});
test('SCOPE: sales cannot change protected fields (assignedTo / name) via update', async () => {
  const r = await call(`/leads/${S.l1._id}`, { token: S.s1.token, method: 'PUT', body: { assignedTo: S.s2.user._id, name: 'Hijacked', team: null } });
  assert.equal(r.status, 200); assert.equal(String(r.data.assignedTo._id), String(S.s1.user._id)); assert.equal(r.data.name, S.l1.name);
});
test('SCOPE: mobile endpoints are sales-only', async () => {
  assert.equal((await call('/mobile/notifications', { token: S.admin.token })).status, 403);
  assert.equal((await call('/mobile/followups', { token: S.sa.token })).status, 403);
});

test('LEAD UPDATE: status + priority persist', async () => {
  const before = S.l1.status; const to = before === 'Interested' ? 'Qualified' : 'Interested';
  const r = await call(`/leads/${S.l1._id}`, { token: S.s1.token, method: 'PUT', body: { status: to, priority: 'High' } }); assert.equal(r.status, 200); assert.equal(r.data.status, to);
  const g = await call(`/leads/${S.l1._id}`, { token: S.s1.token }); assert.equal(g.data.status, to); assert.equal(g.data.priority, 'High');
});
test('LEAD UPDATE: invalid status is rejected with a readable message', async () => {
  const r = await call(`/leads/${S.l1._id}`, { token: S.s1.token, method: 'PUT', body: { status: 'Bogus' } }); assert.equal(r.status, 400); assert.ok(r.data.message);
});
test('LEAD UPDATE: invalid id -> 400, unknown id -> 404', async () => {
  assert.equal((await call('/leads/not-an-id', { token: S.s1.token })).status, 400);
  assert.equal((await call('/leads/64b000000000000000000000', { token: S.s1.token })).status, 404);
});
test('NOTES: add note via follow-up endpoint, empty note rejected', async () => {
  assert.equal((await call(`/leads/${S.l1._id}/followup`, { token: S.s1.token, method: 'POST', body: { note: '  ' } })).status, 400);
  const next = new Date(Date.now() + 2 * 864e5).toISOString();
  const r = await call(`/leads/${S.l1._id}/followup`, { token: S.s1.token, method: 'POST', body: { note: 'Called, wants brochure', next } });
  assert.equal(r.status, 200); assert.equal(r.data.followUps.at(-1).note, 'Called, wants brochure'); assert.equal(new Date(r.data.nextFollowUp).toISOString(), next);
});
test('FOLLOW-UPS: /mobile/followups groups only my leads', async () => {
  const r = await call('/mobile/followups', { token: S.s1.token }); assert.equal(r.status, 200);
  const all = [...r.data.overdue, ...r.data.today, ...r.data.upcoming]; assert.ok(all.length > 0);
  assert.ok(r.data.upcoming.some((l) => l._id === S.l1._id));
  const mine = new Set((await call('/leads?limit=100', { token: S.s1.token })).data.items.map((l) => l._id)); assert.ok(all.every((l) => mine.has(l._id)));
  assert.ok(r.data.overdue.every((l) => new Date(l.nextFollowUp) < new Date()));
});
test('DASHBOARD: sales stats are scoped to own leads', async () => {
  const d = await call('/dashboard', { token: S.s1.token }); const l = await call('/leads?limit=1', { token: S.s1.token });
  assert.equal(d.status, 200); assert.equal(d.data.stats.totalLeads, l.data.total);
});

test('TASKS: sales sees own tasks only and can update status only', async () => {
  const t1 = await call('/tasks?limit=100', { token: S.s1.token }); assert.equal(t1.status, 200);
  for (const t of t1.data.items) assert.equal(String(t.assignee._id), String(S.s1.user._id));
  if (t1.data.items[0]) {
    const t = t1.data.items[0]; const r = await call(`/tasks/${t._id}`, { token: S.s1.token, method: 'PUT', body: { status: 'In Progress', title: 'hijack', assignee: S.s2.user._id } });
    assert.equal(r.status, 200); assert.equal(r.data.status, 'In Progress'); assert.equal(r.data.title, t.title); assert.equal(String(r.data.assignee._id), String(S.s1.user._id));
    await call(`/tasks/${t._id}`, { token: S.s1.token, method: 'PUT', body: { status: t.status } });
  }
  assert.equal((await call('/tasks', { token: S.s1.token, method: 'POST', body: { title: 'x' } })).status, 403);
});

test('ASSIGNMENT + NOTIFICATIONS + WEBSOCKET: admin assigns a lead -> sales gets socket event and a notification', async () => {
  const create = await call('/leads', { token: S.admin.token, method: 'POST', body: { name: `Mobile Test ${Date.now()}`, phone: '9876543210', email: 'mt@example.com' } });
  assert.equal(create.status, 201); const lead = create.data; S.newLead = lead;
  assert.equal((await call(`/leads/${lead._id}`, { token: S.s1.token })).status, 404, 'unassigned lead must be invisible to sales');
  const before = await call('/mobile/notifications', { token: S.s1.token });

  const sock = io(BASE, { auth: { token: S.s1.token }, transports: ['websocket'], reconnection: false });
  await new Promise((res, rej) => { sock.on('connect', res); sock.on('connect_error', rej); setTimeout(() => rej(new Error('socket connect timeout')), 5000); });
  const got = new Promise((res, rej) => { sock.on('lead:assigned', (p) => res(p)); setTimeout(() => rej(new Error('no lead:assigned event within 5s')), 5000); });
  const a = await call(`/leads/${lead._id}/assign`, { token: S.admin.token, method: 'POST', body: { assignedTo: S.s1.user._id } }); assert.equal(a.status, 200);
  const ev = await got; sock.disconnect(); assert.equal(ev.id, lead._id);

  assert.equal((await call(`/leads/${lead._id}`, { token: S.s1.token })).status, 200, 'now visible');
  assert.equal((await call(`/leads/${lead._id}`, { token: S.s2.token })).status, 404, 'other exec still blocked');
  const after = await call('/mobile/notifications', { token: S.s1.token });
  assert.equal(after.data.items.length, before.data.items.length + 1);
  assert.equal(after.data.items[0].type, 'lead_assigned'); assert.equal(after.data.items[0].leadId, lead._id);
});
test('REASSIGNMENT: lead moves away from first exec instantly', async () => {
  const a = await call(`/leads/${S.newLead._id}/assign`, { token: S.admin.token, method: 'POST', body: { assignedTo: S.s2.user._id } }); assert.equal(a.status, 200);
  assert.equal((await call(`/leads/${S.newLead._id}`, { token: S.s1.token })).status, 404);
  assert.equal((await call(`/leads/${S.newLead._id}`, { token: S.s2.token })).status, 200);
  const n = await call('/mobile/notifications', { token: S.s2.token }); assert.ok(n.data.items.some((i) => i.type === 'lead_assigned' && i.leadId === S.newLead._id));
  const n1 = await call('/mobile/notifications', { token: S.s1.token }); assert.ok(!n1.data.items.some((i) => i.leadId === S.newLead._id && i.type === 'lead_assigned'));
});
test('SOCKET: invalid token is refused', async () => {
  const sock = io(BASE, { auth: { token: 'bad' }, transports: ['websocket'], reconnection: false });
  const err = await new Promise((res) => { sock.on('connect_error', (e) => res(e.message)); sock.on('connect', () => res('connected')); setTimeout(() => res('timeout'), 5000); }); sock.disconnect(); assert.equal(err, 'unauthorized');
});
test('CONVERT: sales can convert own lead once; duplicate rejected', async () => {
  const lead = (await call('/leads', { token: S.admin.token, method: 'POST', body: { name: 'Convert Me', phone: `98${Date.now().toString().slice(-8)}`, assignedTo: S.s1.user._id } })).data;
  const c = await call(`/leads/${lead._id}/convert`, { token: S.s1.token, method: 'POST' }); assert.equal(c.status, 200); assert.equal(c.data.status, 'Converted');
  assert.equal((await call(`/leads/${lead._id}/convert`, { token: S.s1.token, method: 'POST' })).status, 409);
  assert.equal((await call(`/customers/${c.data.customer}`, { token: S.s1.token })).status, 200);
  assert.equal((await call(`/customers/${c.data.customer}`, { token: S.s2.token })).status, 404);
});
test('PROFILE: update name/phone; change-password validation', async () => {
  const p = await call('/auth/profile', { token: S.s1.token, method: 'PUT', body: { phone: '9000011111' } }); assert.equal(p.status, 200); assert.equal(p.data.phone, '9000011111');
  assert.equal((await call('/auth/change-password', { token: S.s1.token, method: 'POST', body: { currentPassword: 'wrong', newPassword: 'Newpass123' } })).status, 400);
  assert.equal((await call('/auth/change-password', { token: S.s1.token, method: 'POST', body: { currentPassword: 'Welcome@123', newPassword: 'short' } })).status, 400);
});
test('SESSION: deactivated user\'s token stops working immediately', async () => {
  const tmp = (await call('/users', { token: S.sa.token, method: 'POST', body: { name: 'Temp Sales', email: `tmp${Date.now()}@gmail.com`, role: 'sales', password: 'Welcome@123', team: S.s1.user.team?._id || S.s1.user.team, mustChangePassword: false } }));
  assert.equal(tmp.status, 201, JSON.stringify(tmp.data));
  const l = await login(tmp.data.email); assert.equal(l.status, 200);
  assert.equal((await call(`/users/${tmp.data._id}/toggle`, { token: S.sa.token, method: 'POST' })).status, 200);
  assert.equal((await call('/leads', { token: l.token })).status, 401);
});
