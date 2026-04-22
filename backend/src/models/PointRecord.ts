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
import { POINT_TYPE_VALUES, type PointType } from '../utils/constants';

export class PointRecord extends Model<
  InferAttributes<PointRecord>,
  InferCreationAttributes<PointRecord>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  declare type: PointType;
  declare points: number;
  declare relatedId: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
}

export const initPointRecordModel = (sequelize: Sequelize): void => {
  PointRecord.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM(...POINT_TYPE_VALUES),
        allowNull: false,
      },
      points: { type: DataTypes.INTEGER, allowNull: false },
      relatedId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'point_records',
      modelName: 'PointRecord',
      underscored: true,
      updatedAt: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['type'] },
      ],
    }
  );
};
