import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

type Translator = (key: string, options?: Record<string, unknown>) => string;

function tr(req: Request, key: string, fallback: string, params?: Record<string, unknown>): string {
  const t = (req as Request & { t?: Translator }).t;
  if (typeof t !== 'function') return fallback;
  // i18next returns the key itself when missing — defaultValue ensures English
  // fallback flows through whenever the key file is unloaded.
  return t(key, { defaultValue: fallback, ...(params ?? {}) });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const message = err.i18nKey
      ? tr(req, err.i18nKey, err.message, err.i18nParams)
      : err.message;
    res.status(err.status).json({ success: false, error: message });
    return;
  }

  if (err instanceof ZodError) {
    // fieldErrors leaks schema shape (field names, inner error codes). Useful
    // for dev debugging, but in production we hand back just the localised
    // message so attackers can't probe for fields or enumerate shapes.
    const body: Record<string, unknown> = {
      success: false,
      error: tr(req, 'validationFailed', 'Validation failed'),
    };
    if (process.env.NODE_ENV !== 'production') {
      body.details = err.flatten().fieldErrors;
    }
    res.status(400).json(body);
    return;
  }

  console.error('[errorHandler] unhandled:', err);
  res.status(500).json({
    success: false,
    error: tr(req, 'internalServer', 'Internal server error'),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: tr(req, 'routeNotFound', 'Route not found'),
  });
}
