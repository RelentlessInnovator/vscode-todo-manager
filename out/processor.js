"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTodoFile = processTodoFile;
const fs = __importStar(require("fs"));
const types_1 = require("./types");
const parser_1 = require("./parser");
const tags_1 = require("./tags");
const archive_1 = require("./archive");
const meta_1 = require("./meta");
function processTodoFile(filePath, log) {
    let raw;
    try {
        raw = fs.readFileSync(filePath, "utf8");
    }
    catch (e) {
        log.appendLine(`[error] Could not read file: ${e}`);
        return null;
    }
    const meta = (0, meta_1.loadMeta)(filePath);
    let doc;
    try {
        doc = (0, parser_1.parseDoc)(raw);
    }
    catch (e) {
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
    const output = (0, parser_1.serializeDoc)(doc);
    // Step 7: Update meta after all mutations
    (0, meta_1.saveMeta)(filePath, meta);
    log.appendLine(`[info] Processed ${filePath}`);
    return output;
}
// ---------------------------------------------------------------------------
// Step 1
// ---------------------------------------------------------------------------
function step1_creationDate(doc, meta) {
    const dateStr = (0, tags_1.today)();
    for (const cat of types_1.CATEGORIES) {
        for (const family of doc.sections[cat]) {
            if (!(0, tags_1.hasCreatedTag)(family.parent)) {
                family.parent = (0, tags_1.appendCreatedTag)(family.parent, dateStr);
                (0, meta_1.updateLastModified)(meta, family.parent);
            }
            else {
                (0, meta_1.getOrCreateEntry)(meta, family.parent);
            }
            for (let i = 0; i < family.subtasks.length; i++) {
                if (!(0, tags_1.hasCreatedTag)(family.subtasks[i])) {
                    family.subtasks[i] = (0, tags_1.appendCreatedTag)(family.subtasks[i], dateStr);
                    (0, meta_1.updateLastModified)(meta, family.subtasks[i]);
                }
                else {
                    (0, meta_1.getOrCreateEntry)(meta, family.subtasks[i]);
                }
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Step 2
// ---------------------------------------------------------------------------
function step2_archive(doc, meta, filePath, log) {
    for (const cat of types_1.CATEGORIES) {
        const remaining = [];
        for (const family of doc.sections[cat]) {
            if ((0, tags_1.hasDoneTag)(family.parent)) {
                try {
                    (0, archive_1.archiveFamily)(filePath, family, cat);
                    log.appendLine(`[archive] Archived: ${family.parent.trim()}`);
                }
                catch (e) {
                    log.appendLine(`[error] Archive failed for "${family.parent.trim()}": ${e}`);
                    remaining.push(family);
                }
                // Remove from meta
                pruneMetaFamily(meta, family);
            }
            else {
                remaining.push(family);
            }
        }
        doc.sections[cat] = remaining;
    }
}
function pruneMetaFamily(meta, family) {
    const keys = [family.parent, ...family.subtasks].map(tags_1.stableKey);
    for (const k of keys) {
        delete meta.tasks[k];
    }
}
// ---------------------------------------------------------------------------
// Step 3
// ---------------------------------------------------------------------------
function step3_obe(doc, log) {
    for (const cat of types_1.CATEGORIES) {
        doc.sections[cat] = doc.sections[cat].filter(family => {
            if ((0, tags_1.hasObeTag)(family.parent)) {
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
function step4_promo(doc, meta, log) {
    for (const cat of types_1.CATEGORIES) {
        const remaining = [];
        for (const family of doc.sections[cat]) {
            const promoTag = (0, tags_1.getPromoTag)(family.parent);
            if (promoTag === null) {
                remaining.push(family);
                continue;
            }
            const destCatIndex = parseInt(promoTag === "99" ? "3" : promoTag, 10);
            const destCat = types_1.CATEGORIES[destCatIndex];
            const srcPriority = types_1.CATEGORY_PRIORITY[cat];
            const dstPriority = types_1.CATEGORY_PRIORITY[destCat];
            if (srcPriority === dstPriority) {
                // Same category: strip tag only
                family.parent = family.parent.replace(/^(\s*)(0|1|2|99)\/\/\s*/, "$1");
                remaining.push(family);
            }
            else {
                const direction = dstPriority < srcPriority ? "upgraded" : "downgraded";
                family.parent = (0, tags_1.applyPromoResult)(family.parent, direction);
                doc.sections[destCat].push(family);
                (0, meta_1.updateLastModified)(meta, family.parent);
                log.appendLine(`[promo] Moved "${family.parent.trim()}" from ${cat} to ${destCat} (${direction})`);
            }
        }
        doc.sections[cat] = remaining;
    }
}
// ---------------------------------------------------------------------------
// Step 5
// ---------------------------------------------------------------------------
function step5_stale(doc, meta) {
    const exempt = ["Backlog"];
    for (const cat of types_1.CATEGORIES) {
        if (exempt.includes(cat)) {
            continue;
        }
        for (const family of doc.sections[cat]) {
            if ((0, tags_1.hasDoneTag)(family.parent) || (0, tags_1.hasObeTag)(family.parent)) {
                continue;
            }
            const days = (0, meta_1.daysSinceModified)(meta, family.parent, family.subtasks);
            if (days >= 7) {
                family.parent = (0, tags_1.setStaleTag)(family.parent, days);
            }
            else {
                if ((0, tags_1.hasStaleTag)(family.parent)) {
                    family.parent = (0, tags_1.removeStaleTag)(family.parent);
                }
            }
        }
    }
}
// ---------------------------------------------------------------------------
// Step 6
// ---------------------------------------------------------------------------
function taskSortKey(family) {
    // 0 = has status tag (bubbles to top), 1 = untagged, 2 = stale
    if ((0, tags_1.hasStaleTag)(family.parent)) {
        return 2;
    }
    if ((0, tags_1.hasStatusTag)(family.parent)) {
        return 0;
    }
    return 1;
}
function step6_sort(doc) {
    for (const cat of types_1.CATEGORIES) {
        doc.sections[cat].sort((a, b) => taskSortKey(a) - taskSortKey(b));
    }
}
//# sourceMappingURL=processor.js.map