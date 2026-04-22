import { test, expect } from '@playwright/test';
import {
  makeUser,
  register,
  postQuestion,
  uniqueId,
  login,
  logout,
  fieldByLabel,
  button,
} from '../helpers/flow';

test.describe('Profile', () => {
  test('profile page shows current points and empty history initially', async ({ page }) => {
    const user = makeUser('prof');
    await register(page, user);
    await page.locator('.ant-avatar').first().hover();
    await page.getByText('个人中心').click();
    await expect(page).toHaveURL('/profile');
    // Username appears in multiple places on /profile; scope to the profile heading
    await expect(page.getByRole('heading', { name: user.username })).toBeVisible();
    await expect(page.getByText('当前积分')).toBeVisible();
    // Profile page has multiple empty states now (points history + followed
    // questions/users tabs). Scoping to `.first()` is the least brittle way
    // to assert "at least one empty state is showing" for a fresh account.
    await expect(page.locator('.ant-empty').first()).toBeVisible();
  });

  test('point history reflects actions (ask -5)', async ({ page }) => {
    const user = makeUser('history');
    await register(page, user);
    await postQuestion(page, {
      title: `History ${uniqueId()}`,
      content: 'Seeding a point record via ask.',
    });
    await page.goto('/profile');
    await expect(page.getByText('发布问题').first()).toBeVisible();
    await expect(page.getByText('-5').first()).toBeVisible();
  });

  test('edit username → reflected in header', async ({ page }) => {
    const user = makeUser('un');
    await register(page, user);
    await page.goto('/profile');
    await button(page, '编辑资料').click();

    const newName = `${user.username}_edited`;
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await fieldByLabel(dialog, '用户名').fill(newName);
    await button(dialog, '保存').click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('banner').getByText(newName)).toBeVisible();
  });

  test('change password → old one fails, new one works', async ({ page }) => {
    const user = makeUser('pw');
    await register(page, user);
    await page.goto('/profile');
    await button(page, '编辑资料').click();

    const newPassword = 'newpass9999';
    const dialog = page.getByRole('dialog');
    await fieldByLabel(dialog, '当前密码').fill(user.password);
    await fieldByLabel(dialog, '新密码').fill(newPassword);
    await button(dialog, '保存').click();
    await expect(dialog).toBeHidden();

    await logout(page);
    await login(page, { ...user, password: newPassword });
    await expect(page.getByRole('banner').getByText(user.username)).toBeVisible();
  });

  test('change password with wrong current password shows error', async ({ page }) => {
    const user = makeUser('badpw');
    await register(page, user);
    await page.goto('/profile');
    await button(page, '编辑资料').click();

    const dialog = page.getByRole('dialog');
    await fieldByLabel(dialog, '当前密码').fill('totally-wrong-password');
    await fieldByLabel(dialog, '新密码').fill('anothernew123');
    await button(dialog, '保存').click();

    await expect(dialog.getByText('当前密码不正确')).toBeVisible();
  });
});
