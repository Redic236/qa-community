import { BadRequestError } from '../utils/errors';

/**
 * MVP-grade content moderation: a banned-substring blacklist applied to
 * question/answer text. Production should layer this with a real classifier
 * (toxicity API, manual review queue, user reports) — this file just rejects
 * the most obvious spam/scam patterns at the API boundary.
 *
 * The list is overridable via the BANNED_WORDS env var (comma-separated) so
 * ops can extend it without a code deploy. Defaults cover typical CN-language
 * spam beacons.
 */
const DEFAULT_BANNED_WORDS = [
  '联系微信',
  '加我QQ',
  '加我qq',
  '私聊微信',
  '点击链接领取',
  '免费送',
  '一夜暴富',
];

function loadBannedWords(): string[] {
  const fromEnv = process.env.BANNED_WORDS;
  if (fromEnv === undefined) return DEFAULT_BANNED_WORDS;
  return fromEnv
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

// Memoize per-process so we don't re-parse on every request, but stay
// re-readable from tests that mutate process.env between cases.
let cached: { value: string[]; envSnapshot: string | undefined } | null = null;
function bannedWords(): string[] {
  if (!cached || cached.envSnapshot !== process.env.BANNED_WORDS) {
    cached = { value: loadBannedWords(), envSnapshot: process.env.BANNED_WORDS };
  }
  return cached.value;
}

export class ModerationService {
  /** Returns the first banned term found in `text`, or null when clean. */
  static findBanned(text: string): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const word of bannedWords()) {
      if (lower.includes(word.toLowerCase())) return word;
    }
    return null;
  }

  /**
   * Throw BadRequestError if any of the given fields contains banned content.
   * Pass field name → text pairs so we can surface which field offended.
   */
  static assertClean(fields: Record<string, string | undefined>): void {
    for (const [field, text] of Object.entries(fields)) {
      if (text === undefined) continue;
      const hit = this.findBanned(text);
      if (hit) {
        throw new BadRequestError(
          `内容包含违禁词 "${hit}"（字段: ${field}）`,
          'bannedWord',
          { word: hit, field }
        );
      }
    }
  }
}
