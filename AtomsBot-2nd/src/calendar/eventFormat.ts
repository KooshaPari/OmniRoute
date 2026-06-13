import { EmbedBuilder, ButtonStyle } from 'discord.js';
import { getConferenceLink } from './conference';

export function parseLinksFromDescription(description?: string | null): { notes?: string; recording?: string } {
  const res: { notes?: string; recording?: string } = {};
  if (!description) return res;
  const lines = description.split(/\r?\n/);
  for (const ln of lines) {
    const m1 = ln.match(/\bnotes?:\s*(https?:\/\/\S+)/i);
    if (m1) res.notes = m1[1];
    const m2 = ln.match(/\brecording:?\s*(https?:\/\/\S+)/i);
    if (m2) res.recording = m2[1];
  }
  return res;
}

export function buildEventEmbed(event: any) {
  const eb = new EmbedBuilder();
  const title = event.summary || '(No title)';
  const link = getConferenceLink(event) || event.htmlLink || undefined;
  const { notes, recording } = parseLinksFromDescription(event.description);
  eb.setTitle(title).setColor(0x3b82f6).setTimestamp(new Date(event.updated || Date.now()));
  if (event.htmlLink) eb.setURL(event.htmlLink);
  const when = fmtTimeRange(event);
  const descParts = [when];
  if (notes) descParts.push(`Notes: ${notes}`);
  if (recording) descParts.push(`Recording: ${recording}`);
  if (!notes && !recording && event.description) {
    descParts.push(event.description.slice(0, 500));
  }
  eb.setDescription(descParts.filter(Boolean).join('\n'));
  const actions: Array<{ label: string; url?: string; customId?: string; style?: ButtonStyle }> = [];
  if (link) actions.push({ label: 'Join', url: link, style: ButtonStyle.Link });
  if (event.htmlLink) actions.push({ label: 'Open in Calendar', url: event.htmlLink, style: ButtonStyle.Link });
  return { embed: eb, actions };
}

function fmtTimeRange(e: any) {
  const s = getDate(e.start?.dateTime || e.start?.date);
  const en = getDate(e.end?.dateTime || e.end?.date);
  if (!s || !en) return 'Time TBA';
  const pad = (n: number) => String(n).padStart(2, '0');
  const sH = pad(s.getHours()); const sM = pad(s.getMinutes());
  const eH = pad(en.getHours()); const eM = pad(en.getMinutes());
  const day = `${s.getMonth() + 1}/${s.getDate()}`;
  return `${day} ${sH}:${sM}-${eH}:${eM}`;
}
function getDate(s?: string | null) {
  if (!s) return undefined;
  if (s.length === 10) return new Date(s + 'T00:00:00');
  return new Date(s);
}

