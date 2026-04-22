import { useEffect } from 'react';

/**
 * Shows the browser's native "leave site?" prompt when the user tries to
 * close the tab, reload, or type a new URL while `isDirty` is true.
 *
 * Only fires on page-level navigation — react-router in-app links are not
 * affected, so a successful submit that calls `navigate(...)` won't trigger
 * the dialog.
 *
 * Why: users were losing long-form Q&A drafts to accidental reloads /
 * tab-closes.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent): void => {
      // Chrome needs both preventDefault and a truthy returnValue; the
      // actual string is ignored by all modern browsers in favor of the
      // generic localized prompt.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
