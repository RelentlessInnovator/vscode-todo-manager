import { CATEGORIES, Category, ParsedDoc, TaskFamily } from "./types";
import { getIndent } from "./tags";

const HEADING_RE = /^#\s+(.+)$/;

function isHeading(line: string): Category | null {
  const m = line.match(HEADING_RE);
  if (!m) { return null; }
  const name = m[1].trim() as Category;
  return (CATEGORIES as readonly string[]).includes(name) ? name : null;
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

/**
 * Given lines under a single category heading, group them into TaskFamily objects.
 * The "top-level" tasks are detected by finding the minimum indentation among
 * non-blank lines and treating those as parents.
 */
export function groupIntoFamilies(lines: string[]): TaskFamily[] {
  // Filter to non-blank lines only to find minimum indent
  const nonBlank = lines.filter(l => !isBlank(l));
  if (nonBlank.length === 0) { return []; }

  const minIndent = nonBlank.reduce((min, l) => {
    const len = getIndent(l).length;
    return len < min ? len : min;
  }, Infinity);

  const families: TaskFamily[] = [];
  let current: TaskFamily | null = null;

  for (const line of lines) {
    if (isBlank(line)) {
      // blank lines attach to no family; we'll handle them in serialisation
      continue;
    }
    const indentLen = getIndent(line).length;
    if (indentLen === minIndent) {
      // This is a top-level task
      if (current) { families.push(current); }
      current = { parent: line, subtasks: [], parentIndent: getIndent(line) };
    } else {
      // subtask
      if (current) {
        current.subtasks.push(line);
      } else {
        // orphan subtask before any parent — treat as new top-level
        current = { parent: line, subtasks: [], parentIndent: getIndent(line) };
      }
    }
  }
  if (current) { families.push(current); }
  return families;
}

export function parseDoc(content: string): ParsedDoc {
  const lines = content.split(/\r?\n/);
  const sections: Record<Category, TaskFamily[]> = {
    Urgent: [],
    Important: [],
    Normal: [],
    Backlog: [],
  };
  const preamble: string[] = [];

  let currentCategory: Category | null = null;
  let currentLines: string[] = [];

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
    } else if (currentCategory === null) {
      preamble.push(line);
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return { sections, preamble };
}

export function serializeDoc(doc: ParsedDoc): string {
  const parts: string[] = [];

  if (doc.preamble.length > 0) {
    parts.push(...doc.preamble);
  }

  for (const cat of CATEGORIES) {
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
