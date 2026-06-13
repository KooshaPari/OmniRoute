export function formatProviderComment(userTag: string | undefined, text: string): string {
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}`;
  const user = userTag ? `@${userTag}` : 'system';
  return `[${stamp}] ${user}: ${text}`;
}

