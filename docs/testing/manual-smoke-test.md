# Manual Smoke Test

Use this checklist after any UI or networking change.

1. Run `npm run serve`. This uses the local no-cache static server so refreshes should pick up changed app files.
2. Open `http://localhost:4173/`.
3. Click the generate-name icon and confirm the nickname is replaced with a generated name.
4. Enter or keep a nickname, choose a color, generate a room with the room icon, and enter the space.
5. Confirm the WebGL scene renders with the local light and participant panel.
6. Open the copied room link in a second browser tab or a second browser profile.
7. Confirm both names and colors appear in both participant panels.
8. Move each pointer and confirm the corresponding light drifts in the other tab.
9. Confirm the room action controls are copy invite, Lo-Fi, and leave icon buttons, with no `Send Pulse`, `Add Bot`, or `Remove Bot` room control.
10. Resize to a mobile-width viewport and confirm the Lights list stays shallow, scrolls horizontally, and does not overlap the icon action controls.
11. Move through a small touch star and confirm a pulse appears and the star temporarily disappears.
12. Press Space and double-click the scene, then confirm no pulse appears unless a touch star is consumed.
13. Confirm shared bots appear automatically, chase stars, and create pulses only when they consume stars.
14. Close one tab and confirm the peer disappears within the stale-peer window while remaining clients continue showing shared bots.
15. Block network access or CDN loading, reload, and confirm the app keeps reporting retry status rather than a blank screen.
