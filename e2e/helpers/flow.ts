import { expect, type Page, type Locator } from '@playwright/test';
import { randomBytes } from 'node:crypto';

export interface User {
  username: string;
  email: string;
  password: string;
}

export function uniqueId(): string {
  return randomBytes(4).toString('hex');
}

export function makeUser(prefix = 'u'): User {
  const id = uniqueId();
  return {
    username: `${prefix}${id}`,
    email: `${prefix}${id}@e2e.test`,
    password: 'pass1234',
  };
}

/**
 * AntD Form.Item + RHF Controller doesn't wire up <label htmlFor>, so Playwright's
 * getByLabel can't find the underlying input. Locate the ant-form-item whose
 * label text matches, then drill into its input/textarea. Works inside modals
 * too when scope is narrowed.
 */
export function fieldByLabel(
  scope: Page | Locator,
  label: string,
  kind: 'input' | 'textarea' = 'input'
): Locator {
  // Self-contained CSS; avoids cross-scope semantics of filter({has}) that
  // were flaky inside AntD Modal portals. Use Playwright's :text-is() for
  // exact match so "密码" doesn't accidentally match "当前密码" / "新密码".
  return scope
    .locator(
      `.ant-form-item:has(> .ant-form-item-row .ant-form-item-label label:text-is("${label}"))`
    )
    .locator(kind)
    .first();
}

/**
 * Buttons with both an icon and a Chinese label may have the icon's aria-label
 * concatenated into their accessible name (e.g. "delete 删除"). Use text
 * filtering so we match regardless of icon presence.
 */
export function button(scope: Page | Locator, text: string | RegExp): Locator {
  return scope.locator('button').filter({ hasText: text });
}

export async function register(page: Page, user: User): Promise<void> {
  await page.goto('/register');
  await fieldByLabel(page, '用户名').fill(user.username);
  await fieldByLabel(page, '邮箱').fill(user.email);
  await fieldByLabel(page, '密码').fill(user.password);
  await button(page, '创建账户').click();
  await expect(page).toHaveURL('/');
  // Username shows in the header once the session is established
  await expect(page.getByRole('banner').getByText(user.username)).toBeVisible();
}

export async function login(page: Page, user: User): Promise<void> {
  await page.goto('/login');
  await fieldByLabel(page, '邮箱').fill(user.email);
  await fieldByLabel(page, '密码').fill(user.password);
  // The page also has a "登录" button in the header; scope to the form card's
  // primary submit button.
  await page.getByRole('main').locator('button[type="submit"]').click();
  await expect(page).toHaveURL('/');
}

export async function logout(page: Page): Promise<void> {
  await page.locator('.ant-avatar').first().hover();
  await page.getByText('退出登录').click();
  await expect(page).toHaveURL('/login');
}

export interface QuestionInput {
  title: string;
  content: string;
  tags?: string[];
}

export async function postQuestion(page: Page, input: QuestionInput): Promise<number> {
  await page.goto('/questions/new');
  await fieldByLabel(page, '标题').fill(input.title);
  await fieldByLabel(page, '内容', 'textarea').fill(input.content);
  if (input.tags && input.tags.length > 0) {
    const tagInput = page.getByPlaceholder('输入标签后按回车');
    for (const tag of input.tags) {
      await tagInput.fill(tag);
      await tagInput.press('Enter');
    }
  }
  await button(page, /^发布$/).click();
  await page.waitForURL(/\/questions\/\d+$/);
  const match = page.url().match(/\/questions\/(\d+)$/);
  if (!match) throw new Error(`Unable to parse question id from ${page.url()}`);
  return Number(match[1]);
}

export async function postAnswer(page: Page, content: string): Promise<void> {
  const textarea = page.locator('textarea[placeholder="写下你的答案..."]');
  await textarea.fill(content);
  await button(page, '发布回答').click();
  await expect(page.getByText(content)).toBeVisible();
}
