import dotenv from 'dotenv';

dotenv.config();

/**
 * Sentinel dev JWT secret. Convenient locally but catastrophic if it ever
 * ships to prod — anyone who reads this repo can mint admin tokens. We hard-
 * fail startup if we detect it under NODE_ENV=production.
 */
const DEV_JWT_SECRET = 'dev-secret-change-me';

const jwtSecret = process.env.JWT_SECRET ?? DEV_JWT_SECRET;
const nodeEnv = process.env.NODE_ENV ?? 'development';

if (nodeEnv === 'production' && (jwtSecret === DEV_JWT_SECRET || !process.env.JWT_SECRET)) {
  throw new Error(
    '[env] JWT_SECRET is missing or uses the dev default in production. ' +
      'Set a long random value (≥ 32 bytes) before starting the server.'
  );
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT ?? 3000),

  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: Number(process.env.DB_PORT ?? 3306),
  DB_USER: process.env.DB_USER ?? 'root',
  DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  DB_NAME: process.env.DB_NAME ?? 'qa_community',

  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',

  /** CORS origin whitelist; comma-separated. Empty → allow all (dev only). */
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? '',
};

export const isTest = env.NODE_ENV === 'test';
