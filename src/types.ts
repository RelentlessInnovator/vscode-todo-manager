export const CATEGORIES = ["Urgent", "Important", "Normal", "Backlog"] as const;
export type Category = typeof CATEGORIES[number];

export const CATEGORY_PRIORITY: Record<Category, number> = {
  Urgent: 0,
  Important: 1,
  Normal: 2,
  Backlog: 3,
};

export interface TaskFamily {
  parent: string;
  subtasks: string[];
  /** indent string of the parent (spaces or tabs) */
  parentIndent: string;
}

export interface ParsedDoc {
  /** sections keyed by category name */
  sections: Record<Category, TaskFamily[]>;
  /** lines before the first heading (should be empty in well-formed docs) */
  preamble: string[];
}

export interface TodoMeta {
  /** keyed by stripped task text */
  tasks: Record<string, TaskMetaEntry>;
}

export interface TaskMetaEntry {
  created: string;        // YYYY-MM-DD
  lastModified: string;   // ISO timestamp
}
