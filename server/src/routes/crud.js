import { Router } from 'express';
import { scopeFor } from '../scope.js';
import { rx, httpErr } from '../util.js';
import { requireRole } from '../middleware.js';

const str = (v) => typeof v === 'string' && v !== '';
// Generic scoped CRUD router. Every query is merged with the caller's record-level scope.
export function crud(o) {
  const r = Router(); const M = o.Model;
  const findScoped = async (req, pop = false) => {
    let q = M.findOne({ $and: [{ _id: req.params.id }, scopeFor(req.user, o.kind)] });
    if (pop && o.populate) q = q.populate(o.populate);
    const d = await q; if (!d) throw httpErr(404, 'Record not found'); return d;
  };
  r.get('/', async (req, res) => {
    const q = req.query; const conds = [scopeFor(req.user, o.kind)];
    for (const k of o.filters || []) if (str(q[k])) conds.push({ [k]: q[k] });
    if (str(q.q) && o.search) conds.push({ $or: o.search.map((k) => ({ [k]: rx(q.q) })) });
    if (str(q.from) || str(q.to)) {
      const d = {}; if (str(q.from)) d.$gte = new Date(q.from); if (str(q.to)) d.$lte = new Date(q.to + 'T23:59:59.999');
      conds.push({ [o.dateField || 'createdAt']: d });
    }
    if (o.extra) conds.push(...o.extra(req).filter(Boolean));
    const filter = { $and: conds };
    const page = Math.max(1, parseInt(q.page) || 1); const limit = Math.min(100, parseInt(q.limit) || 15);
    let query = M.find(filter).sort(o.sort || '-createdAt').skip((page - 1) * limit).limit(limit);
    if (o.listSelect) query = query.select(o.listSelect);
    if (o.populate) query = query.populate(o.populate);
    const [items, total] = await Promise.all([query.lean(), M.countDocuments(filter)]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  });
  r.get('/:id', async (req, res) => {
    const doc = await findScoped(req, true);
    if (o.kind === 'lead' && doc.deletedFor?.some((id) => String(id) === String(req.user._id))) {
      throw httpErr(404, 'Record not found');
    }
    res.json(doc);
  });
  if (o.create) r.post('/', requireRole(...(o.create.roles || ['superadmin', 'admin', 'sales'])), async (req, res) => {
    const data = await o.create.build(req);
    const doc = await M.create(data);
    await o.onCreate?.(doc, req);
    res.status(201).json(await M.findById(doc._id).populate(o.populate || []));
  });
  if (o.update) r.put('/:id', requireRole(...(o.update.roles || ['superadmin', 'admin', 'sales'])), async (req, res) => {
    const doc = await findScoped(req); const before = doc.toObject();
    await o.update.apply(req, doc); await doc.save();
    await o.onUpdate?.(doc, req, before);
    res.json(await M.findById(doc._id).populate(o.populate || []));
  });
  if (o.remove) r.delete('/:id', requireRole(...o.remove.roles), async (req, res, next) => {
    if (req.params.id === 'bulk' || req.params.id === 'bulk-delete') return next();
    const doc = await findScoped(req);
    await o.remove.check?.(doc, req);
    if (o.remove.action) {
      await o.remove.action(doc, req, res);
      return;
    }
    await doc.deleteOne(); await o.onDelete?.(doc, req);
    res.json({ ok: true });
  });
  return r;
}
