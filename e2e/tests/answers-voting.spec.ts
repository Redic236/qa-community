import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { makeUser, register, postQuestion, postAnswer, uniqueId, button } from '../helpers/flow';

/**
 * Spawn a separate browser context (fresh cookie jar / localStorage) so we can
 * drive flows that need two distinct authenticated users simultaneously.
 */
async function secondUser(
  context: BrowserContext,
  prefix: string
): Promise<{ page: Page; close: () => Promise<void>; username: string }> {
  const other = await context.browser()!.newContext();
  const page = await other.newPage();
  const user = makeUser(prefix);
  await register(page, user);
  return { page, username: user.username, close: () => other.close() };
}

test.describe('Answers + voting + acceptance', () => {
  test('post answer → answerer gets +10', async ({ page, context }) => {
    const asker = makeUser('ask');
    await register(page, asker);
    const title = `E2E answer ${uniqueId()}`;
    const qId = await postQuestion(page, { title, content: 'Question seeking an answer.' });

    const bob = await secondUser(context, 'ans');
    await bob.page.goto(`/questions/${qId}`);
    const content = `Bob's answer ${uniqueId()}`;
    await postAnswer(bob.page, content);

    await expect(bob.page.getByText('积分 10', { exact: true })).toBeVisible();
    await expect(bob.page.getByText(content)).toBeVisible();

    await bob.close();
  });

  test('vote on question → counter +1 and author points +5', async ({ page, context }) => {
    const asker = makeUser('vask');
    await register(page, asker);
    const qId = await postQuestion(page, {
      title: `E2E vote ${uniqueId()}`,
      content: 'Question to be voted on by another user.',
    });
    await expect(page.getByText('积分 -5', { exact: true })).toBeVisible();

    const liker = await secondUser(context, 'vliker');
    await liker.page.goto(`/questions/${qId}`);
    await liker.page.getByRole('button', { name: '点赞问题', exact: true }).click();
    // After the toggle, the aria-label flips to 取消点赞问题 (mutation resolved)
    await expect(
      liker.page.getByRole('button', { name: '取消点赞问题', exact: true })
    ).toBeVisible();

    await page.goto(`/questions/${qId}`);
    await expect(page.getByText('积分 0', { exact: true })).toBeVisible();

    await liker.close();
  });

  test('self-vote is disabled', async ({ page }) => {
    const user = makeUser('selfvote');
    await register(page, user);
    await postQuestion(page, {
      title: `E2E self-vote ${uniqueId()}`,
      content: 'Author should be unable to upvote own question.',
    });
    const btn = page.getByRole('button', { name: '点赞问题', exact: true });
    await expect(btn).toBeDisabled();
  });

  test('accept answer → question marked 已解决, answerer +30', async ({ page, context }) => {
    const asker = makeUser('accask');
    await register(page, asker);
    const qId = await postQuestion(page, {
      title: `E2E accept ${uniqueId()}`,
      content: 'Seeking an accepted answer.',
    });

    const bob = await secondUser(context, 'accans');
    await bob.page.goto(`/questions/${qId}`);
    const ansContent = `Bob's answer ${uniqueId()}`;
    await postAnswer(bob.page, ansContent);
    await expect(bob.page.getByText('积分 10', { exact: true })).toBeVisible();

    await page.goto(`/questions/${qId}`);
    await button(page, '采纳此答案').click();

    await expect(page.getByText('已解决').first()).toBeVisible();
    await expect(page.getByText('已采纳').first()).toBeVisible();

    await bob.page.goto(`/questions/${qId}`);
    await expect(bob.page.getByText('积分 40', { exact: true })).toBeVisible();

    await bob.close();
  });

  test('unaccept removes solved status (no point reversal)', async ({ page, context }) => {
    const asker = makeUser('unask');
    await register(page, asker);
    const qId = await postQuestion(page, {
      title: `E2E unaccept ${uniqueId()}`,
      content: 'Testing unaccept flow.',
    });

    const bob = await secondUser(context, 'unans');
    await bob.page.goto(`/questions/${qId}`);
    await postAnswer(bob.page, `Bob answer ${uniqueId()}`);

    await page.goto(`/questions/${qId}`);
    await button(page, '采纳此答案').click();
    await expect(page.getByText('已解决').first()).toBeVisible();

    await button(page, '取消采纳').click();
    await expect(page.getByText('已采纳')).toHaveCount(0);

    await bob.page.goto(`/questions/${qId}`);
    await expect(bob.page.getByText('积分 40', { exact: true })).toBeVisible();

    await bob.close();
  });
});
