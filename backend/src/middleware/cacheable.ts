import type { Request, Response, NextFunction } from 'express';

/**
 * Marks a response as conditionally cacheable by the browser.
 *
 * Express already computes a weak ETag for any `res.json()` body and returns
 * 304 automatically when an incoming `If-None-Match` matches. For that to
 * actually trigger, the browser needs a Cache-Control header that tells it to
 * cache and revalidate.
 *
 *   Cache-Control: private             — only the end user's browser, never a
 *                                        shared CDN (responses are user-specific).
 *   max-age=0, must-revalidate         — always check freshness on the next hit.
 *
 *   Vary: Authorization, Accept-Language
 *     Two different users (different bearer tokens) MUST NOT share a cache
 *     entry, otherwise alice could see bob's `liked: true`. Same for i18n
 *     error messages between zh-CN / en-US clients.
 *
 * This middleware does nothing on non-GET requests so it can be applied
 * blindly to a route file without thinking about it.
 */
export function cacheable(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET') return next();
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  // Append-rather-than-overwrite in case some downstream layer also sets Vary.
  res.setHeader('Vary', 'Authorization, Accept-Language');
  next();
}
