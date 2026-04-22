import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';

dayjs.extend(relativeTime);

function resolveLocale(lang: string): string {
  return lang.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en';
}

/** "3 分钟前" / "3 minutes ago" — for list rows, notification feeds, etc. */
export function formatRelativeTime(iso: string, lang: string): string {
  return dayjs(iso).locale(resolveLocale(lang)).fromNow();
}

/** Full timestamp in the user's system locale. Used as the tooltip. */
export function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
