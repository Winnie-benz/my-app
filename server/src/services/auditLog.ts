import type { Request } from 'express'
import db from '../db/database'
import { nowTH } from '../utils/time'

type AuditAction = 'create' | 'update' | 'delete' | 'restore'

function actorName(req: Request): string {
  const user = req.user
  if (!user) return ''
  return [user.nickname || user.first_name, user.last_name].filter(Boolean).join(' ') || user.user
}

function auditPayload(data: unknown, req: Request): string {
  return JSON.stringify({
    data,
    actor: {
      staff_id: req.user?.staff_id ?? '',
      username: req.user?.user ?? '',
      role: req.user?.role ?? '',
    },
  })
}

export function recordAuditLog(
  req: Request,
  entityType: string,
  entityId: string,
  action: AuditAction,
  beforeData: unknown,
  afterData: unknown,
) {
  db.prepare(`
    INSERT INTO audit_logs (entity_type, entity_id, action, before_data, after_data, changed_by, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    entityType,
    entityId,
    action,
    auditPayload(beforeData, req),
    auditPayload(afterData, req),
    actorName(req),
    nowTH(),
  )
}
