import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { User } from '../models';
import { ROLES, type Role } from '../utils/constants';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: Role;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) return token;
  }
  // Note: the SSE endpoint (`/api/notifications/stream`) used to accept a
  // `?token=<JWT>` fallback here for EventSource (which can't send custom
  // headers). That was removed — raw JWTs in query strings leak to nginx
  // access logs / proxy logs / Referer. The stream now authenticates via a
  // one-shot ticket issued through POST /api/notifications/stream/ticket.
  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    return next(new UnauthorizedError('Missing bearer token'));
  }
  try {
    const { userId, role } = AuthService.verifyToken(token);
    req.userId = userId;
    req.userRole = role;
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const { userId, role } = AuthService.verifyToken(token);
    req.userId = userId;
    req.userRole = role;
  } catch {
    // invalid/expired token → treat as anonymous; primary purpose is read-only
  }
  next();
}

/**
 * Must follow `requireAuth` in the route chain.
 *
 * Two-stage check:
 *   1. JWT role claim MUST be admin — cheap fast fail for non-admin tokens.
 *   2. DB role MUST also be admin — defends against a previously-admin user
 *      whose token was minted before their role was revoked. Without the
 *      DB verification, a demoted admin keeps full access until their
 *      JWT_EXPIRES_IN window (7d default) closes.
 *
 * The DB hit is only on genuine admin paths (small, cold) so the latency is
 * acceptable; caching it is a separate concern.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) return next(new UnauthorizedError());
  if (req.userRole !== ROLES.ADMIN) {
    return next(new ForbiddenError('Admin access required'));
  }
  try {
    const user = await User.findByPk(req.userId, { attributes: ['id', 'role'] });
    if (!user || user.role !== ROLES.ADMIN) {
      return next(new ForbiddenError('Admin access required'));
    }
    next();
  } catch (err) {
    next(err);
  }
}
