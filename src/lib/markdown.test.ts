import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('markdown renderer', () => {
  it('renders common markdown structures', () => {
    const html = renderMarkdown(`# 计划\n\n> 目标：变强\n\n- 动作一\n- 动作二\n\n1. 第一步\n2. 第二步\n\n| 动作 | 次数 |\n|---|---:|\n| 推肩 | \`8-12\` |`);

    expect(html).toContain('<h1>计划</h1>');
    expect(html).toContain('<blockquote>目标：变强</blockquote>');
    expect(html).toContain('<ul><li>动作一</li><li>动作二</li></ul>');
    expect(html).toContain('<ol><li>第一步</li><li>第二步</li></ol>');
    expect(html).toContain('<table>');
    expect(html).toContain('<code>8-12</code>');
  });

  it('escapes embedded html, scripts and event handlers', () => {
    const html = renderMarkdown(`# <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n- <button onclick="bad()">x</button>`);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onclick=');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;button onclick&#061;&quot;bad()&quot;&gt;x&lt;/button&gt;');
  });

  it('keeps dangerous urls inert because links are not converted to anchors', () => {
    const html = renderMarkdown('[点我](javascript:alert(1))');

    expect(html).not.toContain('<a');
    expect(html).toContain('javascript:alert(1)');
  });

  it('handles empty and incomplete markdown safely', () => {
    expect(renderMarkdown('   \n\n')).toBe('');
    expect(renderMarkdown('| 未完成 | 表格')).toContain('<p>| 未完成 | 表格</p>');
  });
});
