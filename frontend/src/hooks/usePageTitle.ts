import { useEffect } from 'react';

const SUFFIX = '问答社区';

/**
 * Sets document.title to "<title> · 问答社区". Pass null to use just the suffix.
 * Restores original title on unmount so back-navigation works cleanly.
 */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
