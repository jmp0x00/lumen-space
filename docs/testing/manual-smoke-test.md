# Manual Smoke Test

Use this checklist after any UI or networking change.

1. Run `npm run serve`.
2. Open `http://localhost:4173/`.
3. Click the generate-name icon and confirm the nickname is replaced with a generated name.
4. Enter or keep a nickname, choose a color, generate a room with the room icon, and enter the space.
5. Confirm the WebGL scene renders with the local light and participant panel.
6. Open the copied room link in a second browser tab or a second browser profile.
7. Confirm both names and colors appear in both participant panels.
8. Move each pointer and confirm the corresponding light drifts in the other tab.
9. Move through a small touch star and confirm a pulse appears and the star temporarily disappears.
10. Click `Send Pulse` in each tab and confirm pulse rings appear in both tabs.
11. Close one tab and confirm the peer disappears within the stale-peer window.
12. Click `Add Bot` and confirm a bot appears, moves, and eventually pulses.
13. Click `Remove Bot` and confirm the latest bot disappears.
14. Block network access or CDN loading, reload, and confirm the app keeps reporting retry status rather than a blank screen.
