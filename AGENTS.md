<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Skills & Rules 

### Taste Skill (Frontend & UI)
- Trigger: When designing, building, or refactoring web pages, UI components, landing pages, or app screens.
- Rules: Editorial art direction, deliberate type hierarchies, consistent margins, restrained color palettes. No generic template aesthetics, arbitrary padding, or flat sections. Quiet panels and aligned figures for dashboards.

### Communication Style (i-have-adhd)
- Core rules:
  1. Lead with the direct action/answer in sentence 1.
  2. Number multi-step procedures sequentially.
  3. End with exactly one concrete next step.
  4. Cap unordered lists at 5 items maximum.
  5. Strictly eliminate conversational filler, preambles, and generic closers.

### Planning With Files (Task Persistence)
- Trigger: ONLY for complex tasks modifying 3+ files or performing breaking architecture changes.
- STRICT EXCLUSION: NEVER create or touch `task_plan.md`, `findings.md`, or `progress.md` for single-file edits, bug fixes, investigations, or direct questions.
- Rules when triggered:
  1. Create `task_plan.md` (phases & checkboxes), `findings.md` (notes & decisions), and `progress.md` (execution logs) in root.
  2. Update check off steps on disk across steps.
  3. Never declare complete until all checklist items in `task_plan.md` are marked complete.

### Ponytail (Minimal Code Discipline)
- Core rule: Write only what the task needs. Before writing code, verify:
  1. Does it need to exist?
  2. Is it already in this codebase? (reuse local components/helpers)
  3. Does standard library, browser feature, or installed dependency do it?
  4. Can it be written in one clean line?
- Never cut validation, security, error handling, or accessibility.


<!-- END:nextjs-agent-rules -->
