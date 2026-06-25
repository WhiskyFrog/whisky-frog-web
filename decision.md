# decision.md

## 2026-06-25: Push requests mean commit and push

When the user asks to push changes, complete the full Git delivery flow unless there is a concrete blocker:

1. Check `git status --short --branch` and the active remote.
2. Include all task-related files in the commit.
3. Run the relevant validation commands before committing when feasible.
4. Commit using the repository convention from `CLAUDE.md`.
5. Push the active branch to its upstream remote.
6. Report the commit hash and push target.

Do not stop after local edits when the user asked for a push.

## 2026-06-25: Public market screens must be mobile-friendly

Market product lists are read on phones. Do not rely on a compressed desktop table for mobile layouts.

1. Use a dedicated mobile layout when product names, local prices, and direct import prices compete for width.
2. Keep direct import price readable as a stable block: amount on one line, shipping/context on a second line when present.
3. Preserve the desktop table for wider screens when it remains scannable.
4. Prevent numeric prices from wrapping character-by-character with `whitespace-nowrap` or an equivalent layout constraint.
