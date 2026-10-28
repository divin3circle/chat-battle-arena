# Chat Battle Arena

Chat Battle Arena is a Twitch extension game for streamers and their viewers. Viewers choose animated warriors from a panel below the stream, spend free cooldown spawns or demo Bits/diamonds for premium units, and watch those warriors attack towers in a live arena overlay.

The project was built for the Twitch x Codex hackathon. It supports two demo paths:

- **Solo streamer mode:** one streamer activates the extension and their viewers send warriors against an enemy tower.
- **Streamer vs streamer mode:** two streamers link channels with friend codes so each community can send warriors into a shared tower battle.

The implementation is a monorepo with three runtime surfaces:

- `chat-battle-arena-backend`: FastAPI + Socket.IO backend for sessions, attacks, health, and streamer linking.
- `chat-battle-arena-extension-config`: Twitch extension assets for viewer panel, streamer config wizard, video fullscreen overlay, and video component.
- `chat-battle-arena-overlay`: standalone OBS/browser overlay fallback.

## Project Description

Chat Battle Arena turns passive Twitch viewers into active participants in a channel-vs-channel tower battle. Streamers configure their tower and battle mode, then viewers use the extension panel to send characters such as Rookie, Scout, Bruiser, Titan, and Zoniac. Free units support lightweight participation, while premium units demonstrate where Twitch Bits transactions fit into the final production flow.

The overlay shows animated warriors running across the arena, tower health bars, custom pixel-art towers, and attack impacts. For the hackathon demo, payments run in `devPayments=true` mode with a demo purchase modal; production Bits support is wired through Twitch's Bits APIs and can be enabled once Twitch monetization setup is complete.

## Quick Start

Run each service in its own terminal.

First-time setup:

```bash
make setup
```

Start backend:

```bash
make backend
```

Start standalone overlay:

```bash
make overlay
```

Start Twitch extension asset server:

```bash
make extension
```

Default local URLs:

```text
Backend:   http://127.0.0.1:8010
Overlay:   http://localhost:3002/channel123
Extension: http://localhost:3003/index.html?channel=channel123&user=viewer1&backend=http://127.0.0.1:8010&devPayments=true
Config:    http://localhost:3003/config.html?channel=channel123&backend=http://127.0.0.1:8010&overlay=http://localhost:3002
```

## Twitch Local Test With ngrok

Expose the three local services:

```text
Extension assets -> localhost:3003
Backend API      -> localhost:8010
Overlay fallback -> localhost:3002
```

In Twitch Developer Console, use your extension asset ngrok URL as the Testing Base URI. It must end with `/`.

Example paths:

```text
Panel Viewer Path:
index.html?backend=<BACKEND_NGROK_URL>&devPayments=true

Config Path:
config.html

Live Config Path:
config.html

Video - Fullscreen Viewer Path:
video_fullscreen.html?backend=<BACKEND_NGROK_URL>

Video - Component Viewer Path:
video_component.html
```

Recommended video component sizing:

```text
Target Height: 30%
Aspect Ratio: 3 : 2
Autoscale: Yes
Scale Pixels: 1024
```

For local/hackathon testing, keep backend `.env` as:

```bash
MYSQL_BASE_URL=sqlite:///./chat_battle_arena.db
TWITCH_EXT_SECRET=replace_with_twitch_extension_shared_secret
DEV_AUTH_BYPASS=true
```

For production-style Twitch JWT enforcement, set `DEV_AUTH_BYPASS=false` and provide the real Twitch Extension shared secret.

## Demo Flow

### Solo Streamer

1. Activate the extension on a Twitch channel.
2. Open extension configuration.
3. Select `Singleplayer`.
4. Save settings.
5. Open the Twitch channel page and scroll to the extension panel.
6. Send a free unit such as `Rookie` or `Scout`.
7. Send a premium demo unit such as `Titan`, confirm the demo purchase modal, and watch the overlay update.

### Streamer vs Streamer

1. Activate the extension on two Twitch channels.
2. Streamer A enters Streamer B's friend code.
3. Streamer B enters Streamer A's friend code.
4. Each channel's viewers send warriors from their panel.
5. Attacks are mirrored between the linked streamer sessions.

## Useful Commands

```bash
make help
make setup
make backend
make overlay
make extension
```

Override defaults when needed:

```bash
BACKEND_PORT=8011 make backend
BACKEND_URL=https://example-backend.ngrok-free.app make overlay
EXTENSION_PORT=3004 make extension
```

## Notes

- The standalone overlay is kept as an OBS/browser-source fallback.
- The Twitch fullscreen overlay is served from the extension folder via `video_fullscreen.html`.
- `pixelswars-demos/` was only a temporary reference workspace and is intentionally ignored by git.
