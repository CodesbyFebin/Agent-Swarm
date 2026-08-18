import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

export const SESSION_COOKIE = 'asw_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const ROLE_RANK = { VIEWER: 0, MEMBER: 1, OPERATOR: 2, ADMIN: 3, OWNER: 4 };

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`, [userId, hashToken(token), expiresAt]);
  return { token, expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  await pool.query(`DELETE FROM sessions WHERE token_hash=$1`, [hashToken(token)]);
}

async function resolveSession(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash=$1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  if (!rows.length) return null;
  pool.query(`UPDATE sessions SET last_seen_at=now() WHERE token_hash=$1`, [hashToken(token)]).catch(() => {});
  return rows[0];
}

export async function membershipsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT m.organization_id, m.role, o.name AS organization_name, o.slug AS organization_slug
     FROM memberships m JOIN organizations o ON o.id = m.organization_id
     WHERE m.user_id=$1 ORDER BY o.name`,
    [userId]
  );
  return rows;
}

/** Fastify preHandler: rejects with 401 if no valid session; otherwise attaches req.user + req.memberships. */
export async function requireAuth(req, reply) {
  const user = await resolveSession(req.cookies?.[SESSION_COOKIE]);
  if (!user) return reply.code(401).send({ error: 'UNAUTHENTICATED' });
  req.user = user;
  req.memberships = await membershipsForUser(user.id);
}

export function hasRole(memberships, organizationId, minRole) {
  const m = memberships.find((x) => x.organization_id === organizationId);
  if (!m) return false;
  return ROLE_RANK[m.role] >= ROLE_RANK[minRole];
}

export function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'workspace';
}
