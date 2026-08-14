export function createId(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
