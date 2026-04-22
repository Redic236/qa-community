/* eslint-disable no-console */
import { sequelize } from '../config/database';
import { umzug } from './migrator';

async function run(): Promise<void> {
  const cmd = process.argv[2] ?? 'up';

  await sequelize.authenticate();

  switch (cmd) {
    case 'up': {
      const applied = await umzug.up();
      if (applied.length === 0) {
        console.log('No pending migrations.');
      } else {
        console.log(`Applied ${applied.length} migration(s):`);
        for (const m of applied) console.log(`  + ${m.name}`);
      }
      break;
    }
    case 'down': {
      const reverted = await umzug.down();
      if (reverted.length === 0) {
        console.log('Nothing to revert.');
      } else {
        console.log(`Reverted ${reverted.length} migration(s):`);
        for (const m of reverted) console.log(`  - ${m.name}`);
      }
      break;
    }
    case 'status': {
      const executed = await umzug.executed();
      const pending = await umzug.pending();
      console.log(`Executed (${executed.length}):`);
      for (const m of executed) console.log(`  ✓ ${m.name}`);
      console.log(`Pending (${pending.length}):`);
      for (const m of pending) console.log(`  · ${m.name}`);
      break;
    }
    default:
      throw new Error(`Unknown command: ${cmd}. Use: up | down | status`);
  }

  await sequelize.close();
}

run().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
