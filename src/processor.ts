import * as vscode from "vscode";
import * as fs from "fs";
import { CATEGORIES, Category, CATEGORY_PRIORITY, ParsedDoc, TaskFamily } from "./types";
import { TodoMeta } from "./types";
import { parseDoc, serializeDoc } from "./parser";
import {
  hasCreatedTag,
  appendCreatedTag,
  hasDoneTag,
  hasObeTag,
  hasPromoTag,
  getPromoTag,
  hasStatusTag,
  hasStaleTag,
  setStaleTag,
  removeStaleTag,
  applyPromoResult,
  stableKey,
  today,
} from "./tags";
import { archiveFamily } from "./archive";
import { loadMeta, saveMeta, daysSinceModified, updateLastModified, getOrCreateEntry } from "./meta";

export function processTodoFile(filePath: string, log: vscode.OutputChannel): string | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    log.appendLine(`[error] Could not read file: ${e}`);
    return null;
  }

  const meta = loadMeta(filePath);
  let doc: ParsedDoc;
  try {
    doc = parseDoc(raw);
  } catch (e) {
    log.appendLine(`[error] Parse failed: ${e}`);
    return null;
  }

  // Step 1: Creation Date Tagging
  step1_creationDate(doc, meta);

  // Step 2: Archival (DONE//)
  step2_archive(doc, meta, filePath, log);

  // Step 3: Silent Deletion (OBE//)
  step3_obe(doc, log);

  // Step 4: Promotion / Demotion
  step4_promo(doc, meta, log);

  // Step 5: Stale Tagging
  step5_stale(doc, meta);

  // Step 6: Sorting
  step6_sort(doc);

  // Serialize — caller writes back via VS Code API to avoid file-lock conflict
  const output = serializeDoc(doc);

  // Step 7: Update meta after all mutations
  saveMeta(filePath, meta);
  log.appendLine(`[info] Processed ${filePath}`);
  return output;
}

// ---------------------------------------------------------------------------
// Step 1
// ---------------------------------------------------------------------------
function step1_creationDate(doc: ParsedDoc, meta: TodoMeta): void {
  const dateStr = today();
  for (const cat of CATEGORIES) {
    for (const family of doc.sections[cat]) {
      if (!hasCreatedTag(family.parent)) {
        family.parent = appendCreatedTag(family.parent, dateStr);
        updateLastModified(meta, family.parent);
      } else {
        getOrCreateEntry(meta, family.parent);
      }
      for (let i = 0; i < family.subtasks.length; i++) {
        if (!hasCreatedTag(family.subtasks[i])) {
          family.subtasks[i] = appendCreatedTag(family.subtasks[i], dateStr);
          updateLastModified(meta, family.subtasks[i]);
        } else {
          getOrCreateEntry(meta, family.subtasks[i]);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step 2
// ---------------------------------------------------------------------------
function step2_archive(doc: ParsedDoc, meta: TodoMeta, filePath: string, log: vscode.OutputChannel): void {
  for (const cat of CATEGORIES) {
    const remaining: TaskFamily[] = [];
    for (const family of doc.sections[cat]) {
      if (hasDoneTag(family.parent)) {
        try {
          archiveFamily(filePath, family, cat);
          log.appendLine(`[archive] Archived: ${family.parent.trim()}`);
        } catch (e) {
          log.appendLine(`[error] Archive failed for "${family.parent.trim()}": ${e}`);
          remaining.push(family);
        }
        // Remove from meta
        pruneMetaFamily(meta, family);
      } else {
        remaining.push(family);
      }
    }
    doc.sections[cat] = remaining;
  }
}

function pruneMetaFamily(meta: TodoMeta, family: TaskFamily): void {
  const keys = [family.parent, ...family.subtasks].map(stableKey);
  for (const k of keys) {
    delete meta.tasks[k];
  }
}

// ---------------------------------------------------------------------------
// Step 3
// ---------------------------------------------------------------------------
function step3_obe(doc: ParsedDoc, log: vscode.OutputChannel): void {
  for (const cat of CATEGORIES) {
    doc.sections[cat] = doc.sections[cat].filter(family => {
      if (hasObeTag(family.parent)) {
        log.appendLine(`[obe] Deleted: ${family.parent.trim()}`);
        return false;
      }
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Step 4
// ---------------------------------------------------------------------------
function step4_promo(doc: ParsedDoc, meta: TodoMeta, log: vscode.OutputChannel): void {
  for (const cat of CATEGORIES) {
    const remaining: TaskFamily[] = [];
    for (const family of doc.sections[cat]) {
      const promoTag = getPromoTag(family.parent);
      if (promoTag === null) {
        remaining.push(family);
        continue;
      }
      const destCatIndex = parseInt(promoTag === "99" ? "3" : promoTag, 10);
      const destCat = CATEGORIES[destCatIndex];
      const srcPriority = CATEGORY_PRIORITY[cat];
      const dstPriority = CATEGORY_PRIORITY[destCat];

      if (srcPriority === dstPriority) {
        // Same category: strip tag only
        family.parent = family.parent.replace(/^(\s*)(0|1|2|99)\/\/\s*/, "$1");
        remaining.push(family);
      } else {
        const direction = dstPriority < srcPriority ? "upgraded" : "downgraded";
        family.parent = applyPromoResult(family.parent, direction);
        doc.sections[destCat].push(family);
        updateLastModified(meta, family.parent);
        log.appendLine(`[promo] Moved "${family.parent.trim()}" from ${cat} to ${destCat} (${direction})`);
      }
    }
    doc.sections[cat] = remaining;
  }
}

// ---------------------------------------------------------------------------
// Step 5
// ---------------------------------------------------------------------------
function step5_stale(doc: ParsedDoc, meta: TodoMeta): void {
  const exempt: Category[] = ["Backlog"];
  for (const cat of CATEGORIES) {
    if (exempt.includes(cat)) { continue; }
    for (const family of doc.sections[cat]) {
      if (hasDoneTag(family.parent) || hasObeTag(family.parent)) { continue; }
      const days = daysSinceModified(meta, family.parent, family.subtasks);
      if (days >= 7) {
        family.parent = setStaleTag(family.parent, days);
      } else {
        if (hasStaleTag(family.parent)) {
          family.parent = removeStaleTag(family.parent);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Step 6
// ---------------------------------------------------------------------------
function taskSortKey(family: TaskFamily): number {
  // 0 = has status tag (bubbles to top), 1 = untagged, 2 = stale
  if (hasStaleTag(family.parent)) { return 2; }
  if (hasStatusTag(family.parent)) { return 0; }
  return 1;
}

function step6_sort(doc: ParsedDoc): void {
  for (const cat of CATEGORIES) {
    doc.sections[cat].sort((a, b) => taskSortKey(a) - taskSortKey(b));
  }
}
