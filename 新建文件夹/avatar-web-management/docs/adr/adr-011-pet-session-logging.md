# ADR-005: Pet Session Logging

- **Status**: Accepted
- **Date**: 2026-05-26

## Context

The desktop pet runs in a Unity WebView on the user's machine. We need to track session lifecycle (start, interactions, crashes, end) for debugging and usage analytics. The client may go offline abruptly (user closes desktop app, system sleep) without sending an "end" event.

Alternatives considered:
- **Client-side only logging (Unity PlayerPrefs)**: No visibility for platform operators; lost on reinstall
- **Fire-and-forget analytics events (Amplitude/Mixpanel)**: Good for aggregate metrics, poor for debugging individual sessions
- **Server-side session log table**: Enables per-user session history, crash forensics, and usage dashboards

## Decision

**Server-side session logging via `PetSessionLog` table**, with the Unity client calling `POST /api/pet/session` for lifecycle events.

- `action: 'start'` — creates a new row with `startTime`
- `action: 'update'` — increments `interactionCount` or stores `crashLog`
- `action: 'end'` — sets `endTime` (best-effort; stale sessions detected by missing `endTime`)

Session ingestion does NOT block pet operation — API returns immediately after DB write.

## Consequences

**Positive:**
- Crash logs are available for debugging without access to the user's machine
- Session analytics (average session length, interactions per session, crash rate) can be derived from SQL queries
- Users can view their own session history

**Negative:**
- Orphaned sessions (no `end` event) accumulate; need a cleanup cron or TTL
- Privacy: session interaction counts and crash logs are stored server-side — should be documented in privacy policy
- Network dependency: if the user is offline, session events are lost (mitigation: Unity client could queue and retry)
