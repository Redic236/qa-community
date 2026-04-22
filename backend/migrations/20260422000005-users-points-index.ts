import type { QueryInterface } from 'sequelize';

/**
 * Covers the `ORDER BY points DESC` scans that back:
 *   - leaderboard (GET /api/leaderboard)
 *   - admin stats top-users
 *
 * Without this, MySQL does a full-table sort once the users table grows
 * beyond a few thousand rows.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.addIndex('users', ['points'], {
    name: 'users_points_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('users', 'users_points_idx');
}
