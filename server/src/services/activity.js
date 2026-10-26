import { ActivityLog } from '../models.js';
import { emit } from '../realtime.js';
export async function log(user, action, entity, entityId, summary, { team = null, changes = [] } = {}) {
  const a = await ActivityLog.create({ actor: user._id, actorName: user.name, action, entity, entityId, summary, team: team || user.team || null, changes });
  emit('activity:created', a, [user._id]);
  return a;
}
