import * as fs from "fs";
import * as path from "path";
import { TodoMeta, TaskMetaEntry } from "./types";
import { stableKey, today } from "./tags";

export function metaPath(todoFilePath: string): string {
  return path.join(path.dirname(todoFilePath), "todo-meta.json");
}

export function loadMeta(todoFilePath: string): TodoMeta {
  const p = metaPath(todoFilePath);
  if (!fs.existsSync(p)) {
    return { tasks: {} };
  }
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as TodoMeta;
  } catch {
    return { tasks: {} };
  }
}

export function saveMeta(todoFilePath: string, meta: TodoMeta): void {
  const p = metaPath(todoFilePath);
  fs.writeFileSync(p, JSON.stringify(meta, null, 2), "utf8");
}

export function touchTask(meta: TodoMeta, line: string, forceToday?: boolean): void {
  const key = stableKey(line);
  if (!key) { return; }
  const now = new Date().toISOString();
  const existing = meta.tasks[key];
  if (!existing) {
    meta.tasks[key] = { created: today(), lastModified: now };
  } else if (forceToday) {
    meta.tasks[key] = { ...existing, lastModified: now };
  }
}

export function getOrCreateEntry(meta: TodoMeta, line: string): TaskMetaEntry {
  const key = stableKey(line);
  if (!meta.tasks[key]) {
    const now = new Date().toISOString();
    meta.tasks[key] = { created: today(), lastModified: now };
  }
  return meta.tasks[key];
}

export function updateLastModified(meta: TodoMeta, line: string): void {
  const key = stableKey(line);
  if (!key) { return; }
  const now = new Date().toISOString();
  if (meta.tasks[key]) {
    meta.tasks[key].lastModified = now;
  } else {
    meta.tasks[key] = { created: today(), lastModified: now };
  }
}

/** Days since last modification for a task family (uses most recent across parent+subtasks). */
export function daysSinceModified(meta: TodoMeta, parentLine: string, subtaskLines: string[]): number {
  const allLines = [parentLine, ...subtaskLines];
  let latest = 0;
  for (const l of allLines) {
    const key = stableKey(l);
    if (meta.tasks[key]) {
      const t = new Date(meta.tasks[key].lastModified).getTime();
      if (t > latest) { latest = t; }
    }
  }
  if (latest === 0) { return 0; }
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const then = new Date(latest);
  then.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / 86400000);
}
