"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupIntoFamilies = groupIntoFamilies;
exports.parseDoc = parseDoc;
exports.serializeDoc = serializeDoc;
const types_1 = require("./types");
const tags_1 = require("./tags");
const HEADING_RE = /^#\s+(.+)$/;
function isHeading(line) {
    const m = line.match(HEADING_RE);
    if (!m) {
        return null;
    }
    const name = m[1].trim();
    return types_1.CATEGORIES.includes(name) ? name : null;
}
function isBlank(line) {
    return line.trim() === "";
}
/**
 * Given lines under a single category heading, group them into TaskFamily objects.
 * The "top-level" tasks are detected by finding the minimum indentation among
 * non-blank lines and treating those as parents.
 */
function groupIntoFamilies(lines) {
    // Filter to non-blank lines only to find minimum indent
    const nonBlank = lines.filter(l => !isBlank(l));
    if (nonBlank.length === 0) {
        return [];
    }
    const minIndent = nonBlank.reduce((min, l) => {
        const len = (0, tags_1.getIndent)(l).length;
        return len < min ? len : min;
    }, Infinity);
    const families = [];
    let current = null;
    for (const line of lines) {
        if (isBlank(line)) {
            // blank lines attach to no family; we'll handle them in serialisation
            continue;
        }
        const indentLen = (0, tags_1.getIndent)(line).length;
        if (indentLen === minIndent) {
            // This is a top-level task
            if (current) {
                families.push(current);
            }
            current = { parent: line, subtasks: [], parentIndent: (0, tags_1.getIndent)(line) };
        }
        else {
            // subtask
            if (current) {
                current.subtasks.push(line);
            }
            else {
                // orphan subtask before any parent — treat as new top-level
                current = { parent: line, subtasks: [], parentIndent: (0, tags_1.getIndent)(line) };
            }
        }
    }
    if (current) {
        families.push(current);
    }
    return families;
}
function parseDoc(content) {
    const lines = content.split(/\r?\n/);
    const sections = {
        Urgent: [],
        Important: [],
        Normal: [],
        Backlog: [],
    };
    const preamble = [];
    let currentCategory = null;
    let currentLines = [];
    const flush = () => {
        if (currentCategory !== null) {
            sections[currentCategory] = groupIntoFamilies(currentLines);
            currentLines = [];
        }
    };
    for (const line of lines) {
        const cat = isHeading(line);
        if (cat) {
            flush();
            currentCategory = cat;
        }
        else if (currentCategory === null) {
            preamble.push(line);
        }
        else {
            currentLines.push(line);
        }
    }
    flush();
    return { sections, preamble };
}
function serializeDoc(doc) {
    const parts = [];
    if (doc.preamble.length > 0) {
        parts.push(...doc.preamble);
    }
    for (const cat of types_1.CATEGORIES) {
        parts.push(`# ${cat}`);
        const families = doc.sections[cat];
        if (families.length > 0) {
            parts.push("");
            for (let i = 0; i < families.length; i++) {
                const f = families[i];
                parts.push(f.parent);
                for (const s of f.subtasks) {
                    parts.push(s);
                }
                if (i < families.length - 1) {
                    parts.push("");
                }
            }
        }
        parts.push("");
    }
    // Ensure file ends with single newline
    let result = parts.join("\n");
    result = result.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    return result;
}
//# sourceMappingURL=parser.js.map