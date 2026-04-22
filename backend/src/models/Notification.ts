import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type Sequelize,
} from 'sequelize';
import type { User } from './User';
import {
  NOTIFICATION_TYPE_VALUES,
  type NotificationType,
} from '../utils/constants';

export class Notification extends Model<
  InferAttributes<Notification>,
  InferCreationAttributes<Notification>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  declare type: NotificationType;
  declare payload: Record<string, unknown>;
  declare read: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
}

export const initNotificationModel = (sequelize: Sequelize): void => {
  Notification.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM(...NOTIFICATION_TYPE_VALUES),
        allowNull: false,
      },
      payload: { type: DataTypes.JSON, allowNull: false },
      read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'notifications',
      modelName: 'Notification',
      underscored: true,
      updatedAt: false,
      indexes: [
        {
          fields: ['user_id', 'read', 'created_at'],
          name: 'notifications_user_read_created_idx',
        },
      ],
    }
  );
};
