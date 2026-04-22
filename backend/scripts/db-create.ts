/* eslint-disable no-console */
import mysql from 'mysql2/promise';
import { env } from '../src/config/env';

async function main(): Promise<void> {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    // NOTE: no database selected — we're about to create it
  });

  const dbName = env.DB_NAME;
  // mysql2 doesn't allow placeholders for identifiers; escape via backticks.
  const safeName = dbName.replace(/`/g, '``');
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${safeName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`Database ensured: \`${dbName}\` (utf8mb4 / utf8mb4_unicode_ci)`);

  await connection.end();
}

main().catch((err: unknown) => {
  console.error('db-create failed:', err);
  process.exit(1);
});
