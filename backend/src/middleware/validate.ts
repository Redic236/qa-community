import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'params' | 'query';

export function validate<T>(schema: ZodSchema<T>, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    if (source === 'body') {
      req.body = result.data;
    } else if (source === 'params') {
      Object.assign(req.params, result.data as object);
    } else {
      Object.assign(req.query, result.data as object);
    }
    next();
  };
}
