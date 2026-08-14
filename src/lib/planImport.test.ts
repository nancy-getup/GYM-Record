import { describe, expect, it } from 'vitest';
import { getPlanTitle, isSupportedPlanFileName } from './planImport';

describe('plan import helpers', () => {
  it('accepts markdown and text file names case-insensitively', () => {
    expect(isSupportedPlanFileName('肩胸训练计划.md')).toBe(true);
    expect(isSupportedPlanFileName('背部训练计划.MD')).toBe(true);
    expect(isSupportedPlanFileName('plan.markdown')).toBe(true);
    expect(isSupportedPlanFileName('notes.txt')).toBe(true);
    expect(isSupportedPlanFileName('image.png')).toBe(false);
  });

  it('extracts the first h1 as plan title', () => {
    expect(getPlanTitle('plan.md', '# 肩胸训练计划\n正文')).toBe('肩胸训练计划');
    expect(getPlanTitle('plan.md', '没有标题')).toBe('plan');
  });
});
