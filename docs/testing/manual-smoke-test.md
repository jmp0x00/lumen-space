# Manual Smoke Test

Use this checklist after any UI or networking change.

1. Run `npm run serve`.
2. Open `http://localhost:4173/`.
3. Enter a nickname, choose a color, create a room, and enter the space.
4. Confirm the WebGL scene renders with the local light and participant panel.
5. Open the copied room link in a second browser tab or a second browser profile.
6. Confirm both names and colors appear in both participant panels.
7. Move each pointer and confirm the corresponding light drifts in the other tab.
8. Click `Send Pulse` in each tab and confirm pulse rings appear in both tabs.
9. Close one tab and confirm the peer disappears within the stale-peer window.
10. Click `Add Bot` and confirm a bot appears, moves, and eventually pulses.
11. Click `Remove Bot` and confirm the latest bot disappears.
12. Block network access or CDN loading, reload, and confirm the app keeps reporting retry status rather than a blank screen.
