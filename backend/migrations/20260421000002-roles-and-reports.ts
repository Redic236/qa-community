import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addColumn('users', 'role', {
    type: DataTypes.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user',
  });
  await queryInterface.addIndex('users', ['role']);

  await queryInterface.createTable('reports', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    reporter_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    target_type: {
      type: DataTypes.ENUM('question', 'answer'),
      allowNull: false,
    },
    target_id: { type: DataTypes.INTEGER, allowNull: false },
    reason: {
      type: DataTypes.ENUM('spam', 'offensive', 'off_topic', 'duplicate', 'other'),
      allowNull: false,
    },
    details: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    status: {
      type: DataTypes.ENUM('pending', 'reviewed_kept', 'reviewed_removed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    reviewer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    reviewed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // One pending report per (reporter, target) — re-reporting after review is OK,
  // app code only blocks while a prior pending report from the same reporter exists.
  await queryInterface.addIndex('reports', {
    fields: ['reporter_id', 'target_type', 'target_id'],
    unique: true,
    name: 'reports_reporter_target_unique',
  });
  await queryInterface.addIndex('reports', ['status', 'created_at'], {
    name: 'reports_status_created_idx',
  });
  await queryInterface.addIndex('reports', ['target_type', 'target_id'], {
    name: 'reports_target_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('reports');
  await queryInterface.removeIndex('users', ['role']);
  await queryInterface.removeColumn('users', 'role');
}
