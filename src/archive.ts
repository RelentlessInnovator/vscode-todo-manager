import * as fs from "fs";
import * as path from "path";
import { Category } from "./types";
import { TaskFamily } from "./types";
import { appendCompletedTag, nowDatetime, today } from "./tags";

function archivePath(todoFilePath: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return path.join(path.dirname(todoFilePath), `archive-${yyyy}-${mm}.md`);
}

/**
 * Archive format: purely chronological, one `## YYYY-MM-DD` heading per day.
 * Most-recent day is at the top of the file; entries within a day are
 * appended in the order they were archived.
 */
export function archiveFamily(
  todoFilePath: string,
  family: TaskFamily,
  _category: Category   // no longer used in output, kept for call-site compat
): void {
  const ap = archivePath(todoFilePath);
  const todayStr = today();
  const dayHeading = `## ${todayStr}`;

  // Strip DONE// / D// from parent and every subtask, then stamp all lines.
  const datetime = nowDatetime();
  const stripDone = (line: string) => line.replace(/^(\s*)(DONE|D)\/\/\s*/i, "$1");
  const archivedParent = appendCompletedTag(stripDone(family.parent), datetime);
  const archivedSubtasks = family.subtasks.map(s => appendCompletedTag(stripDone(s), datetime));
  const block = [archivedParent, ...archivedSubtasks];

  // ── New archive file ────────────────────────────────────────────────────────
  if (!fs.existsSync(ap)) {
    const content = [dayHeading, "", ...block, ""].join("\n");
    fs.writeFileSync(ap, content, "utf8");
    return;
  }

  // ── Existing archive file ───────────────────────────────────────────────────
  const raw = fs.readFileSync(ap, "utf8");
  const lines = raw.split(/\r?\n/);

  const headingIdx = lines.findIndex(l => l.trim() === dayHeading);

  if (headingIdx !== -1) {
    // Today's section already exists — append after its last entry (before the
    // next day-heading or end-of-file), stripping any trailing blank lines
    // first so spacing stays clean.
    let insertAt = headingIdx + 1;
    while (insertAt < lines.length && !lines[insertAt].match(/^##\s+/)) {
      insertAt++;
    }
    while (insertAt > 0 && lines[insertAt - 1].trim() === "") {
      insertAt--;
    }
    lines.splice(insertAt, 0, "", ...block);
  } else {
    // No entry for today yet — prepend a new day section at the very top.
    lines.unshift(dayHeading, "", ...block, "");
  }

  const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  fs.writeFileSync(ap, cleaned, "utf8");
}
