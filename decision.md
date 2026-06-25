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
