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
exports.archiveFamily = archiveFamily;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tags_1 = require("./tags");
function archivePath(todoFilePath) {
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
function archiveFamily(todoFilePath, family, _category // no longer used in output, kept for call-site compat
) {
    const ap = archivePath(todoFilePath);
    const todayStr = (0, tags_1.today)();
    const dayHeading = `## ${todayStr}`;
    // Strip DONE// / D// from parent and every subtask, then stamp all lines.
    const datetime = (0, tags_1.nowDatetime)();
    const stripDone = (line) => line.replace(/^(\s*)(DONE|D)\/\/\s*/i, "$1");
    const archivedParent = (0, tags_1.appendCompletedTag)(stripDone(family.parent), datetime);
    const archivedSubtasks = family.subtasks.map(s => (0, tags_1.appendCompletedTag)(stripDone(s), datetime));
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
    }
    else {
        // No entry for today yet — prepend a new day section at the very top.
        lines.unshift(dayHeading, "", ...block, "");
    }
    const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    fs.writeFileSync(ap, cleaned, "utf8");
}
//# sourceMappingURL=archive.js.map