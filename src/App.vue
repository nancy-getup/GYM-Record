<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { BodyPart, Exercise, HistoryImport, QualityTag, Side, TrainingPlan, WorkoutSession, WorkoutSet } from '@/types';
import { buildTrendPoints, evaluateProgression, setVolume } from '@/lib/analysis';
import { syncPendingChanges, isCloudBaseConfigured } from '@/lib/cloudbase';
import { parseHistoryMarkdown } from '@/lib/mdImport';
import { renderMarkdown } from '@/lib/markdown';
import { getPlanTitle, isSupportedPlanFileName } from '@/lib/planImport';
import { createId, todayISO } from '@/lib/id';
import { ensureDefaultExercises, getAll, saveHistoryImport, saveSession, saveTrainingPlan } from '@/lib/storage';

type Tab = 'today' | 'history' | 'plans' | 'trends' | 'settings';

const bodyParts: BodyPart[] = ['肩', '臀腿', '背', '胸', '手臂', '引体', '俯卧撑', '热身', '髋关节', '其他'];
const sides: Side[] = ['双侧', '左侧', '右侧', '单侧'];
const qualityTags: QualityTag[] = [
  '动作稳定',
  '发力感好',
  '代偿',
  '疼痛',
  '腰酸',
  '斜方接力',
  '手臂接力',
  '左右不平衡',
  '动作变形',
];

const activeTab = ref<Tab>('today');
const exercises = ref<Exercise[]>([]);
const sessions = ref<WorkoutSession[]>([]);
const historyImports = ref<HistoryImport[]>([]);
const trainingPlans = ref<TrainingPlan[]>([]);
const syncMessage = ref('本地模式已就绪');
const selectedTrendExercise = ref('');
const selectedTrendVariant = ref('');
const selectedTrendSide = ref('');
const selectedPlanId = ref('');
const isSavingWorkout = ref(false);
const isImportingHistory = ref(false);
const isImportingPlan = ref(false);
const appError = ref('');

const form = reactive({
  date: todayISO(),
  bodyPart: '肩' as BodyPart,
  exerciseId: '',
  customExercise: '',
  variant: '',
  side: '双侧' as Side,
  weight: 0,
  reps: 12,
  setCount: 3,
  qualityScore: 4,
  qualityTags: [] as QualityTag[],
  note: '',
});

const filteredExercises = computed(() => exercises.value.filter((exercise) => exercise.bodyPart === form.bodyPart));
const selectedExercise = computed(() => exercises.value.find((exercise) => exercise.id === form.exerciseId));
const manualSessions = computed(() => sessions.value.filter((session) => !session.readonly).sort((a, b) => b.date.localeCompare(a.date)));
const importedEntryCount = computed(() => historyImports.value.reduce((sum, item) => sum + item.entries.length, 0));
const sortedTrainingPlans = computed(() => [...trainingPlans.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
const selectedPlan = computed(() => trainingPlans.value.find((plan) => plan.id === selectedPlanId.value) || sortedTrainingPlans.value[0]);
const renderedPlan = computed(() => (selectedPlan.value ? renderMarkdown(selectedPlan.value.rawMarkdown) : ''));
const trendExerciseNames = computed(() =>
  Array.from(new Set(sessions.value.flatMap((session) => session.sets.map((set) => set.exerciseName)))).sort(),
);
const trendPoints = computed(() =>
  selectedTrendExercise.value
    ? buildTrendPoints(sessions.value, selectedTrendExercise.value, selectedTrendVariant.value, selectedTrendSide.value)
    : [],
);
const progression = computed(() => evaluateProgression(trendPoints.value));
const trendMaxVolume = computed(() => Math.max(1, ...trendPoints.value.map((point) => point.totalVolume)));
const latestImported = computed(() => historyImports.value[historyImports.value.length - 1]);

async function loadData() {
  try {
    exercises.value = await ensureDefaultExercises();
    sessions.value = await getAll<WorkoutSession>('sessions');
    historyImports.value = await getAll<HistoryImport>('historyImports');
    trainingPlans.value = await getAll<TrainingPlan>('trainingPlans');
    if (!form.exerciseId && filteredExercises.value[0]) {
      form.exerciseId = filteredExercises.value[0].id;
    }
    if (!selectedPlanId.value && sortedTrainingPlans.value[0]) {
      selectedPlanId.value = sortedTrainingPlans.value[0].id;
    }
    if (!selectedTrendExercise.value && trendExerciseNames.value[0]) {
      selectedTrendExercise.value = trendExerciseNames.value[0];
    }
  } catch (error) {
    appError.value = error instanceof Error ? `读取本地数据失败：${error.message}` : '读取本地数据失败，请刷新后重试。';
  }
}

function toggleQualityTag(tag: QualityTag) {
  if (form.qualityTags.includes(tag)) {
    form.qualityTags = form.qualityTags.filter((item) => item !== tag);
  } else {
    form.qualityTags = [...form.qualityTags, tag];
  }
}

function buildSets(exerciseName: string, exerciseId: string): WorkoutSet[] {
  return Array.from({ length: form.setCount }, (_, index) => ({
    id: createId('set'),
    exerciseId,
    exerciseName,
    bodyPart: form.bodyPart,
    variant: form.variant.trim(),
    side: form.side,
    weight: Number(form.weight) || 0,
    reps: Number(form.reps) || 0,
    setIndex: index + 1,
    qualityScore: Number(form.qualityScore) || 3,
    qualityTags: [...form.qualityTags],
    note: form.note.trim(),
  }));
}

async function addWorkout() {
  if (isSavingWorkout.value) return;
  isSavingWorkout.value = true;
  appError.value = '';
  const now = new Date().toISOString();
  const exerciseName = form.customExercise.trim() || selectedExercise.value?.name || '未命名动作';
  const exerciseId = form.customExercise.trim() ? createId('custom_ex') : form.exerciseId;
  const session: WorkoutSession = {
    id: createId('session'),
    date: form.date,
    title: `${form.bodyPart} - ${exerciseName}`,
    bodyPart: form.bodyPart,
    sets: buildSets(exerciseName, exerciseId),
    note: form.note.trim(),
    source: 'manual',
    readonly: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await saveSession(session);
    sessions.value = await getAll<WorkoutSession>('sessions');
    selectedTrendExercise.value = exerciseName;
    syncMessage.value = '已保存到本地，等待后台同步。';
    form.note = '';
    form.qualityTags = [];
  } catch (error) {
    appError.value = error instanceof Error ? `保存训练失败：${error.message}` : '保存训练失败，原有记录不会被清空。';
  } finally {
    isSavingWorkout.value = false;
  }
}

async function importMarkdownFile(event: Event) {
  if (isImportingHistory.value) return;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  isImportingHistory.value = true;
  appError.value = '';
  try {
    const rawText = await file.text();
    const entries = parseHistoryMarkdown(rawText);
    const now = new Date().toISOString();
    const historyImport: HistoryImport = {
      id: createId('import'),
      fileName: file.name,
      importedAt: now,
      rawText,
      entries,
    };
    await saveHistoryImport(historyImport);
    historyImports.value = await getAll<HistoryImport>('historyImports');
    syncMessage.value = `已导入 ${entries.length} 条只读历史线索。`;
  } catch (error) {
    appError.value = error instanceof Error ? `导入历史失败：${error.message}` : '导入历史失败，已有历史不会被覆盖。';
  } finally {
    isImportingHistory.value = false;
    input.value = '';
  }
}

async function importPlanFile(event: Event) {
  if (isImportingPlan.value) return;
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  isImportingPlan.value = true;
  appError.value = '';
  try {
    if (!isSupportedPlanFileName(file.name)) {
      throw new Error('请选择 Markdown 或纯文本文件。');
    }
    const rawMarkdown = await file.text();
    if (!rawMarkdown.trim()) {
      throw new Error('文件内容为空，未导入。');
    }
    const now = new Date().toISOString();
    const plan: TrainingPlan = {
      id: createId('plan'),
      title: getPlanTitle(file.name, rawMarkdown),
      fileName: file.name,
      rawMarkdown,
      importedAt: now,
      updatedAt: now,
    };
    await saveTrainingPlan(plan);
    trainingPlans.value = await getAll<TrainingPlan>('trainingPlans');
    selectedPlanId.value = plan.id;
    syncMessage.value = `已导入计划：${plan.title}`;
  } catch (error) {
    appError.value = error instanceof Error ? `导入计划失败：${error.message}` : '导入计划失败，已有计划不会被覆盖。';
  } finally {
    isImportingPlan.value = false;
    input.value = '';
  }
}

async function syncNow() {
  syncMessage.value = '正在同步...';
  try {
    const result = await syncPendingChanges();
    syncMessage.value = result.message;
    sessions.value = await getAll<WorkoutSession>('sessions');
  } catch (error) {
    syncMessage.value = error instanceof Error ? error.message : '同步失败，待下次重试。';
  }
}

function formatVolume(value: number) {
  return Math.round(value).toLocaleString('zh-CN');
}

onMounted(loadData);
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">个人训练记录</p>
        <h1>粉粉训练</h1>
      </div>
      <div class="sync-pill" :class="{ active: isCloudBaseConfigured() }">
        {{ isCloudBaseConfigured() ? '云同步' : '本地' }}
      </div>
    </header>

    <p v-if="appError" class="error-banner" role="alert">{{ appError }}</p>

    <section v-if="activeTab === 'today'" class="screen">
      <div class="hero-band">
        <div>
          <p class="eyebrow">今天练什么</p>
          <h2>快速记一组</h2>
        </div>
        <span>{{ form.date }}</span>
      </div>

      <form class="panel form-grid" @submit.prevent="addWorkout">
        <label>
          日期
          <input v-model="form.date" type="date" />
        </label>

        <label>
          部位
          <select v-model="form.bodyPart" @change="form.exerciseId = filteredExercises[0]?.id || ''">
            <option v-for="part in bodyParts" :key="part" :value="part">{{ part }}</option>
          </select>
        </label>

        <label>
          动作
          <select v-model="form.exerciseId">
            <option v-for="exercise in filteredExercises" :key="exercise.id" :value="exercise.id">{{ exercise.name }}</option>
          </select>
        </label>

        <label>
          临时动作
          <input v-model="form.customExercise" placeholder="没有就留空" />
        </label>

        <label>
          变式/器械
          <input v-model="form.variant" placeholder="如 宽握、红色器械" />
        </label>

        <label>
          左右侧
          <select v-model="form.side">
            <option v-for="side in sides" :key="side" :value="side">{{ side }}</option>
          </select>
        </label>

        <div class="number-row">
          <label>
            重量 kg
            <input v-model.number="form.weight" type="number" min="0" step="0.25" />
          </label>
          <label>
            次数
            <input v-model.number="form.reps" type="number" min="0" step="1" />
          </label>
          <label>
            组数
            <input v-model.number="form.setCount" type="number" min="1" max="10" step="1" />
          </label>
        </div>

        <label>
          动作质量 {{ form.qualityScore }}/5
          <input v-model.number="form.qualityScore" type="range" min="1" max="5" step="1" />
        </label>

        <div class="tag-cloud" aria-label="动作质量标签">
          <button
            v-for="tag in qualityTags"
            :key="tag"
            type="button"
            class="tag"
            :class="{ selected: form.qualityTags.includes(tag) }"
            @click="toggleQualityTag(tag)"
          >
            {{ tag }}
          </button>
        </div>

        <label>
          备注
          <textarea v-model="form.note" rows="3" placeholder="比如：左边弱、斜方代偿、第三组开始有感觉"></textarea>
        </label>

        <button class="primary-button" type="submit" :disabled="isSavingWorkout">
          {{ isSavingWorkout ? '保存中...' : '保存训练' }}
        </button>
      </form>
    </section>

    <section v-if="activeTab === 'history'" class="screen">
      <div class="section-title">
        <div>
          <p class="eyebrow">History</p>
          <h2>训练历史</h2>
        </div>
        <span>{{ manualSessions.length }} 次</span>
      </div>

      <article v-for="session in manualSessions" :key="session.id" class="record-card">
        <div class="record-head">
          <div>
            <strong>{{ session.title }}</strong>
            <p>{{ session.date }} · {{ session.sets.length }} 组</p>
          </div>
          <span>{{ formatVolume(session.sets.reduce((sum, set) => sum + setVolume(set.weight, set.reps), 0)) }}</span>
        </div>
        <div class="set-list">
          <span v-for="set in session.sets" :key="set.id">
            {{ set.weight }}kg × {{ set.reps }}
          </span>
        </div>
        <p v-if="session.note" class="muted">{{ session.note }}</p>
      </article>

      <div v-if="!manualSessions.length" class="empty-state">还没有结构化训练记录，先从“今日”保存一次。</div>
    </section>

    <section v-if="activeTab === 'plans'" class="screen">
      <div class="section-title">
        <div>
          <p class="eyebrow">Plan</p>
          <h2>训练计划</h2>
        </div>
        <span>{{ trainingPlans.length }} 个</span>
      </div>

      <div class="panel plan-tools">
        <label v-if="trainingPlans.length">
          选择计划
          <select v-model="selectedPlanId">
            <option v-for="plan in sortedTrainingPlans" :key="plan.id" :value="plan.id">{{ plan.title }}</option>
          </select>
        </label>
        <label class="file-button">
          {{ isImportingPlan ? '导入中...' : '导入 Markdown 计划' }}
          <input type="file" accept=".md,.MD,.markdown,.txt,text/markdown,text/plain" :disabled="isImportingPlan" @change="importPlanFile" />
        </label>
        <p class="muted">可以导入你的肩胸、背部等训练计划 md，页面会按标题、列表、表格和引用块展示。</p>
      </div>

      <article v-if="selectedPlan" class="plan-view">
        <div class="plan-meta">
          <div>
            <p class="eyebrow">Markdown</p>
            <h3>{{ selectedPlan.title }}</h3>
          </div>
          <span>{{ selectedPlan.fileName }}</span>
        </div>
        <div class="markdown-body" v-html="renderedPlan"></div>
      </article>

      <div v-else class="empty-state">还没有训练计划，先导入一个 Markdown 文件。</div>
    </section>

    <section v-if="activeTab === 'trends'" class="screen">
      <div class="section-title">
        <div>
          <p class="eyebrow">Progression</p>
          <h2>单动作趋势</h2>
        </div>
      </div>

      <div class="panel form-grid">
        <label>
          动作
          <select v-model="selectedTrendExercise">
            <option value="">选择动作</option>
            <option v-for="name in trendExerciseNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <label>
          变式筛选
          <input v-model="selectedTrendVariant" placeholder="留空看全部变式" />
        </label>
        <label>
          左右侧筛选
          <select v-model="selectedTrendSide">
            <option value="">全部</option>
            <option v-for="side in sides" :key="side" :value="side">{{ side }}</option>
          </select>
        </label>
      </div>

      <article class="analysis-card" :class="progression.status">
        <p class="eyebrow">渐进超负荷</p>
        <h3>{{ progression.title }}</h3>
        <p>{{ progression.detail }}</p>
      </article>

      <div class="chart-panel">
        <div v-for="point in trendPoints" :key="point.sessionId" class="bar-row">
          <span>{{ point.date.slice(5) }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: `${Math.max(8, (point.totalVolume / trendMaxVolume) * 100)}%` }"></div>
          </div>
          <strong>{{ formatVolume(point.totalVolume) }}</strong>
        </div>
        <div v-if="!trendPoints.length" class="empty-state">选择一个已有动作后，这里会显示容量趋势。</div>
      </div>

      <article v-for="point in trendPoints.slice().reverse()" :key="`${point.sessionId}-detail`" class="record-card compact">
        <div class="record-head">
          <div>
            <strong>{{ point.date }}</strong>
            <p>最佳 {{ point.bestWeight }}kg × {{ point.bestReps }} · {{ point.setCount }} 组</p>
          </div>
          <span :class="{ warning: point.blockedByQuality }">{{ point.blockedByQuality ? '质量提醒' : 'OK' }}</span>
        </div>
        <p v-if="point.note" class="muted">{{ point.note }}</p>
      </article>
    </section>

    <section v-if="activeTab === 'settings'" class="screen">
      <div class="section-title">
        <div>
          <p class="eyebrow">Settings</p>
          <h2>设置与导入</h2>
        </div>
      </div>

      <div class="panel">
        <h3>同步状态</h3>
        <p class="muted">{{ syncMessage }}</p>
        <p class="muted">CloudBase：{{ isCloudBaseConfigured() ? '已读取环境变量' : '未配置，当前纯本地可用' }}</p>
        <button class="secondary-button" type="button" @click="syncNow">立即同步</button>
      </div>

      <div class="panel">
        <h3>导入历史 md</h3>
        <p class="muted">导入后作为只读历史线索保存，解析不准的内容会保留原文。</p>
        <label class="file-button">
          选择 Markdown 文件
          <input type="file" accept=".md,.MD,.markdown,.txt,text/markdown,text/plain" :disabled="isImportingHistory" @change="importMarkdownFile" />
        </label>
        <p class="muted">已导入 {{ historyImports.length }} 个文件，{{ importedEntryCount }} 条线索。</p>
      </div>

      <div v-if="latestImported" class="panel">
        <h3>最近导入</h3>
        <p class="muted">{{ latestImported.fileName }} · {{ latestImported.entries.length }} 条</p>
        <div class="import-list">
          <p v-for="entry in latestImported.entries.slice(0, 8)" :key="entry.id">
            <strong>{{ entry.date }} {{ entry.bodyPart }}</strong>
            {{ entry.exerciseName }}：{{ entry.rawText }}
          </p>
        </div>
      </div>
    </section>

    <nav class="bottom-nav" aria-label="主导航">
      <button :class="{ selected: activeTab === 'today' }" @click="activeTab = 'today'">
        <span>＋</span>
        今日
      </button>
      <button :class="{ selected: activeTab === 'history' }" @click="activeTab = 'history'">
        <span>□</span>
        历史
      </button>
      <button :class="{ selected: activeTab === 'plans' }" @click="activeTab = 'plans'">
        <span>◇</span>
        计划
      </button>
      <button :class="{ selected: activeTab === 'trends' }" @click="activeTab = 'trends'">
        <span>⌁</span>
        趋势
      </button>
      <button :class="{ selected: activeTab === 'settings' }" @click="activeTab = 'settings'">
        <span>⚙</span>
        设置
      </button>
    </nav>
  </main>
</template>
