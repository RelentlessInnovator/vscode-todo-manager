# Personal Todo Manager — VS Code Extension

A VS Code extension that manages a markdown-based personal todo list. Every time you save your designated `.md` file the extension automatically dates new tasks, archives completed ones, silently deletes obsolete ones, promotes or demotes tasks between priority categories, flags stale work, and sorts each section — all without you lifting a finger beyond writing `DONE//` or `D//`.

---

## Table of Contents

1. [Installation](#installation)
2. [Settings](#settings)
3. [File Structure](#file-structure)
4. [Task Format](#task-format)
5. [Tags Reference](#tags-reference)
6. [On-Save Processing Pipeline](#on-save-processing-pipeline)
7. [Archive File Format](#archive-file-format)
8. [Sidecar Meta File](#sidecar-meta-file)
9. [Output Channel / Debugging](#output-channel--debugging)

---

## Installation

1. Download the latest `.vsix` file from the project folder (e.g. `todo-manager-0.4.0.vsix`).
2. In VS Code open the Extensions panel (`Ctrl+Shift+X`).
3. Click the **`...`** menu (top-right of the panel) → **Install from VSIX…**
4. Select the `.vsix` file.
5. When prompted, **Reload Window**.

---

## Settings

Open **Preferences → Settings** (`Ctrl+,`) and search for `todoManager`, or add the following directly to your `settings.json`:

```jsonc
{
  // Absolute path to your active todo .md file (required).
  "todoManager.filePath": "C:\\Users\\You\\Notes\\todo.md",

  // Set to false to pause all on-save processing without uninstalling.
  "todoManager.enabled": true
}
```

> **Windows paths** in JSON require double backslashes: `C:\\Users\\...`

---

## File Structure

```
your-notes-folder/
├── todo.md           ← your active todo list (set in todoManager.filePath)
├── archive-YYYY-MM.md  ← auto-created one file per calendar month
└── todo-meta.json    ← auto-managed sidecar for stale-date tracking
```

---

## File Structure — todo.md

Your todo file must contain exactly these four headings in this order (the extension preserves them even when empty):

```markdown
# Urgent

# Important

# Normal

# Backlog
```

Tasks are written as plain lines beneath the relevant heading. Subtasks are expressed by indenting one tab deeper than their parent. The extension detects top-level vs. subtask dynamically from relative indentation, so your personal habit of zero-indent or one-tab-indent parents is both fine.

**Example:**

```markdown
# Urgent

IN PROGRESS// Finish the budget spreadsheet [created: 2026-05-20]
	Pull Q1 actuals [created: 2026-05-20]
	Update forecasts tab [created: 2026-05-21]

# Important

Call the accountant [created: 2026-05-18]

# Normal

# Backlog

Research standing desk options [created: 2026-05-01]
```

---

## Task Format

```
[indent][PREPEND-TAG// ][task text][ - upgraded/downgraded][ [created: YYYY-MM-DD]]
```

- **Prepend tags** appear at the very start of the task text (after any indentation).
- **Append tags** appear at the end of the line.
- Multiple tags can coexist on the same line.
- All tag matching is **case-insensitive**.

---

## Tags Reference

### Prepend Tags (start of task text)

| Tag | Shorthand | Effect |
|---|---|---|
| `DONE//` | `D//` or `d//` | Marks task complete → moves parent + all subtasks to the monthly archive |
| `OBE//` | `O//` or `o//` | Overcome By Events → silently deletes parent + all subtasks, no archiving |
| `0//` | — | Promotes / demotes task to **Urgent** |
| `1//` | — | Promotes / demotes task to **Important** |
| `2//` | — | Promotes / demotes task to **Normal** |
| `99//` | — | Promotes / demotes task to **Backlog** |
| `STALE<N>//` | — | Auto-managed by the extension. Added when a task family has not been modified for ≥ 7 days. `N` is the number of days since last modification. **Do not add this manually.** |
| `<STATUS>//` | — | Any other free-form `WORD//` tag (e.g. `IN PROGRESS//`, `WAITING//`, `BLOCKED//`). Tasks with a status tag sort to the top of their category. |

> Subtask-level `DONE//` and `OBE//` tags are intentionally ignored. Subtasks only move or are deleted when their **parent** task is tagged.

### Append Tags (end of task line)

| Tag | Who adds it |
|---|---|
| `[created: YYYY-MM-DD]` | Auto-added by the extension on first save after a new task is detected |
| `- upgraded` | Auto-appended when a task is moved to a higher-priority category |
| `- downgraded` | Auto-appended when a task is moved to a lower-priority category |

---

## On-Save Processing Pipeline

Every time you save your designated todo file the following steps run **in order**:

### 1 — Creation Date Tagging
Every task line (parent and subtask) that does not already have a `[created: YYYY-MM-DD]` tag gets one appended using today's date. This runs first so all subsequent steps see a fully-tagged file.

### 2 — Archival (`DONE//` / `D//`)
Any **top-level** task tagged `DONE//` or `D//` is moved — together with all its subtasks — to the current month's archive file. The `DONE//` tag is stripped, and a `[completed: YYYY-MM-DD HH:MM]` tag is appended to every line (parent and subtasks alike). See [Archive File Format](#archive-file-format).

### 3 — Silent Deletion (`OBE//` / `O//`)
Any **top-level** task tagged `OBE//` or `O//` is deleted along with all its subtasks. Nothing is logged to the archive.

### 4 — Promotion / Demotion (`0//` `1//` `2//` `99//`)
Any **top-level** task with a numeric priority tag is moved to the corresponding category:

| Tag | Destination |
|---|---|
| `0//` | Urgent |
| `1//` | Important |
| `2//` | Normal |
| `99//` | Backlog |

- If the destination is the **same** as the source category the tag is silently stripped and the task stays put.
- If the destination **differs**, the task and its subtasks are appended to the bottom of the destination category. The numeric tag is replaced with `- upgraded` or `- downgraded` on the parent line.

### 5 — Stale Tagging
Applies to **Urgent**, **Important**, and **Normal** only. **Backlog is fully exempt.**

- The extension tracks the last-modified date of every task family (parent + subtasks) via `todo-meta.json`.
- If **7 or more calendar days** have elapsed since the family was last touched, `STALE<N>//` is prepended to the parent task line, where `N` is the number of days since last modification.
- If a `STALE<N>//` tag already exists, `N` is updated in place.
- If any subtask in the family had a status tag change since the last save, the stale timer resets for the whole family and the `STALE<N>//` tag is removed.
- The stale tag appears on the **parent line only**.

### 6 — Order Preservation
Tasks stay exactly where you put them within each category. The extension never reorders tasks automatically. The only exception is promotion/demotion (step 4), where a moved task lands at the **top** of its destination category so it is immediately visible.

### 7 — Cleanup
Consecutive blank lines between task families are collapsed to a single blank line. All four category headings are always present even if the section is empty.

---

## Archive File Format

One archive file is created per calendar month: `archive-YYYY-MM.md`.

The file is **purely chronological**. Each day on which tasks were archived gets a `## YYYY-MM-DD` heading. The most recent day appears at the **top** of the file; within a single day, tasks are appended in the order they were archived.

**Example `archive-2026-05.md`:**

```markdown
## 2026-05-24

Finish the budget spreadsheet [created: 2026-05-20] [completed: 2026-05-24 14:32]
	Pull Q1 actuals [created: 2026-05-20] [completed: 2026-05-24 14:32]
	Update forecasts tab [created: 2026-05-21] [completed: 2026-05-24 14:32]

Call the accountant [created: 2026-05-18] [completed: 2026-05-24 09:15]

## 2026-05-21

Earlier completed task [created: 2026-05-10] [completed: 2026-05-21 17:04]
```

---

## Sidecar Meta File

`todo-meta.json` lives in the same folder as your todo file and is fully auto-managed. You should not edit it manually. It records the creation date and last-modified timestamp for every task, keyed by the task text stripped of all tags. This data is used exclusively for stale detection.

---

## Output Channel / Debugging

The extension logs all activity to the **Todo Manager** output channel.

To view it: **View → Output** → select **"Todo Manager"** from the dropdown.

| Message prefix | Meaning |
|---|---|
| `Todo Manager is active.` | Extension activated successfully on VS Code startup |
| `[save] Triggered on …` | A save event matched your configured file path |
| `[info] Processed …` | All pipeline steps completed, file written back |
| `[info] Write-back complete.` | VS Code successfully persisted the processed content |
| `[archive] Archived: …` | A task family was moved to the archive |
| `[obe] Deleted: …` | A task family was silently deleted |
| `[promo] Moved …` | A task was promoted or demoted |
| `[warn] todoManager.filePath is not set.` | The setting is missing or empty |
| `[error] …` | Something went wrong (file unreadable, applyEdit failed, etc.) |

The extension **never shows error popups** — all diagnostics go to this channel only.
