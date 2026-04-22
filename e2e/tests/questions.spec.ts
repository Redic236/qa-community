import { test, expect } from '@playwright/test';
import { makeUser, register, postQuestion, uniqueId, fieldByLabel, button } from '../helpers/flow';

test.describe('Questions CRUD', () => {
  test('create → detail → list', async ({ page }) => {
    const user = makeUser('q');
    await register(page, user);

    const title = `E2E create ${uniqueId()}`;
    const id = await postQuestion(page, {
      title,
      content: 'Initial content for the E2E created question.',
      tags: ['e2etag'],
    });

    // On detail page: title + -5 points
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('积分 -5', { exact: true })).toBeVisible();

    // Visible on home list too
    await page.goto('/');
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    expect(id).toBeGreaterThan(0);
  });

  test('edit own question via modal', async ({ page }) => {
    const user = makeUser('qedit');
    await register(page, user);

    const title = `E2E edit ${uniqueId()}`;
    await postQuestion(page, {
      title,
      content: 'Content before edit.',
      tags: ['editme'],
    });

    await button(page, '编辑').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const newTitle = `${title} 修改后`;
    await fieldByLabel(dialog, '标题').fill(newTitle);
    await button(dialog, '保存').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: newTitle })).toBeVisible();
  });

  test('delete own question → redirect home, gone from list', async ({ page }) => {
    const user = makeUser('qdel');
    await register(page, user);

    const title = `E2E delete ${uniqueId()}`;
    await postQuestion(page, { title, content: 'Will be deleted soon.' });

    // Click the question-card 删除 trigger
    await button(page, '删除').first().click();
    // AntD Popconfirm's OK button carries our custom label "删除"
    const popconfirm = page.locator('.ant-popconfirm, .ant-popover').last();
    await button(popconfirm, '删除').click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  });

  test('non-author does NOT see edit/delete on question', async ({ page, context }) => {
    const author = makeUser('author');
    await register(page, author);
    const title = `E2E nonauthor ${uniqueId()}`;
    const id = await postQuestion(page, { title, content: 'Content for non-author test.' });

    const other = await context.browser()!.newContext();
    const otherPage = await other.newPage();
    const visitor = makeUser('visitor');
    await register(otherPage, visitor);
    await otherPage.goto(`/questions/${id}`);
    await expect(otherPage.getByRole('heading', { name: title })).toBeVisible();
    // No author-only buttons present
    await expect(button(otherPage, '编辑')).toHaveCount(0);
    await expect(button(otherPage, '删除')).toHaveCount(0);
    await other.close();
  });
});
