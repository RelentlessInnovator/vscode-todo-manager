"use strict";
/** All tag manipulation utilities. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasCreatedTag = hasCreatedTag;
exports.appendCreatedTag = appendCreatedTag;
exports.appendCompletedTag = appendCompletedTag;
exports.hasDoneTag = hasDoneTag;
exports.hasObeTag = hasObeTag;
exports.hasPromoTag = hasPromoTag;
exports.getPromoTag = getPromoTag;
exports.hasStaleTag = hasStaleTag;
exports.getStaleTag = getStaleTag;
exports.hasStatusTag = hasStatusTag;
exports.getIndent = getIndent;
exports.taskText = taskText;
exports.stripPrependTags = stripPrependTags;
exports.stableKey = stableKey;
exports.setStaleTag = setStaleTag;
exports.removeStaleTag = removeStaleTag;
exports.applyPromoResult = applyPromoResult;
exports.today = today;
exports.nowDatetime = nowDatetime;
exports.daysSince = daysSince;
const DATE_RE = /\s*\[created:\s*\d{4}-\d{2}-\d{2}\]/gi;
const COMPLETED_RE = /\s*\[completed:[^\]]*\]/gi;
const STATUS_TAG_RE = /^([A-Z][A-Z0-9 _-]*?\/\/)/i;
const DONE_RE = /^(DONE|D)\/\//i;
const OBE_RE = /^(OBE|O)\/\//i;
const PROMO_RE = /^(0|1|2|99)\/\//;
const STALE_RE = /^STALE(\d+)\/\//i;
const UPGRADED_RE = /\s*-\s*(upgraded|downgraded)\s*$/i;
function hasCreatedTag(line) {
    return /\[created:\s*\d{4}-\d{2}-\d{2}\]/i.test(line);
}
function appendCreatedTag(line, date) {
    return `${line.trimEnd()} [created: ${date}]`;
}
function appendCompletedTag(line, datetime) {
    return `${line.trimEnd()} [completed: ${datetime}]`;
}
function hasDoneTag(line) {
    return DONE_RE.test(taskText(line));
}
function hasObeTag(line) {
    return OBE_RE.test(taskText(line));
}
function hasPromoTag(line) {
    return PROMO_RE.test(taskText(line));
}
function getPromoTag(line) {
    const m = taskText(line).match(PROMO_RE);
    return m ? m[1] : null;
}
function hasStaleTag(line) {
    return STALE_RE.test(taskText(line));
}
function getStaleTag(line) {
    const m = taskText(line).match(STALE_RE);
    return m ? { days: parseInt(m[1], 10) } : null;
}
function hasStatusTag(line) {
    const text = taskText(line);
    // status tag = any XYZ// that is NOT done/obe/promo/stale
    if (DONE_RE.test(text)) {
        return false;
    }
    if (OBE_RE.test(text)) {
        return false;
    }
    if (PROMO_RE.test(text)) {
        return false;
    }
    if (STALE_RE.test(text)) {
        return false;
    }
    return STATUS_TAG_RE.test(text);
}
/** Returns the indent prefix of a line. */
function getIndent(line) {
    const m = line.match(/^(\s*)/);
    return m ? m[1] : "";
}
/** Returns the task text after stripping indent. */
function taskText(line) {
    return line.trimStart();
}
/** Strip all managed prepend tags from the task text portion of a line. */
function stripPrependTags(line) {
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
function stableKey(line) {
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
function setStaleTag(line, days) {
    const indent = getIndent(line);
    let text = taskText(line);
    // Remove existing STALE tag first
    text = text.replace(/^STALE\d*\/\//i, "").trimStart();
    return `${indent}STALE${days}//${text}`;
}
/** Remove STALE tag from a line. */
function removeStaleTag(line) {
    const indent = getIndent(line);
    let text = taskText(line);
    text = text.replace(/^STALE\d*\/\//i, "").trimStart();
    return indent + text;
}
/** Replace promo tag with upgraded/downgraded suffix on the parent line. */
function applyPromoResult(line, direction) {
    const indent = getIndent(line);
    let text = taskText(line);
    // Remove promo tag
    text = text.replace(/^(0|1|2|99)\/\//, "").trimStart();
    // Remove any existing upgraded/downgraded
    text = text.replace(UPGRADED_RE, "").trimEnd();
    return `${indent}${text} - ${direction}`;
}
function today() {
    return new Date().toISOString().slice(0, 10);
}
function nowDatetime() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function daysSince(dateStr) {
    const then = new Date(dateStr);
    const now = new Date();
    then.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - then.getTime()) / 86400000);
}
//# sourceMappingURL=tags.js.map