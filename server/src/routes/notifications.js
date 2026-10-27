import { Router } from 'express';
import { Notification } from '../models.js';

const r = Router();

// GET /api/notifications — list for current user (only Admin and Sales Executive)
r.get('/', async (req, res) => {
  // Super Admin assigns leads and never receives lead notifications
  if (req.user.role === 'superadmin') {
    return res.json({ items: [], unread: 0 });
  }

  const [items, unread] = await Promise.all([
    Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(50).lean(),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
  ]);
  res.json({ items, unread });
});

// POST /api/notifications/:id/read — mark one as read
r.post('/:id/read', async (req, res) => {
  if (req.user.role === 'superadmin') return res.json({ ok: true });
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true }
  );
  res.json({ ok: true });
});

// POST /api/notifications/read-all — mark all as read
r.post('/read-all', async (req, res) => {
  if (req.user.role === 'superadmin') return res.json({ ok: true });
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
  res.json({ ok: true });
});

export default r;
