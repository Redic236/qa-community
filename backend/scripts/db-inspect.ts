/* eslint-disable no-console */
import { sequelize } from '../src/config/database';

async function main(): Promise<void> {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();
  const tables = await qi.showAllTables();
  console.log('Tables in', process.env.DB_NAME || '(configured DB)');
  for (const t of tables) console.log('  -', t);
  await sequelize.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
