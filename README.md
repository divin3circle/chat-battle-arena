# Chat Battle Arena Workspace

This workspace is organized into three separate codebases, modeled after the `backend` + `overlay` + `extension` split:

- `chat-battle-arena-backend`
- `chat-battle-arena-overlay`
- `chat-battle-arena-extension-config`

Recommended bootstrap order:

1. Backend API + socket server
2. Overlay render loop wired to backend events
3. Config extension approval/settings flow

