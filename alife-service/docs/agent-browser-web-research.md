# Agent Browser Web Research

## Purpose

This feature turns ordinary QQ lookup requests into a read-only research flow:

```text
@bot 查一下 agent-browser web-access
```

The bot searches the public web, selects public HTTP/HTTPS results, builds short evidence, and replies with a compact sourced answer.

Normal Chinese examples:

```text
查一下 agent-browser web access
@bot 搜一下 dotnet 9 release notes
```

## Current Flow

```text
QChatPublicInternetCommandPolicy
-> AgentWebResearchService
-> AgentPublicSearchService
-> AgentWebAccessService for owner auto-read only
-> QChatWebResearchFormatter
-> QQ reply
```

## Trigger Rules

- `/search <query>` remains supported.
- Group members may trigger search only when they explicitly mention the bot and the message has a search intent.
- Owner private messages may trigger natural search, for example `查一下 <query>` or `搜一下 <query>`.
- Messages that explicitly ask for `浏览器` remain on the existing owner-only browser snapshot path.
- Ordinary unmentioned group chat does not trigger web research.

## Permission Boundary

- Group members: public search evidence only.
- Owner: public search plus `AutoRead` of public HTTP/HTTPS pages when `EnableInternetAccess=true`.
- Private guests: not authorized for public internet command execution.
- Browser snapshot and browser interaction remain owner-only.

## Safety Boundary

The research pipeline is read-only.

It does not:

- click buttons,
- log in,
- download files,
- submit forms,
- execute page JavaScript,
- access localhost/private network/file URLs,
- treat web content as system, owner, developer, or tool authorization.

Unsafe or unreadable search results are skipped. If no usable evidence remains, the bot says it did not find reliable public content instead of inventing an answer.

When owner-only page auto-read fails for an otherwise safe public result, the service falls back to the search title and snippet instead of discarding the result. This keeps answers useful when a site returns 403, rejects simple fetch, or is temporarily unavailable. The failed read is also recorded in `AgentBrowserSiteExperienceStore`, so later browser strategy and diagnostics can see hosts that hit login walls, anti-bot pages, or repeated fetch failures.

## Site Experience Strategy

`AgentBrowserSiteExperienceStore` is part of the research strategy, not only diagnostics.

- `Blocked` hosts, such as recent login-wall failures, are removed from the research candidate list before page reading.
- Hosts with anti-bot signals avoid owner auto-read and use the short search snippet instead.
- Hosts with recent successful reads receive a small ranking boost.
- Medium/high risk history lowers rank, so cleaner official/docs/GitHub sources are preferred when available.

This saves tokens and latency because the bot does not repeatedly fetch pages that are likely to fail, and it does not feed low-quality login/captcha/error content into the final answer. The fallback evidence is intentionally compact: title, URL, and search snippet only.

## Source Ranking

The research service keeps the user's original query intact, then ranks usable public search results before reading or summarizing them:

1. Official and documentation-style sources.
2. GitHub sources.
3. Other public web pages.

This avoids changing `/search` semantics while still making owner auto-read prefer more reliable pages when several results are available.

## Owner Query Expansion

Owner research keeps the original query as the first search. If that search produces no usable public HTTP/HTTPS candidate, the service tries a short fallback plan:

1. Intent-aware high-signal expansions, when applicable:
   - latest/version/news requests: `<query> latest release notes`
   - exact HTTP status or exception requests: quoted exact error phrase
   - known Chinese technical terms: compact English technical query
2. Generic fallback expansions:
   - `official docs <query>`
   - `github <query>`
   - `release notes <query>`

This is intentionally conservative. It only applies to owner research after the original result set is unusable. The service stops after the first expansion that produces usable candidates, so intent matches reduce broad fallback searches rather than adding unlimited queries. Group members stay on the original public-search query and do not get expanded owner search behavior.

Token-saving rules:

- No expansion is attempted while the original query has a usable public candidate.
- No LLM is used for query rewriting.
- Expansion candidates are deterministic and de-duplicated.
- Group member searches do not expand or auto-read pages.

## Output Shape

QQ output is intentionally short:

```text
结论：...
1. ...
2. ...
来源：Title https://example.com/page
```

The formatter avoids exposing internal provider names, routing reasons, policy labels, stack traces, or browser strategy details.

## Live Smoke Checklist

Owner-only diagnostics expose the same checklist through:

```text
/qchat web smoke
```

Run these checks against a live QQ/NapCat session before treating the feature as production-ready:

1. Owner private chat: `查一下 dotnet 9 release notes`
   Expected: the owner path may auto-read public HTTP/HTTPS pages and reply with a short conclusion plus sources.

2. Group member in a group: `@bot 搜 dotnet 9 release notes`
   Expected: group members receive public search evidence only. This must not trigger owner-only browser snapshot or browser interaction.

3. Non-owner private chat: `/search dotnet 9`
   Expected: the request must not enter the model, reveal owner menus, or trigger the web research event chain.

4. Owner private chat: `/qchat web doctor`
   Expected: diagnostics show browser provider state, internet switch state, and recent site experience.

The smoke run must not trigger clicking, login, downloads, form submission, JavaScript execution, private-network access, or `file:` URLs.
