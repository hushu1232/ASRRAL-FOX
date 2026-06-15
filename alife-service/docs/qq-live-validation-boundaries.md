# QQ Live Validation Boundaries

This document records the points where local tests are sufficient and where a real QQ/OneBot environment is required.

## QZone Bridge

Local tests currently verify:

- QZone external actions stay in dry-run mode unless explicitly configured for live mode.
- QZone post, comment, reply, and like calls are routed through `IQZoneRuntime`.
- `OneBotQZoneRuntime` uses configurable action names:
  - `PostAction`
  - `CommentAction`
  - `LikeAction`
- QZone target allowlists, private-contact like pool, probability checks, and confirmed proactive execution are enforced before runtime calls.

Real QQ/OneBot validation is required for:

- The exact plugin action names for QQ Zone posting, commenting, replying, and liking.
- The exact request field names expected by the installed OneBot/QZone adapter.
- Whether QQ Zone post ids and comment ids are exposed in the same format used by the local contracts.
- Whether the adapter reports success/failure synchronously or requires later event correlation.

No real QQ Zone write action should be enabled without owner confirmation, live-mode configuration, and an allowlisted target policy.

