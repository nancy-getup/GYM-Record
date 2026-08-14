export type BodyPart = '引体' | '俯卧撑' | '热身' | '肩' | '手臂' | '臀腿' | '髋关节' | '背' | '胸' | '其他';

export type Side = '双侧' | '左侧' | '右侧' | '单侧';

export type QualityTag =
  | '动作稳定'
  | '发力感好'
  | '代偿'
  | '疼痛'
  | '腰酸'
  | '斜方接力'
  | '手臂接力'
  | '左右不平衡'
  | '动作变形';

export interface Exercise {
  id: string;
  name: string;
  bodyPart: BodyPart;
  defaultVariant?: string;
  targetMinReps: number;
  targetMaxReps: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  exerciseName: string;
  bodyPart: BodyPart;
  variant: string;
  side: Side;
  weight: number;
  reps: number;
  setIndex: number;
  rpe?: number;
  rir?: number;
  qualityScore: number;
  qualityTags: QualityTag[];
  note: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  title: string;
  bodyPart: BodyPart;
  sets: WorkoutSet[];
  note: string;
  source: 'manual' | 'import';
  readonly: boolean;
  syncedAt?: string;
  cloudId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryImport {
  id: string;
  fileName: string;
  importedAt: string;
  rawText: string;
  entries: ParsedHistoryEntry[];
}

export interface TrainingPlan {
  id: string;
  title: string;
  fileName: string;
  rawMarkdown: string;
  importedAt: string;
  updatedAt: string;
}

export interface ParsedHistoryEntry {
  id: string;
  date: string;
  bodyPart: BodyPart;
  exerciseName: string;
  rawText: string;
  weight?: number;
  reps?: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface SyncQueueItem {
  id: string;
  entityType: 'session' | 'historyImport';
  entityId: string;
  action: 'upsert';
  createdAt: string;
  lastError?: string;
}

export interface TrendPoint {
  date: string;
  sessionId: string;
  bestWeight: number;
  bestReps: number;
  totalVolume: number;
  bestSetVolume: number;
  setCount: number;
  qualityScore: number;
  blockedByQuality: boolean;
  note: string;
}

export type ProgressionStatus = 'first' | 'effective-progress' | 'volume-progress' | 'quality-blocked' | 'steady' | 'regressed';

export interface ProgressionResult {
  status: ProgressionStatus;
  title: string;
  detail: string;
}
