# PRD: Chat Battle Arena (working title)

Version 0.2 · Target: Codex x TwitchCon Hackathon · Submission deadline: Nov 3, 2026, 1:00am GMT+3

Inspired by PixelWars (Twitch Streamer Tools Hackathon 2024 winner, Interactive Community Experiences, by Flavius Holerga). This project reuses the concept and credits the original. It does not copy the original code.

---

## 1. Summary

Viewers send characters into a live battle arena overlaid on the stream. Characters fight toward the enemy tower, and viewers can create their own characters by describing them in chat. Codex generates each character's stats, sprite, and ability, and the streamer approves it before it enters the roster. The result is a viewer-driven battle game where the audience designs the fighters.

## 2. Background and stack

The original PixelWars org (BitWarsTwitch) has a Python backend (bitwars-backend) and JavaScript overlay and extension repos (bitwars-overlay, bitwars-extension). This project now uses the Python backend architecture ported into the Chat Battle Arena monorepo, with renamed app surfaces and custom arena assets.

Project layout for this build uses three separate codebases:
- `chat-battle-arena-backend` (Node.js backend, authoritative game server)
- `chat-battle-arena-overlay` (Twitch Extension overlay view)
- `chat-battle-arena-extension-config` (Twitch Extension config view)

Each repo can be deployed and tested independently, with a shared protocol contract (`socket.io` events + REST payload schemas) versioned in backend docs.

- Backend: Node.js with TypeScript, Fastify or Express
- Realtime: socket.io
- Database: MySQL (via mysql2 or Prisma)
- Validation: Zod (or Ajv for JSON schema)
- Frontend: plain JavaScript and CSS, two Twitch Extension apps (overlay view, config view)
- Hosting: Railway

Twitch integration uses the Extension model, Extension Helper, bits via the Extension bits API, and EventSub for channel events.

## 3. Goals and non-goals

**Goals**
- A battle that is fun to watch within the first 30 seconds.
- Viewers create characters through Codex, not only pick from a fixed list.
- Streamer keeps control: approval queue, pricing, cooldowns, and kill switch.
- Clear Codex use visible in the build and in the demo.
- Score strongly on all four official judging criteria: innovation, impact, implementation quality, and design.

**Non-goals (for this hackathon)**
- Monetization beyond bits.
- Cross-channel battles (stretch only, see section 13).
- Mobile-specific UI.
- Persistent accounts outside Twitch identity.

## 4. Users

- **Viewer:** joins a battle, spends free or bit-based characters, creates characters with chat commands.
- **Streamer:** installs the extension, sets rules, approves custom characters, and runs the stream.
- **Judge:** evaluates the demo, the repo, and the Codex session.

## 4.1 Judging criteria mapping (must-haves)

The hackathon uses equally weighted judging criteria. This PRD maps each criterion to a measurable output:

- **Innovation/Idea:** at least one distinct mechanic beyond baseline lane battlers (Codex-generated playable fighters with moderated approval flow).
- **Potential Impact:** one streamer + live chat test run with at least 10 unique viewers participating during a battle.
- **Technological implementation:** deterministic battle simulation test and verified Twitch integration path (chat input, auth, realtime overlay).
- **Design:** overlay readability target met (tower HP, active fighters, battle state readable within 5 seconds by first-time viewer).

## 5. Core features

### F1. Arena battle engine (backend, authoritative)
- Arena is a 2D lane of fixed size (800 x 450 logical units).
- Each side has a tower with HP (default 1000).
- Characters spawn at their side and move toward the enemy tower.
- Characters attack the nearest enemy in range. Collisions block movement and trigger combat.
- Each character has one ability from a fixed whitelist: `dash`, `shield`, `heal_tower`, `pulse` (area damage), `slow`.
- Server ticks at 20 Hz and broadcasts state at 10 Hz.
- Battles last up to 3 minutes. If the tower survives, the side with more remaining HP wins.

**Acceptance:** A unit test suite covers movement, collision, damage, ability cooldowns, and win conditions. A 60-second simulated battle with fixed seeds produces the same result on every run.

### F2. Free characters
- Each viewer gets one free character per configurable cooldown (default 5 minutes).
- Cooldown is enforced on the backend, keyed on the viewer's Twitch ID.
- Free characters use a base stat template and a random ability.

**Acceptance:** A second free-character request before the cooldown ends returns a clear error and is not spawned.

### F3. Bit characters
- Viewers can spend bits to spawn a "bit character" with better base stats.
- Bit transactions are verified on the backend before a character is granted.
- Price is set in the streamer config (default 100 bits).

**Acceptance:** A character is only spawned after the backend confirms the transaction. A failed or refunded transaction does not grant a character.

### F4. Codex-generated custom characters
- Viewer sends `!create <description>` in chat, or redeems a channel point reward with a description.
- Backend sends the description to a Codex-powered generator with a strict JSON schema.
- The generator returns: name, stats within bounds, one whitelisted ability, a 16 x 16 sprite using an 8-color palette, and a short flavor line.
- Output is validated and clamped before it enters the approval queue.
- Streamer approves or rejects in the config view. Approved characters join the viewer pool.

**Validation rules**
- Stats clamped to configured min and max.
- Ability must be in the whitelist.
- Sprite must be 16 x 16 and use only palette indices.
- Name and flavor text pass a profanity and slur filter. Anything that fails is rejected silently and logged.
- Max 1 pending custom character per viewer.

**Acceptance:** A malformed or out-of-bounds generator response never reaches the overlay. Every approved character has a valid sprite, ability, and stats.

### F5. Streamer config panel (Extension config view)
- Set free-character cooldown, bit price, and max characters per battle.
- Approval queue for custom characters with approve, reject, and preview.
- Enable or disable features: custom characters, blackout effect, Hype Train champion.
- Kill switch: pauses new spawns and ends the current battle cleanly.

**Acceptance:** Every setting change takes effect on the next spawn without a page reload.

### F6. Overlay (Extension overlay view)
- Renders the arena, both towers, HP bars, characters, and a short battle log.
- Connects to the backend over socket.io with a token from Twitch JWT verification.
- Plain JavaScript with a canvas renderer. No build step required.
- Must render at 60 fps on a mid-range laptop, and must not block video playback.

**Acceptance:** Overlay still renders correctly after 10 minutes of continuous battles with 50+ characters on screen.

### F7. Hype Train champion (stretch, but high impact)
- During an active Hype Train, the top supporter gets a champion character with boosted stats.
- Triggered from the EventSub Hype Train event.

### F8. Blackout moment (cheap, high impact)
- Streamer can trigger a 3-second blackout of the overlay at the start of a decisive round.
- Triggered from the config panel or a channel point reward.

### F9. Highlight clips (stretch)
- When a battle ends with a large comeback or a big combo, create a clip using the Clips API.
- Store clip links in a timeline the streamer can view in the config panel.

## 6. Architecture

```
Twitch chat / channel points / bits / EventSub
            │
            ▼
chat-battle-arena-backend (Node.js, authoritative)
├─ EventSub listener (WebSocket transport)
├─ Battle engine (20 Hz tick)
├─ Character generator (Codex-powered, validated)
├─ Cooldowns, bits verification, approval queue
├─ RBAC for streamer/viewer actions
└─ socket.io server + REST API
            │
   ┌────────┴────────┐
   ▼                 ▼
chat-battle-arena-overlay      chat-battle-arena-extension-config
(overlay extension, canvas)    (config extension, approval/settings)
            │
            ▼
          MySQL
```

- The backend is the only source of game state. Overlay/config clients only render and request actions.
- EventSub uses the WebSocket transport during development, so no public endpoint is needed until deployment.
- Deployment target: Railway for the backend. Extension assets hosted through Twitch's asset hosting.
- Three separate repos are linked by environment config and a shared contract document (`docs/protocol.md` in backend).

## 7. Data model (MySQL)

- `channels`: id, twitch_channel_id, settings_json, kill_switch, created_at
- `viewers`: id, twitch_opaque_id, twitch_user_id (nullable), last_free_spawn_at
- `characters`: id, channel_id, owner_viewer_id, name, stats_json, ability, sprite_json, flavor, source (free | bits | custom | champion), status (pending | approved | rejected | active | retired), created_at
- `battles`: id, channel_id, started_at, ended_at, winner_side, log_json
- `battle_entries`: battle_id, character_id, side, spawned_at
- `transactions`: id, channel_id, viewer_id, bits, transaction_id (unique), status, created_at
- `clips`: id, battle_id, clip_url, created_at (stretch)

**Note:** Extension opaque IDs starting with `A-` change between sessions. Free-character cooldowns keyed only on those IDs can be bypassed. Log this as a known limitation, or require Twitch login for free spawns.

## 8. API and realtime events

**REST (Node.js)**
- `POST /api/characters/free` (viewer, auth via Twitch JWT)
- `POST /api/characters/bits` (viewer, transaction_id required)
- `POST /api/characters/custom` (viewer, description)
- `GET /api/channels/{id}/queue` (streamer)
- `POST /api/characters/{id}/approve` and `/reject` (streamer)
- `PUT /api/channels/{id}/settings` (streamer)
- `POST /api/channels/{id}/kill-switch` (streamer)

**socket.io namespace `/arena`, room per channel**
- Server to client: `battle:state` (10 Hz), `battle:start`, `battle:end`, `character:approved`, `effect:blackout`, `log:entry`
- Client to server: `join` (auth token)

Auth: every socket connection presents a Twitch JWT. The server verifies it before joining the room.

Authorization (RBAC):
- Streamer-only endpoints: queue read, approve/reject, channel settings update, kill switch.
- Viewer endpoints: free spawn, bits spawn, custom character requests.
- The server validates both token signature and role/channel ownership before executing any action.

## 9. Codex generation pipeline

- Input: viewer description (max 140 characters), channel settings.
- Output: JSON only, validated against a Zod schema.
- Generator runs server-side. The model returns a fixed structure:
  - `name` (max 24 chars)
  - `stats`: hp, speed, attack, range (each clamped)
  - `ability`: one of the whitelist
  - `sprite`: 16 rows of 16 palette indices
  - `flavor` (max 80 chars)
- On validation failure, retry once, then reject.
- Cost control: rate limit per channel, and a daily cap set in config.

**Build-time Codex use:** The whole app is built with Codex. Keep the Codex session ID and the prompts used for each feature, since the submission asks for the session where most of the build happened.

**Runtime generation:** Uses a separate model API key. Document this in the README, since it's a different thing from the Codex build tool.

## 10. Moderation and safety

- Profanity and slur filter on all viewer text (names, flavor, descriptions).
- Streamer approval is required for all custom characters.
- Kill switch disables new spawns instantly.
- Rate limit per viewer and per channel.
- No personal data beyond Twitch IDs is stored.

## 11. Security

- Verify every Twitch JWT on the backend. Reject expired or unsigned tokens.
- Enforce streamer role checks for all privileged routes. Never trust client role claims without backend verification.
- Verify bit transactions server-side. Deduplicate on transaction ID.
- Extension CSP: allowlist the backend URL under "URL fetching domains" in the Extension console. Extension scripts can only load from the extension's own files and the Extension Helper, so do not load CDN scripts at runtime.
- Store secrets in environment variables on Railway, never in the extension code.
- Replay protection: discard EventSub messages older than 10 minutes and dedupe on `message_id`.

## 12. Non-functional requirements

- Latency: state updates arrive at viewers within 200 ms of the server tick under normal load.
- Overlay must not block video playback.
- Backend handles at least 200 concurrent overlay connections for the demo.
- Logs for battles, transactions, and generator failures.
- Config changes apply without a restart.

## 13. Stretch: cross-channel battles

Two channels with the extension installed join one arena. An invite code links them, and each side's characters come from its own community. This is the strongest version of the original PixelWars idea, but it only ships if the core is stable.

## 14. Milestones to submission

Today is Oct 27. Submission deadline is Nov 3, 1:00am GMT+3. Aim to finish two days early.

- **Oct 28:** Create and wire three repos (backend, overlay, config extension), shared env contracts, and protocol doc.
- **Oct 28 to 29:** Backend skeleton, MySQL schema, battle engine with unit tests (F1).
- **Oct 30:** Overlay renders a live battle over socket.io (F6). Start the Extension review early, since it may take time.
- **Oct 31:** Config panel basics + approval queue controls + RBAC checks (F5).
- **Nov 1:** Codex generation and approval queue flow (F4). Add blackout effect (F8) if core stable.
- **Nov 2:** Bits flow (F3) only if stable; polish, demo video, README, final push.
- **Nov 2 evening:** Submit. Keep the Codex session ID handy.

**Ship scope (revised):**
- **Must ship:** F1 + F4 + F6 + minimal F5 (approval + kill switch + core settings).
- **Should ship:** F2.
- **Could ship:** F3.

**Cut order if behind schedule:** F9 first, then F7, then cross-channel battles, then F3.

## 15. Testing

- Unit tests: battle engine, cooldowns, validation, bits deduplication.
- Integration: EventSub WebSocket events produce expected spawns.
- Manual: 10-minute soak test with 50 characters on overlay.
- Demo rehearsal: run the full demo twice before recording.

## 16. Submission checklist

- Public GitHub repo (or private, shared with testing@devpost.com) with source, assets, and setup instructions.
- README with local setup, env vars, and how to run the EventSub WebSocket listener.
- Demo video, max 3 minutes, uploaded to YouTube and publicly visible. Shows the project working on Twitch and how Codex was used.
- Project description: features, functionality, and how Codex was used.
- Codex session ID from `/status` in Codex.
- Explicitly include novelty statement vs existing tools and inspiration sources.

## 16.1 Judge-first packaging (in case judges do not run project)

Judges may evaluate from submission materials only, so package for no-install review:

- 3-minute video includes full end-to-end flow on Twitch and one full battle segment.
- One architecture slide that explains 3-repo split and backend authority model.
- One short segment showing Codex build evidence: session ID, prompt-to-code example, and generated module walkthrough.
- README has a fast path section ("How to verify in under 5 minutes") with screenshots/GIFs and expected outcomes.

## 16.2 Originality and differentiation statement

Inspired by PixelWars, but this project's novelty is:

- Codex-generated characters as first-class gameplay entities with strict validation and moderation.
- Streamer approval queue as live content safety control, not just cosmetic moderation.
- Reproducible, deterministic battle engine with explicit anti-abuse and auth boundaries for Twitch extension contexts.

## 17. Demo script (3 minutes)

1. 0:00 to 0:20: Show the arena live, then state the hook: "viewers design the fighters."
2. 0:20 to 1:10: Viewer types `!create` with a description. Show the generated character and streamer approval.
3. 1:10 to 2:00: Free and bit spawns, battle running, a blackout moment.
4. 2:00 to 2:30: Show how Codex built the features: the session, a key prompt, and a generated module.
5. 2:30 to 3:00: Recap and call to action.

## 18. Open questions

- Which Codex model or API the runtime generator uses, and the cost per character.
- Whether Twitch's Extension review will be done before Nov 2. Confirm the current turnaround.
- Read the BitWarsTwitch overlay and extension repos for frontend patterns and Twitch integration details. The backend is Python, so only its API shapes are worth studying, not its code.
- Whether to keep the working title or pick a final name.

---

Attribution: Concept inspired by PixelWars by Flavius Holerga (Twitch Streamer Tools Hackathon 2024). All code in this project is new.
