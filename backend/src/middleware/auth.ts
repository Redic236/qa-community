import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
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
  // EventSource cannot send custom headers, so the SSE endpoint accepts the
  // token via query string. Limited to GET callers — mutations still require
  // the Authorization header.
  if (req.method === 'GET') {
    const q = req.query.token;
    if (typeof q === 'string' && q) return q;
  }
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
 * Must follow `requireAuth` in the route chain. Rejects with 403 if the JWT's
 * role claim isn't admin. Note: the role is read from the token, not the DB —
 * users promoted to admin must re-login before the new claim takes effect.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) return next(new UnauthorizedError());
  if (req.userRole !== ROLES.ADMIN) {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}
