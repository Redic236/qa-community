/* eslint-disable no-console */
import { sequelize, User } from '../src/models';
import { ROLES } from '../src/utils/constants';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run db:promote-admin -- <email>');
    process.exit(1);
  }

  await sequelize.authenticate();
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.error(`No user with email "${email}".`);
    process.exit(1);
  }

  if (user.role === ROLES.ADMIN) {
    console.log(`User "${user.username}" is already an admin.`);
  } else {
    user.role = ROLES.ADMIN;
    await user.save();
    console.log(`Promoted "${user.username}" to admin.`);
    console.log('Note: existing JWTs still carry the old role; user must log out & log in again.');
  }

  await sequelize.close();
}

main().catch((err: unknown) => {
  console.error('promote-admin failed:', err);
  process.exit(1);
});
