import { DataTypes, type QueryInterface } from 'sequelize';

/**
 * Tracks user-uploaded files (images attached to questions / answers /
 * avatars). DB row is the source of truth for ownership; the actual blob
 * lives on disk under /uploads.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('uploads', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    uploader_id: { type: DataTypes.INTEGER, allowNull: false },
    filename: { type: DataTypes.STRING(100), allowNull: false },
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    size_bytes: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('uploads', ['uploader_id'], { name: 'uploads_uploader_idx' });
  await queryInterface.addIndex('uploads', ['created_at'], { name: 'uploads_created_at_idx' });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('uploads');
}
