import type { BodyPart, ParsedHistoryEntry } from '@/types';
import { createId } from './id';

const bodyPartMap: Record<string, BodyPart> = {
  引体: '引体',
  俯卧撑: '俯卧撑',
  练前热身: '热身',
  热身: '热身',
  肩: '肩',
  手臂: '手臂',
  臀腿: '臀腿',
  髋关节: '髋关节',
  背: '背',
  胸: '胸',
};

function normalizeCell(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function parseMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(normalizeCell);
}

function isSeparatorRow(line: string) {
  return /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function extractNumbers(text: string) {
  const pair = text.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  if (pair) {
    return {
      weight: Number(pair[1]),
      reps: Number(pair[2]),
      confidence: 'high' as const,
    };
  }
  const reps = text.match(/(?:自重|空|悬挂|动态悬挂)?\s*(\d{1,3})(?:\s*[、 ]\s*\d{1,3})*/);
  if (reps) {
    return {
      reps: Number(reps[1]),
      confidence: 'medium' as const,
    };
  }
  return { confidence: 'low' as const };
}

function normalizeBodyPart(heading: string): BodyPart {
  const clean = heading.replace(/^#+\s*/, '').trim();
  const hit = Object.keys(bodyPartMap).find((key) => clean.includes(key));
  return hit ? bodyPartMap[hit] : '其他';
}

function looksLikeDate(value: string) {
  return /^(Test|\d{1,2}\.\d{1,2}|3725|\d{4}-\d{2}-\d{2})$/.test(value.trim());
}

export function parseHistoryMarkdown(rawText: string): ParsedHistoryEntry[] {
  const lines = rawText.split(/\r?\n/);
  const entries: ParsedHistoryEntry[] = [];
  let currentBodyPart: BodyPart = '其他';
  let headers: string[] = [];
  let inFullRecords = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('## 完整训练记录表格')) {
      inFullRecords = true;
      continue;
    }
    if (!inFullRecords) continue;

    if (line.startsWith('### ')) {
      currentBodyPart = normalizeBodyPart(line);
      headers = [];
      continue;
    }
    if (!line.trim().startsWith('|') || isSeparatorRow(line)) continue;

    const cells = parseMarkdownRow(line);
    if (cells[0] === '日期' || cells[0] === '动作' || cells[0] === '类型') {
      headers = cells;
      continue;
    }
    if (!headers.length) continue;

    const date = cells[0];
    if (!looksLikeDate(date) && currentBodyPart !== '热身') continue;

    cells.slice(1).forEach((cell, index) => {
      if (!cell || cell === '-') return;
      const exerciseName = headers[index + 1] || currentBodyPart;
      if (['备注', '备注/来源', '来源'].some((word) => exerciseName.includes(word))) return;
      const numbers = extractNumbers(cell);
      entries.push({
        id: createId('hist'),
        date,
        bodyPart: currentBodyPart,
        exerciseName,
        rawText: cell,
        ...numbers,
      });
    });
  }

  return entries;
}
