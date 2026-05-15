export function uid(prefix = ''): string {
  const rnd = Math.random().toString(36).slice(2, 9);
  const t = Date.now().toString(36);
  return `${prefix}${prefix ? '_' : ''}${t}${rnd}`;
}
