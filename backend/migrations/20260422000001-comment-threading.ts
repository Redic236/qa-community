import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Self-referential FK so deleting a parent cascades to its replies. Depth
  // is enforced at the service layer (max 2 levels) — cheaper than a trigger.
  await queryInterface.addColumn('comments', 'parent_id', {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'comments', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  });
  await queryInterface.addIndex('comments', ['parent_id'], {
    name: 'comments_parent_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('comments', 'comments_parent_idx');
  await queryInterface.removeColumn('comments', 'parent_id');
}
