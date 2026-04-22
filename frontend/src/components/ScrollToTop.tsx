import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Router v6 preserves scroll position across route changes by default;
 * for a Q&A site that feels broken (navigating to a new question yet still
 * scrolled halfway down the previous one). This pins the pattern: reset to
 * top on pathname change, never on query-string churn (filters etc.).
 */
export default function ScrollToTop(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
