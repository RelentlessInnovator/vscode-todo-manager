/** All tag manipulation utilities. */

const DATE_RE = /\s*\[created:\s*\d{4}-\d{2}-\d{2}\]/gi;
const COMPLETED_RE = /\s*\[completed:[^\]]*\]/gi;
const STATUS_TAG_RE = /^([A-Z][A-Z0-9 _-]*?\/\/)/i;
const DONE_RE = /^(DONE|D)\/\//i;
const OBE_RE = /^(OBE|O)\/\//i;
const PROMO_RE = /^(0|1|2|99)\/\//;
const STALE_RE = /^STALE(\d+)\/\//i;
const UPGRADED_RE = /\s*-\s*(upgraded|downgraded)\s*$/i;

export function hasCreatedTag(line: string): boolean {
  return /\[created:\s*\d{4}-\d{2}-\d{2}\]/i.test(line);
}

export function appendCreatedTag(line: string, date: string): string {
  return `${line.trimEnd()} [created: ${date}]`;
}

export function appendCompletedTag(line: string, datetime: string): string {
  return `${line.trimEnd()} [completed: ${datetime}]`;
}

export function hasDoneTag(line: string): boolean {
  return DONE_RE.test(taskText(line));
}

export function hasObeTag(line: string): boolean {
  return OBE_RE.test(taskText(line));
}

export function hasPromoTag(line: string): boolean {
  return PROMO_RE.test(taskText(line));
}

export function getPromoTag(line: string): string | null {
  const m = taskText(line).match(PROMO_RE);
  return m ? m[1] : null;
}

export function hasStaleTag(line: string): boolean {
  return STALE_RE.test(taskText(line));
}

export function getStaleTag(line: string): { days: number } | null {
  const m = taskText(line).match(STALE_RE);
  return m ? { days: parseInt(m[1], 10) } : null;
}

export function hasStatusTag(line: string): boolean {
  const text = taskText(line);
  // status tag = any XYZ// that is NOT done/obe/promo/stale
  if (DONE_RE.test(text)) { return false; }
  if (OBE_RE.test(text)) { return false; }
  if (PROMO_RE.test(text)) { return false; }
  if (STALE_RE.test(text)) { return false; }
  return STATUS_TAG_RE.test(text);
}

/** Returns the indent prefix of a line. */
export function getIndent(line: string): string {
  const m = line.match(/^(\s*)/);
  return m ? m[1] : "";
}

/** Returns the task text after stripping indent. */
export function taskText(line: string): string {
  return line.trimStart();
}

/** Strip all managed prepend tags from the task text portion of a line. */
export function stripPrependTags(line: string): string {
  const indent = getIndent(line);
  let text = taskText(line);
  // Strip done/obe/promo/stale tags (loop to handle multiples)
  let prev = "";
  while (prev !== text) {
    prev = text;
    text = text.replace(/^(DONE|D|OBE|O|0|1|2|99|STALE\d*)\/\//i, "").trimStart();
  }
  return indent + text;
}

/** Strip all tags (prepend and append) to get stable key. */
export function stableKey(line: string): string {
  let text = taskText(line);
  // Remove all prepend tags
  let prev = "";
  while (prev !== text) {
    prev = text;
    text = text.replace(/^[A-Z][A-Z0-9 _-]*?\/\//i, "").trimStart();
  }
  // Remove created/completed append tags
  text = text.replace(DATE_RE, "");
  text = text.replace(COMPLETED_RE, "");
  // Remove upgraded/downgraded suffix
  text = text.replace(UPGRADED_RE, "");
  return text.trim();
}

/** Replace or prepend the STALE tag on the task text portion. */
export function setStaleTag(line: string, days: number): string {
  const indent = getIndent(line);
  let text = taskText(line);
  // Remove existing STALE tag first
  text = text.replace(/^STALE\d*\/\//i, "").trimStart();
  return `${indent}STALE${days}//${text}`;
}

/** Remove STALE tag from a line. */
export function removeStaleTag(line: string): string {
  const indent = getIndent(line);
  let text = taskText(line);
  text = text.replace(/^STALE\d*\/\//i, "").trimStart();
  return indent + text;
}

/** Replace promo tag with upgraded/downgraded suffix on the parent line. */
export function applyPromoResult(line: string, direction: "upgraded" | "downgraded"): string {
  const indent = getIndent(line);
  let text = taskText(line);
  // Remove promo tag
  text = text.replace(/^(0|1|2|99)\/\//, "").trimStart();
  // Remove any existing upgraded/downgraded
  text = text.replace(UPGRADED_RE, "").trimEnd();
  return `${indent}${text} - ${direction}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowDatetime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  then.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / 86400000);
}
