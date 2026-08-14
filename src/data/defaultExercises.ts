import type { Exercise } from '@/types';

const now = new Date().toISOString();

export const defaultExercises: Exercise[] = [
  ['ex-pull-hang', '动态悬挂', '引体'],
  ['ex-assisted-pullup', '半蹲引体', '引体'],
  ['ex-shoulder-press', '推肩', '肩'],
  ['ex-front-raise', '前平举', '肩'],
  ['ex-lateral-raise', '侧平举', '肩'],
  ['ex-face-pull', '面拉', '肩'],
  ['ex-rear-fly', '蝴蝶机飞鸟', '肩'],
  ['ex-curl', '二头弯举', '手臂'],
  ['ex-triceps-pushdown', '绳索下压三头', '手臂'],
  ['ex-zercher-squat', '泽奇深蹲', '臀腿'],
  ['ex-rdl', '罗拉', '臀腿'],
  ['ex-bulgarian', '保加利亚', '臀腿'],
  ['ex-hip-thrust', '臀推', '臀腿'],
  ['ex-abduction', '外展', '臀腿'],
  ['ex-hamstring-curl', '腘绳肌器械', '臀腿'],
  ['ex-adduction', '内收器械', '臀腿'],
  ['ex-lat-pulldown', '高位下拉', '背'],
  ['ex-row', '划船', '背'],
  ['ex-straight-arm', '直臂下压', '背'],
  ['ex-chest-press', '器械推胸', '胸'],
  ['ex-incline-press', '上斜推胸', '胸'],
].map(([id, name, bodyPart]) => ({
  id,
  name,
  bodyPart: bodyPart as Exercise['bodyPart'],
  defaultVariant: '',
  targetMinReps: 8,
  targetMaxReps: 15,
  createdAt: now,
  updatedAt: now,
}));
