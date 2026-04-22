import { test, expect } from '@playwright/test';
import { makeUser, register, login, logout, fieldByLabel, button } from '../helpers/flow';

test.describe('Auth', () => {
  test('register → shows logged-in state with 0 points', async ({ page }) => {
    const user = makeUser('reg');
    await register(page, user);
    await expect(page.getByText(`积分 0`, { exact: true })).toBeVisible();
  });

  test('logout → anonymous state', async ({ page }) => {
    const user = makeUser('logout');
    await register(page, user);
    await logout(page);
    const header = page.getByRole('banner');
    await expect(button(header, '登录')).toBeVisible();
    await expect(button(header, '注册')).toBeVisible();
  });

  test('login with correct credentials', async ({ page }) => {
    const user = makeUser('login');
    await register(page, user);
    await logout(page);
    await login(page, user);
    await expect(page.getByRole('banner').getByText(user.username)).toBeVisible();
  });

  test('login rejects wrong password', async ({ page }) => {
    const user = makeUser('badpw');
    await register(page, user);
    await logout(page);
    await page.goto('/login');
    await fieldByLabel(page, '邮箱').fill(user.email);
    await fieldByLabel(page, '密码').fill('wrong-password');
    await page.getByRole('main').locator('button[type="submit"]').click();
    await expect(page.getByText('邮箱或密码错误')).toBeVisible();
    // Still on login page
    await expect(page).toHaveURL('/login');
  });

  test('register form surfaces Zod errors in Chinese', async ({ page }) => {
    await page.goto('/register');
    await fieldByLabel(page, '用户名').fill('ab');
    await fieldByLabel(page, '邮箱').fill('not-an-email');
    await fieldByLabel(page, '密码').fill('123');
    await button(page, '创建账户').click();
    await expect(page.getByText(/用户名至少 3/)).toBeVisible();
    await expect(page.getByText(/邮箱格式不正确/)).toBeVisible();
    await expect(page.getByText(/密码至少 6/)).toBeVisible();
  });

  test('register rejects duplicate email', async ({ page }) => {
    const user = makeUser('dup');
    await register(page, user);
    await logout(page);
    // Now try to register again with same email, different username
    await page.goto('/register');
    await fieldByLabel(page, '用户名').fill(`${user.username}x`);
    await fieldByLabel(page, '邮箱').fill(user.email);
    await fieldByLabel(page, '密码').fill(user.password);
    await button(page, '创建账户').click();
    await expect(page.getByText('该邮箱已被注册')).toBeVisible();
  });
});
