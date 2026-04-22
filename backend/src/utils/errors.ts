export type I18nParams = Record<string, unknown>;

export class AppError extends Error {
  constructor(
    public readonly status: number,
    /** English fallback used when no Accept-Language matches or i18n fails. */
    message: string,
    /** Translation key under the `errors` namespace, e.g. `questionNotFound`. */
    public readonly i18nKey?: string,
    /** Interpolation params for the translation. */
    public readonly i18nParams?: I18nParams
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, i18nKey?: string, i18nParams?: I18nParams) {
    super(404, message, i18nKey, i18nParams);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, i18nKey?: string, i18nParams?: I18nParams) {
    super(403, message, i18nKey, i18nParams);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, i18nKey?: string, i18nParams?: I18nParams) {
    super(409, message, i18nKey, i18nParams);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, i18nKey?: string, i18nParams?: I18nParams) {
    super(400, message, i18nKey, i18nParams);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', i18nKey: string = 'unauthorized', i18nParams?: I18nParams) {
    super(401, message, i18nKey, i18nParams);
  }
}
