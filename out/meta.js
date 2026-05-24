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
exports.metaPath = metaPath;
exports.loadMeta = loadMeta;
exports.saveMeta = saveMeta;
exports.touchTask = touchTask;
exports.getOrCreateEntry = getOrCreateEntry;
exports.updateLastModified = updateLastModified;
exports.daysSinceModified = daysSinceModified;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const tags_1 = require("./tags");
function metaPath(todoFilePath) {
    return path.join(path.dirname(todoFilePath), "todo-meta.json");
}
function loadMeta(todoFilePath) {
    const p = metaPath(todoFilePath);
    if (!fs.existsSync(p)) {
        return { tasks: {} };
    }
    try {
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return { tasks: {} };
    }
}
function saveMeta(todoFilePath, meta) {
    const p = metaPath(todoFilePath);
    fs.writeFileSync(p, JSON.stringify(meta, null, 2), "utf8");
}
function touchTask(meta, line, forceToday) {
    const key = (0, tags_1.stableKey)(line);
    if (!key) {
        return;
    }
    const now = new Date().toISOString();
    const existing = meta.tasks[key];
    if (!existing) {
        meta.tasks[key] = { created: (0, tags_1.today)(), lastModified: now };
    }
    else if (forceToday) {
        meta.tasks[key] = { ...existing, lastModified: now };
    }
}
function getOrCreateEntry(meta, line) {
    const key = (0, tags_1.stableKey)(line);
    if (!meta.tasks[key]) {
        const now = new Date().toISOString();
        meta.tasks[key] = { created: (0, tags_1.today)(), lastModified: now };
    }
    return meta.tasks[key];
}
function updateLastModified(meta, line) {
    const key = (0, tags_1.stableKey)(line);
    if (!key) {
        return;
    }
    const now = new Date().toISOString();
    if (meta.tasks[key]) {
        meta.tasks[key].lastModified = now;
    }
    else {
        meta.tasks[key] = { created: (0, tags_1.today)(), lastModified: now };
    }
}
/** Days since last modification for a task family (uses most recent across parent+subtasks). */
function daysSinceModified(meta, parentLine, subtaskLines) {
    const allLines = [parentLine, ...subtaskLines];
    let latest = 0;
    for (const l of allLines) {
        const key = (0, tags_1.stableKey)(l);
        if (meta.tasks[key]) {
            const t = new Date(meta.tasks[key].lastModified).getTime();
            if (t > latest) {
                latest = t;
            }
        }
    }
    if (latest === 0) {
        return 0;
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const then = new Date(latest);
    then.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - then.getTime()) / 86400000);
}
//# sourceMappingURL=meta.js.map