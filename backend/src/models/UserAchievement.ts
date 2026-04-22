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

export class UserAchievement extends Model<
  InferAttributes<UserAchievement>,
  InferCreationAttributes<UserAchievement>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  declare achievementCode: string;
  declare unlockedAt: CreationOptional<Date>;
}

export const initUserAchievementModel = (sequelize: Sequelize): void => {
  UserAchievement.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      achievementCode: { type: DataTypes.STRING(50), allowNull: false },
      unlockedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'user_achievements',
      modelName: 'UserAchievement',
      underscored: true,
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'achievement_code'],
          name: 'user_achievements_user_code_uk',
        },
        { fields: ['user_id'], name: 'user_achievements_user_idx' },
      ],
    }
  );
};
