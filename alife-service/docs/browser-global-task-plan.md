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

Status: completed on 2026-06-23.

Goal: make recorded site experience influence future web research decisions.

Tasks:

- Lower rank or skip hosts with recent login-wall failures. Done: `Blocked` site experience is removed from research candidates before owner auto-read.
- Lower rank or snippet-only hosts with repeated fetch failures. Done: anti-bot history avoids owner auto-read and uses compact search snippet evidence instead.
- Prefer official/docs/GitHub hosts when site history is clean. Done: source type ranking remains in place, and clean successful history receives a positive candidate score.
- Surface recent failures in `/qchat web doctor`. Done: browser doctor/status use `AgentBrowserSiteExperienceStore` recent records.
- Add tests for failure-driven ranking and fallback. Done: framework and QChat integration tests cover blocked-host skip and anti-bot snippet fallback.

Token saving effect:

- Known login-wall hosts are skipped before page reads, avoiding failed fetch/browser attempts and avoiding low-value snippets in final evidence.
- Known anti-bot hosts are not auto-read by the owner path; the bot uses the short search snippet instead.
- Candidate scoring favors sources with clean successful history, reducing wasted attempts on repeatedly failing domains.
- Evidence remains compact and deterministic, so the later QQ formatting path does not carry full external page text when it is unlikely to help.

Verification evidence:

- `dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~ResearchAsync_SkipsKnownLoginWallHostFromSiteExperience|FullyQualifiedName~ResearchAsync_UsesSearchSnippetForKnownAntiBotHostWithoutReadingPage"` passed.
- `dotnet test Tests\Alife.Test.QChat\Alife.Test.QChat.csproj --no-restore --filter "FullyQualifiedName~WebResearchOwnerPrivateSemanticSearchUsesInjectedSiteExperienceToSkipBlockedHost"` passed after wiring QChat research to the shared site experience store.
- `dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~AgentWebResearchServiceTests|FullyQualifiedName~AgentBrowserSiteExperienceStoreTests|FullyQualifiedName~AgentWebAccessServiceTests|FullyQualifiedName~AgentWebAccessRouterTests|FullyQualifiedName~AgentPublicSearchServiceTests"` passed: 57 passed, 0 failed.
- `dotnet test Tests\Alife.Test.QChat\Alife.Test.QChat.csproj --no-restore --filter "FullyQualifiedName~WebResearch|FullyQualifiedName~QChatPublicInternetCommandPolicyTests|FullyQualifiedName~QChatInternetCapabilityPolicyTests|FullyQualifiedName~QChatDiagnosticsServiceTests"` passed: 71 passed, 0 failed.
- `dotnet build --no-restore` passed with 0 warnings and 0 errors.

## Priority 3: Search Intelligence

Status: completed on 2026-06-23.

Goal: make search planning smarter without loosening safety boundaries.

Tasks:

- Expand owner queries based on intent, not only fixed fallback templates. Done: owner-only fallback now tries high-signal intent queries before generic `official docs`, `github`, and `release notes` fallbacks.
- Add freshness-aware query planning for latest/news/version asks. Done: latest/version/news style requests add a focused `latest release notes` query.
- Add exact-error query handling for bug reports. Done: HTTP status and exception/error terms are quoted before generic fallback.
- Add Chinese-to-English technical keyword expansion where useful. Done: browser/search/read/anti-bot/login-wall/RAG style Chinese terms can produce compact English technical queries.
- Keep group-member search conservative unless explicitly allowed later. Done: group members still use only the original query and never run owner query expansion.

Token saving effect:

- Intent expansions run only after the original owner search has no usable public HTTP/HTTPS candidate.
- The planner stops as soon as one expansion produces usable candidates, so successful intent plans avoid generic fallback searches.
- Latest/version questions use one focused `latest release notes` expansion instead of broad news-style browsing.
- Error questions quote the exact status/exception phrase, reducing irrelevant result pages and wasted page reads.
- Chinese technical questions use compact English terms only when matching known technical vocabulary, avoiding LLM-based query rewriting.
- Group members do not receive expansion, auto-read, or browser evidence, keeping group-triggered token and network cost bounded.

Verification evidence:

- `dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~ResearchAsync_OwnerUsesFreshnessAwareExpansionForLatestRequests|FullyQualifiedName~ResearchAsync_OwnerUsesExactErrorExpansionBeforeGenericFallback|FullyQualifiedName~ResearchAsync_OwnerUsesEnglishTechnicalExpansionForChineseBrowserTerms|FullyQualifiedName~ResearchAsync_GroupMemberDoesNotUseIntentExpansionForLatestRequests"` passed: 4 passed, 0 failed.
- `dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~AgentWebResearchServiceTests|FullyQualifiedName~AgentBrowserSiteExperienceStoreTests|FullyQualifiedName~AgentWebAccessServiceTests|FullyQualifiedName~AgentWebAccessRouterTests|FullyQualifiedName~AgentPublicSearchServiceTests"` passed: 61 passed, 0 failed.
- `dotnet test Tests\Alife.Test.QChat\Alife.Test.QChat.csproj --no-restore --filter "FullyQualifiedName~WebResearch|FullyQualifiedName~QChatPublicInternetCommandPolicyTests|FullyQualifiedName~QChatInternetCapabilityPolicyTests|FullyQualifiedName~QChatDiagnosticsServiceTests"` passed: 71 passed, 0 failed.
- `dotnet build --no-restore` passed with 0 warnings and 0 errors.

## Priority 4: External RAG Closure

Status: completed on 2026-06-23.

Goal: turn approved public research results into reusable external knowledge.

Tasks:

- Add owner-approved source ingestion. Done: `/qchat rag add <url>` remains owner-only and fetches public HTTP/HTTPS pages before storing them.
- Clean and chunk public page text. Done: HTML tags, script/style blocks, common boilerplate, and repeated whitespace are stripped before chunking.
- Deduplicate stored sources. Done: adding the same URL replaces the old source and removes stale chunks.
- Query stored public knowledge from QQ. Done: `/rag <question>` and semantic external RAG query paths return stored public knowledge without network or model dispatch.
- Keep add/delete/refresh/configuration owner-only. Done: `/qchat rag list` and `/qchat rag delete <id|url>` are owner-only; non-owner `/qchat` commands are dropped before reaching the RAG service.

Token saving effect:

- Source ingestion cleans noisy page text before chunking, so scripts, style blocks, cookie banners, navigation text, and repeated whitespace do not become reusable prompt context.
- Stored source listing returns only compact metadata: count, id, title, and URL. It never returns chunk text.
- RAG queries use `PublicExternalRagMaxChunks`, so QQ retrieval has a hard chunk cap.
- Add/delete/list management commands bypass the model and do not perform public search.
- Non-owner `/qchat rag ...` commands are dropped before service dispatch, menu rendering, and model execution.

Verification evidence:

- `dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~AddSource_CleansBoilerplateAndCompactsChunksToSaveTokens|FullyQualifiedName~ListSources_ReturnsCompactMetadataWithoutChunkText|FullyQualifiedName~DeleteSource_RemovesSourceAndChunksByUrl|FullyQualifiedName~DeleteSource_RejectsNonOwnerWrites"` passed: 4 passed, 0 failed.
- `dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~ListSources_ReturnsStoredSourcesWithoutFetching|FullyQualifiedName~DeleteSource_WhenOwner_RemovesStoredSourceAndAuditsSuccess|FullyQualifiedName~DeleteSource_WhenNonOwner_DoesNotDeleteOrFetch"` passed: 3 passed, 0 failed.
- `dotnet test Tests\Alife.Test.QChat\Alife.Test.QChat.csproj --no-restore --filter "FullyQualifiedName~OwnerCanListExternalRagSources|FullyQualifiedName~OwnerCanDeleteExternalRagSource|FullyQualifiedName~GroupMemberCannotDeleteExternalRagSourceViaQChat"` passed: 3 passed, 0 failed.
- `dotnet test Tests\Alife.Test.Framework\Alife.Test.Framework.csproj --no-restore --filter "FullyQualifiedName~AgentExternalRagServiceTests|FullyQualifiedName~AgentWebAccessServiceTests|FullyQualifiedName~AgentWebAccessRouterTests"` passed: 43 passed, 0 failed.
- `dotnet test Tests\Alife.Test.QChat\Alife.Test.QChat.csproj --no-restore --filter "FullyQualifiedName~Rag|FullyQualifiedName~ExternalRag|FullyQualifiedName~QChatPublicInternetCommandPolicyTests|FullyQualifiedName~QChatInternetCapabilityPolicyTests|FullyQualifiedName~QChatDiagnosticsServiceTests"` passed: 76 passed, 0 failed.
- `dotnet build --no-restore` passed with 0 warnings and 0 errors.

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
