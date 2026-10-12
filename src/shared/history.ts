/** The last few dictations, kept on this computer only (tray menu → copy). */

export const HISTORY_SIZE = 10;

export interface HistoryEntry {
  text: string;
  /** ISO timestamp. */
  at: string;
}

/** Newest first; an identical repeat of the newest entry isn't added twice. */
export function addToHistory(list: HistoryEntry[], text: string, at: Date, max = HISTORY_SIZE): HistoryEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return list;
  if (list[0]?.text === trimmed) return list;
  return [{ text: trimmed, at: at.toISOString() }, ...list].slice(0, max);
}

/** Menu label: time and the first words, on one line. */
export function historyLabel(entry: HistoryEntry, now: Date, maxChars = 48): string {
  const at = new Date(entry.at);
  const sameDay = at.toDateString() === now.toDateString();
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const when = sameDay ? time : `${at.getDate()}-${at.getMonth() + 1} ${time}`;
  const oneLine = entry.text.replace(/\s+/g, ' ');
  const snippet = oneLine.length > maxChars ? `${oneLine.slice(0, maxChars - 1).trimEnd()}…` : oneLine;
  return `${when}  ${snippet}`;
}

export function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is HistoryEntry => typeof e?.text === 'string' && typeof e?.at === 'string')
    .slice(0, HISTORY_SIZE);
}
