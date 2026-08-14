import { describe, expect, it } from 'vitest';
import { evaluateProgression, isQualityBlocked, setVolume } from './analysis';
import type { TrendPoint } from '@/types';

function point(partial: Partial<TrendPoint>): TrendPoint {
  return {
    date: '2026-08-01',
    sessionId: 's1',
    bestWeight: 10,
    bestReps: 10,
    totalVolume: 300,
    bestSetVolume: 100,
    setCount: 3,
    qualityScore: 4,
    blockedByQuality: false,
    note: '',
    ...partial,
  };
}

describe('progressive overload analysis', () => {
  it('calculates set volume', () => {
    expect(setVolume(12.5, 8)).toBe(100);
  });

  it('blocks questionable quality', () => {
    expect(isQualityBlocked(4, ['动作稳定'], '发力很好')).toBe(false);
    expect(isQualityBlocked(4, ['代偿'], '重量上去了')).toBe(true);
    expect(isQualityBlocked(4, [], '最后一个完全变形')).toBe(true);
  });

  it('detects effective progression when weight and reps improve', () => {
    const result = evaluateProgression([point({ date: '2026-08-01' }), point({ date: '2026-08-08', bestWeight: 12.5 })]);
    expect(result.status).toBe('effective-progress');
  });

  it('marks improved performance as blocked when quality drops', () => {
    const result = evaluateProgression([
      point({ date: '2026-08-01' }),
      point({ date: '2026-08-08', bestWeight: 12.5, blockedByQuality: true }),
    ]);
    expect(result.status).toBe('quality-blocked');
  });
});
