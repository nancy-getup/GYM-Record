export function isSupportedPlanFileName(fileName: string) {
  return /\.(md|markdown|txt)$/i.test(fileName);
}

export function getPlanTitle(fileName: string, markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fileName.replace(/\.[^.]+$/, '');
}
