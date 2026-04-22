import { Sequelize } from 'sequelize';
import { env, isTest } from './env';

export const sequelize = isTest
  ? new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
  : new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
      host: env.DB_HOST,
      port: env.DB_PORT,
      dialect: 'mysql',
      logging: env.NODE_ENV === 'development' ? console.log : false,
      define: { underscored: true },
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    });
