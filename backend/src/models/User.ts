import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type Sequelize,
} from 'sequelize';
import { ROLE_VALUES, ROLES, type Role } from '../utils/constants';

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>;
  declare username: string;
  declare email: string;
  declare password: string;
  declare avatar: CreationOptional<string | null>;
  declare points: CreationOptional<number>;
  declare role: CreationOptional<Role>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export const initUserModel = (sequelize: Sequelize): void => {
  User.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(100), allowNull: false },
      avatar: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
      points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      role: {
        type: DataTypes.ENUM(...ROLE_VALUES),
        allowNull: false,
        defaultValue: ROLES.USER,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'users',
      modelName: 'User',
      underscored: true,
      indexes: [{ fields: ['points'], name: 'users_points_idx' }],
    }
  );
};
