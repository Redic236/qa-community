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
import { VOTE_TARGET_TYPE, type VoteTargetType } from './Vote';
import {
  REPORT_REASON_VALUES,
  REPORT_STATUSES,
  REPORT_STATUS_VALUES,
  type ReportReason,
  type ReportStatus,
} from '../utils/constants';

/**
 * Report.targetType reuses the same enum as Vote.targetType — questions and
 * answers are the only reportable entities.
 */
export class Report extends Model<
  InferAttributes<Report>,
  InferCreationAttributes<Report>
> {
  declare id: CreationOptional<number>;
  declare reporterId: ForeignKey<User['id']>;
  declare targetType: VoteTargetType;
  declare targetId: number;
  declare reason: ReportReason;
  declare details: CreationOptional<string | null>;
  declare status: CreationOptional<ReportStatus>;
  declare reviewerId: CreationOptional<number | null>;
  declare reviewedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
}

export const initReportModel = (sequelize: Sequelize): void => {
  Report.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      reporterId: { type: DataTypes.INTEGER, allowNull: false },
      targetType: {
        type: DataTypes.ENUM(VOTE_TARGET_TYPE.QUESTION, VOTE_TARGET_TYPE.ANSWER),
        allowNull: false,
      },
      targetId: { type: DataTypes.INTEGER, allowNull: false },
      reason: {
        type: DataTypes.ENUM(...REPORT_REASON_VALUES),
        allowNull: false,
      },
      details: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
      status: {
        type: DataTypes.ENUM(...REPORT_STATUS_VALUES),
        allowNull: false,
        defaultValue: REPORT_STATUSES.PENDING,
      },
      reviewerId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      reviewedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'reports',
      modelName: 'Report',
      underscored: true,
      updatedAt: false,
      indexes: [
        {
          unique: true,
          fields: ['reporter_id', 'target_type', 'target_id'],
          name: 'reports_reporter_target_unique',
        },
        { fields: ['status', 'created_at'], name: 'reports_status_created_idx' },
        { fields: ['target_type', 'target_id'], name: 'reports_target_idx' },
      ],
    }
  );
};
