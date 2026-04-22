/**
 * Warm lazy-route chunks on user intent (hover / focus) so the click-to-
 * render transition is effectively instant.
 *
 * Each importer is a thunk that matches the exact form passed to React.lazy
 * in routes.tsx — Vite/Rollup maps identical `import()` specifiers to the
 * same chunk, so calling it twice does NOT double-download.
 *
 * Why a map instead of re-inlining import() at every call site? Centralises
 * the chunk names so a future rename only touches one file.
 */

type Importer = () => Promise<unknown>;

const importers: Record<string, Importer> = {
  login: () => import('@/pages/LoginPage'),
  register: () => import('@/pages/RegisterPage'),
  ask: () => import('@/pages/AskQuestionPage'),
  profile: () => import('@/pages/ProfilePage'),
  questionDetail: () => import('@/pages/QuestionDetailPage'),
  leaderboard: () => import('@/pages/LeaderboardPage'),
  achievements: () => import('@/pages/AchievementsPage'),
  adminReports: () => import('@/pages/AdminReportsPage'),
  adminDashboard: () => import('@/pages/AdminDashboardPage'),
};

const warmed = new Set<string>();

export type PrefetchTarget = keyof typeof importers;

/** Fire-and-forget; ignore rejections (network hiccups don't block UX). */
export function prefetchRoute(target: PrefetchTarget): void {
  if (warmed.has(target)) return;
  warmed.add(target);
  importers[target]().catch(() => {
    // Let a subsequent call retry by clearing the memo on failure.
    warmed.delete(target);
  });
}
