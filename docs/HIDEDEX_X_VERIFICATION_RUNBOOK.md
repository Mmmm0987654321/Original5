# HideDex X / Twitter verification — production runbook (2026-10-12)

## Public X post format
HideDex generates the **public** X-post ID from `HDX-` + the **last 10 lowercase hexadecimal characters of the connected wallet**, without a server sequence or extra padding. Example `HDX-1234567f12`. Zeroes that genuinely occur within those last ten wallet characters must remain. This is a display/reference suffix only, **not** globally collision-proof ownership verification. Copy Post and Post on X use the same exact `xPostText` string, without a signature. Both preview boxes stay compact (3 rows, internally scrollable). The user's approved post wording and spacing remain unchanged.

The backend still retains its separate sequence-based `x_verification_code` for wallet-signed Early Access registration, access checks and audit trails. **Do not alter existing user registrations, point calculations, volume checks, or trading permissions.** The internal enrollment code is not the X-post ID. The `proof` endpoint is left intact for historical compatibility but not called just to display a wallet suffix.

## Manual X review security
The public last-ten suffix alone is neither unique guaranteed nor proof of wallet ownership; anyone could post someone else's suffix. Match the registered X username, the full wallet address in a signed Early Access registration, and the public post. Only privileged staff may set `x_verification_status`. The X post itself never grants points, trading access or registration and is not automatically published/deleted.

## Search and social metadata
The official site name is **HideDex**, canonical host `https://www.hidedex.com/` (the apex domain 308-redirects to the www host), and X profile `@hidedex_com`. The X image uses a versioned asset containing the existing original logo, not the previous moon/mountain page illustration. Website metadata and `WebSite` structured data request the name HideDex; the Google index and AI Overview may update only after recrawling and are not controlled by the app.

## Existing and new signups
Do not overwrite existing access permissions or point awards. Existing enrollees keep their points/volumes and receive unique codes with X status pending; staff verifies if desired. Invalid/broken exchange-volume checks remain pending, not fake awarded points. No automatic X deletion is available.

## Potential follow-up
If user wants to submit a post URL and trigger operator review automatically, add a wallet-signed evidence endpoint and a private authenticated reviewer panel. Do not create a public `verify_x` endpoint without strong admin identity/authentication.

## Registration uniqueness and points
The form shows X username, Gmail, then wallet, and one Connect Wallet button below. The database rejects duplicate wallets, X handles (case-insensitive), and Gmail inboxes (including +tags and dots). Original X/email/wallet/code fields are immutable after registration; a non-cycling sequence never recycles proof IDs. X manual status is independent of waitlist access and verified total exchange volume/points. Gmail uniqueness does not prove inbox ownership. Do not grant trading or points based on public post codes.

## Verified registration rules
The real server points tiers run from 0.1 up to 12; the owner-specified public X copy intentionally says 0.1 to 10 and is not the authoritative award calculation. One registration is allowed per wallet, per case-insensitive X handle, and per canonical Gmail inbox (aliases like dots and plus tags cannot be reused). An X post is manually reviewed from the claimed account; copying or publishing it never automatically verifies the user.
