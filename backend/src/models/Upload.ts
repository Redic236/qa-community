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

/**
 * Tracks ownership + metadata of every user-uploaded file.
 *
 * We keep this in DB (not just filesystem) so:
 *   - ownership / rate-limit checks can use SQL
 *   - future cleanup job can find orphaned files by joining against
 *     questions/answers content for markdown URL references
 */
export class Upload extends Model<
  InferAttributes<Upload>,
  InferCreationAttributes<Upload>
> {
  declare id: CreationOptional<number>;
  declare uploaderId: ForeignKey<User['id']>;
  declare filename: string;
  declare mimeType: string;
  declare sizeBytes: number;
  declare url: string;
  declare createdAt: CreationOptional<Date>;
}

export const initUploadModel = (sequelize: Sequelize): void => {
  Upload.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      uploaderId: { type: DataTypes.INTEGER, allowNull: false },
      filename: { type: DataTypes.STRING(100), allowNull: false },
      mimeType: { type: DataTypes.STRING(100), allowNull: false },
      sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
      url: { type: DataTypes.STRING(500), allowNull: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'uploads',
      modelName: 'Upload',
      underscored: true,
      updatedAt: false,
      indexes: [
        { fields: ['uploader_id'], name: 'uploads_uploader_idx' },
        { fields: ['created_at'], name: 'uploads_created_at_idx' },
      ],
    }
  );
};
