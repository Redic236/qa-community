export interface Level {
  index: number;
  name: string;
  color: string;
  threshold: number;
  /** Threshold of the next tier; null when at top tier. */
  nextThreshold: number | null;
}

const LEVELS: Array<Pick<Level, 'name' | 'color' | 'threshold'>> = [
  { name: '新手', color: 'default', threshold: 0 },
  { name: '活跃', color: 'blue', threshold: 50 },
  { name: '资深', color: 'cyan', threshold: 200 },
  { name: '专家', color: 'purple', threshold: 600 },
  { name: '大师', color: 'gold', threshold: 1500 },
];

/** Map a points total to its level descriptor. Negative points → 新手. */
export function getLevel(points: number): Level {
  let i = 0;
  for (let k = LEVELS.length - 1; k >= 0; k--) {
    if (points >= LEVELS[k].threshold) {
      i = k;
      break;
    }
  }
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  return {
    index: i,
    name: cur.name,
    color: cur.color,
    threshold: cur.threshold,
    nextThreshold: next ? next.threshold : null,
  };
}

/** 0..1 progress within current tier; 1 when at top tier. */
export function levelProgress(points: number, level: Level): number {
  if (level.nextThreshold === null) return 1;
  const span = level.nextThreshold - level.threshold;
  if (span <= 0) return 1;
  const earned = Math.max(0, points - level.threshold);
  return Math.min(1, earned / span);
}
