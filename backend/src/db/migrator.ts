import path from 'path';
import { Umzug, SequelizeStorage, type MigrationMeta } from 'umzug';
import type { QueryInterface } from 'sequelize';
import { sequelize } from '../config/database';

interface MigrationModule {
  up: (qi: QueryInterface) => Promise<void>;
  down: (qi: QueryInterface) => Promise<void>;
}

// fast-glob (used internally by umzug) requires POSIX-style forward slashes
// even on Windows. `path.join` produces backslashes on Windows, so normalize.
const migrationsGlob = path
  .join(__dirname, '..', '..', 'migrations', '*.ts')
  .replace(/\\/g, '/');

export const umzug = new Umzug<QueryInterface>({
  migrations: {
    glob: migrationsGlob,
    resolve: ({ name, path: migrationPath, context }) => {
      if (!migrationPath) {
        throw new Error(`Migration ${name} has no resolvable path`);
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const migration = require(migrationPath) as MigrationModule;
      return {
        name,
        up: async () => migration.up(context),
        down: async () => migration.down(context),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
  logger: console,
});

export type Migration = MigrationMeta;
