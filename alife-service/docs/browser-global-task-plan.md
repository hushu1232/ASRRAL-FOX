# Browser And Web Research Global Task Plan

## Operating Rule

After each priority is completed:

1. Run the relevant focused tests and `dotnet build --no-restore`.
2. Record the completion evidence in this document or the linked validation record.
3. Upload the tracked project snapshot to GitHub through the `D:\FOXD` workflow.
4. Report the completed priority and the next remaining priority to the owner.

Do not mark a priority complete when it only has unit tests but still needs a live QQ/NapCat condition that was not available. In that case, record the blocker explicitly.

## Priority 1: Real Link Validation

Status: partial completion; QQ message-level smoke is blocked by local runtime/session state.

Goal: prove the browser/web research feature works in the real runtime, not only in unit tests.

Tasks:

- Run `/qchat web smoke` checklist in a live QQ/NapCat session.
- Verify owner private natural search triggers web research.
- Verify group `@bot` search intent triggers public search evidence only.
- Verify non-owner private `/search` does not enter the model, expose menus, or trigger search.
- Verify real public search provider behavior in the current network.
- Verify real public page read behavior for representative sites.
- Record actual provider/read failures into validation notes.

Completion evidence required:

- QChat live health result.
- OneBot/NapCat availability result.
- At least one real public search smoke result.
- At least one real public HTTP/HTTPS read smoke result.
- If QQ/NapCat is unavailable, a blocker record plus successful provider/read smoke is acceptable only as partial completion, not full live completion.

Validation record:

- `docs/browser-live-validation-2026-06-23.md`

Current evidence:

- Real project-level public search/read smoke passed with `ALIFE_WEB_LIVE_SMOKE=1`.
- NapCat was running and `127.0.0.1:3001` was reachable.
- Mio OneBot action probe returned `good=true`, `online=false`.
- XiaYu endpoint `127.0.0.1:3002` was unreachable.
- Alife was not persistently reported as running by live health.

Remaining before full completion:

- Restore a healthy OneBot session for the target bot.
- Run the QQ message-level smoke checklist from `/qchat web smoke`.

## Priority 2: Site Experience Feedback Into Strategy

Status: pending.

Goal: make recorded site experience influence future web research decisions.

Tasks:

- Lower rank or skip hosts with recent login-wall failures.
- Lower rank or snippet-only hosts with repeated fetch failures.
- Prefer official/docs/GitHub hosts when site history is clean.
- Surface recent failures in `/qchat web doctor`.
- Add tests for failure-driven ranking and fallback.

## Priority 3: Search Intelligence

Status: pending.

Goal: make search planning smarter without loosening safety boundaries.

Tasks:

- Expand owner queries based on intent, not only fixed fallback templates.
- Add freshness-aware query planning for latest/news/version asks.
- Add exact-error query handling for bug reports.
- Add Chinese-to-English technical keyword expansion where useful.
- Keep group-member search conservative unless explicitly allowed later.

## Priority 4: External RAG Closure

Status: pending.

Goal: turn approved public research results into reusable external knowledge.

Tasks:

- Add owner-approved source ingestion.
- Clean and chunk public page text.
- Deduplicate stored sources.
- Query stored public knowledge from QQ.
- Keep add/delete/refresh/configuration owner-only.

## Priority 5: Rate Limit, Cache, And Cost Control

Status: pending.

Goal: prevent group search abuse and make cost/latency observable.

Tasks:

- Add per-group and per-user cooldowns.
- Add short-term query result cache.
- Add concurrent web research cap.
- Track search count, read count, page bytes, latency, and approximate summarization cost.
- Add visible refusal or silence policy for over-limit group requests.

## Priority 6: Browser Snapshot Productization

Status: pending.

Goal: make owner-only read-only browser snapshots more reliable.

Tasks:

- Improve title/body/link extraction.
- Detect login walls and anti-bot pages.
- Summarize large pages safely.
- Keep snapshots as untrusted external context.
- Do not add click/login/download/form/JS interaction without a separate owner-approved high-risk design.

## Priority 7: Engineering Cleanup And Upload Hygiene

Status: pending.

Goal: keep browser work maintainable and uploadable.

Tasks:

- Ensure all new web research files are tracked by git before upload.
- Keep generated/runtime data out of upload snapshots.
- Clean up historical garbled Chinese docs/tests in a separate task.
- Keep D-drive storage preference for runtime/cache/temp data.
- Use `D:\FOXD` upload workflow after each completed priority.
