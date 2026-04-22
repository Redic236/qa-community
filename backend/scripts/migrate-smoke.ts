/* eslint-disable no-console */
if (process.env.NODE_ENV !== 'test') {
  console.error('Run with: NODE_ENV=test npx tsx scripts/migrate-smoke.ts');
  process.exit(1);
}

import { sequelize } from '../src/config/database';
import { umzug } from '../src/db/migrator';

async function main(): Promise<void> {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();

  console.log('\n── status (before up) ──');
  console.log('pending:', (await umzug.pending()).map((m) => m.name));

  console.log('\n── migrate up ──');
  const applied = await umzug.up();
  console.log('applied:', applied.map((m) => m.name));

  const tablesUp = await qi.showAllTables();
  console.log('tables after up:', tablesUp);
  if (
    !tablesUp.includes('users') ||
    !tablesUp.includes('questions') ||
    !tablesUp.includes('answers') ||
    !tablesUp.includes('votes') ||
    !tablesUp.includes('point_records')
  ) {
    throw new Error('Expected all 5 tables to exist after up');
  }

  console.log('\n── status (after up) ──');
  console.log('executed:', (await umzug.executed()).map((m) => m.name));
  console.log('pending:', (await umzug.pending()).map((m) => m.name));

  console.log('\n── migrate down ──');
  const reverted = await umzug.down();
  console.log('reverted:', reverted.map((m) => m.name));

  const tablesDown = await qi.showAllTables();
  console.log('tables after down:', tablesDown);
  // sequelize_meta stays (umzug's tracking table)
  const remaining = tablesDown.filter((t) => t !== 'sequelize_meta' && t !== 'SequelizeMeta');
  if (remaining.length > 0) {
    throw new Error(`Expected all feature tables dropped, still have: ${remaining.join(',')}`);
  }

  console.log('\nMIGRATION SMOKE PASSED — up/down both work, schema matches.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('\nMIGRATION SMOKE FAILED');
  console.error(err);
  process.exit(1);
});
