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

export const FOLLOW_TARGET_TYPE = {
  USER: 'user',
  QUESTION: 'question',
} as const;

export type FollowTargetType =
  (typeof FOLLOW_TARGET_TYPE)[keyof typeof FOLLOW_TARGET_TYPE];

export const FOLLOW_TARGET_VALUES = Object.values(FOLLOW_TARGET_TYPE) as FollowTargetType[];

export class Follow extends Model<
  InferAttributes<Follow>,
  InferCreationAttributes<Follow>
> {
  declare id: CreationOptional<number>;
  declare followerId: ForeignKey<User['id']>;
  declare targetType: FollowTargetType;
  declare targetId: number;
  declare createdAt: CreationOptional<Date>;
}

export const initFollowModel = (sequelize: Sequelize): void => {
  Follow.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      followerId: { type: DataTypes.INTEGER, allowNull: false },
      targetType: {
        type: DataTypes.ENUM(FOLLOW_TARGET_TYPE.USER, FOLLOW_TARGET_TYPE.QUESTION),
        allowNull: false,
      },
      targetId: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'follows',
      modelName: 'Follow',
      underscored: true,
      updatedAt: false,
      indexes: [
        {
          unique: true,
          fields: ['follower_id', 'target_type', 'target_id'],
          name: 'follows_follower_target_uk',
        },
        {
          fields: ['target_type', 'target_id'],
          name: 'follows_target_idx',
        },
      ],
    }
  );
};
