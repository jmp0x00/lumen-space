# Manual Smoke Test

Use this checklist after any UI or networking change.

1. Run `npm run serve`. This uses the local no-cache static server so refreshes should pick up changed app files.
2. Open `http://localhost:4173/`.
3. Click the generate-name icon and confirm the nickname is replaced with a generated name.
4. Confirm the lobby copy makes the immediate loop clear: steer through pulsing stars, light same-color groups, and reveal constellations.
5. Enter or keep a nickname, choose a color, generate a room with the room icon, and enter the space.
6. Confirm the WebGL scene renders with the local light, participant panel, and a compact Goal panel showing stars-lit and constellation progress.
7. Open the copied room link in a second browser tab or a second browser profile.
8. Confirm both names and colors appear in both participant panels.
9. Move each pointer and confirm the corresponding light drifts in the other tab.
10. Confirm the room action controls are copy invite, Lo-Fi, and leave icon buttons, with no `Send Pulse`, `Add Bot`, or `Remove Bot` room control.
11. Resize to a mobile-width viewport and confirm the Lights list stays shallow, the Goal panel remains readable, and the UI does not overlap the icon action controls.
12. Move through a small touch star and confirm a compact star-colored wave spreads from the touched star center and fades, the star stays opened and brighter, the Goal panel increments stars-lit progress, and off-screen star activations show a thin colored edge line.
13. Press Space and double-click the scene, then confirm no pulse appears unless a touch star is consumed.
14. Confirm shared bots appear automatically, chase stars, and create pulses only when they consume stars.
15. Close one tab and confirm the peer disappears within the stale-peer window while remaining clients continue showing shared bots.
16. Block network access or CDN loading, reload, and confirm the app keeps reporting retry status rather than a blank screen.
