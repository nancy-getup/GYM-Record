import type { ProgressionResult, TrendPoint, WorkoutSession } from '@/types';

const blockingTags = new Set(['代偿', '疼痛', '腰酸', '斜方接力', '手臂接力', '左右不平衡', '动作变形']);

export function setVolume(weight: number, reps: number) {
  return Math.max(0, weight) * Math.max(0, reps);
}

export function isQualityBlocked(qualityScore: number, tags: string[], note: string) {
  const normalizedNote = note.toLowerCase();
  const noteBlocked = ['疼', '痛', '腰酸', '代偿', '变形', '全是手', '斜方', '不稳', '接力'].some((word) =>
    normalizedNote.includes(word),
  );
  return qualityScore <= 2 || tags.some((tag) => blockingTags.has(tag)) || noteBlocked;
}

export function buildTrendPoints(sessions: WorkoutSession[], exerciseName: string, variant = '', side = ''): TrendPoint[] {
  return sessions
    .filter((session) => !session.readonly)
    .map((session) => {
      const sets = session.sets.filter((set) => {
        const sameExercise = set.exerciseName === exerciseName;
        const sameVariant = variant ? set.variant === variant : true;
        const sameSide = side ? set.side === side : true;
        return sameExercise && sameVariant && sameSide;
      });
      if (!sets.length) return null;

      const bestSet = [...sets].sort((a, b) => {
        const volumeDelta = setVolume(b.weight, b.reps) - setVolume(a.weight, a.reps);
        if (volumeDelta !== 0) return volumeDelta;
        return b.weight - a.weight || b.reps - a.reps;
      })[0];
      const note = sets.map((set) => set.note).filter(Boolean).join('；');
      const qualityScore = Math.round(sets.reduce((sum, set) => sum + set.qualityScore, 0) / sets.length);

      return {
        date: session.date,
        sessionId: session.id,
        bestWeight: bestSet.weight,
        bestReps: bestSet.reps,
        totalVolume: sets.reduce((sum, set) => sum + setVolume(set.weight, set.reps), 0),
        bestSetVolume: setVolume(bestSet.weight, bestSet.reps),
        setCount: sets.length,
        qualityScore,
        blockedByQuality: sets.some((set) => isQualityBlocked(set.qualityScore, set.qualityTags, set.note)),
        note,
      };
    })
    .filter((point): point is TrendPoint => Boolean(point))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function evaluateProgression(points: TrendPoint[]): ProgressionResult {
  if (!points.length) {
    return {
      status: 'steady',
      title: '还没有可分析记录',
      detail: '先记录一次训练，这里会开始判断趋势。',
    };
  }
  if (points.length === 1) {
    return {
      status: 'first',
      title: '已建立基准',
      detail: '这是这个动作的第一条结构化记录，下一次就能比较是否进步。',
    };
  }

  const current = points[points.length - 1]!;
  const previous = points[points.length - 2]!;
  const heavier = current.bestWeight > previous.bestWeight && current.bestReps >= previous.bestReps;
  const moreReps = current.bestWeight >= previous.bestWeight && current.bestReps > previous.bestReps;
  const moreVolume = current.totalVolume > previous.totalVolume;

  if ((heavier || moreReps || moreVolume) && current.blockedByQuality) {
    return {
      status: 'quality-blocked',
      title: '强度上去了，但质量要先稳住',
      detail: '本次重量、次数或容量有提升，但记录里出现了疼痛、代偿或动作变形信号。',
    };
  }

  if (heavier || moreReps) {
    return {
      status: 'effective-progress',
      title: '有效渐进超负荷',
      detail: `从 ${previous.bestWeight}kg/${previous.bestReps} 次到 ${current.bestWeight}kg/${current.bestReps} 次，且质量没有被阻断。`,
    };
  }

  if (moreVolume && !current.blockedByQuality) {
    return {
      status: 'volume-progress',
      title: '容量进步',
      detail: `总容量从 ${Math.round(previous.totalVolume)} 提升到 ${Math.round(current.totalVolume)}。`,
    };
  }

  if (current.bestSetVolume < previous.bestSetVolume || current.totalVolume < previous.totalVolume) {
    return {
      status: 'regressed',
      title: '本次偏回落',
      detail: '重量、次数或总容量低于上次。若状态不好，这可以视为恢复日。',
    };
  }

  return {
    status: 'steady',
    title: '保持中',
    detail: '这次与上次接近，可以继续巩固动作质量或尝试小幅增加次数。',
  };
}
