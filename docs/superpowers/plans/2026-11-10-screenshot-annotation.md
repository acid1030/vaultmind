# Global screenshot shortcut and annotation editor

Continue authorized implementation inline in feat/shared-chat, preserving all prior work.

## Design
- Default global accelerator CommandOrControl+Alt+A; configurable by key recording in a screenshot settings dialog in chat. Registration conflicts are visible and preserve the previous working accelerator. Unregister on quit.
- Reuse macOS native region/window selection. After selection open a dedicated, isolated Electron annotation window. Screenshots require an unlocked local account; readonly group contexts cannot capture into that group. Non-macOS can annotate an imported/pasted image; native selection remains macOS-specific in this release.
- Annotation tools: rectangle, ellipse, arrow, brush, text (multiline/IME), mosaic, palette, line width, font size, undo/redo, clear, Escape cancel, Cmd/Ctrl+Enter finish. Draw/export at original image resolution, scale only the viewport.
- Keep screenshot bytes in memory between native capture and editor; native temporary file is removed. Editor IPC accepts only its own webContents and validates PNG/size/dimensions/session. No raw source in URLs/logs. On logout/quit close editor and discard output.
- Global shortcut captures the current authorized room, then navigates to that room and delivers edited attachments to its draft. Button capture and shortcut share one busy guard; no auto-send. If a draft is full, do not silently drop or reroute the image.
- Add annotate-existing-image entry from attachment draft for systems without native capture.

## Tasks
- [x] Failing-first tests for shortcut registration/rollback, annotation geometry/history and editor IPC/lifecycle/session fencing.
- [x] Implement source-resolution renderer model, local editor HTML/CSS/JS/preload and secure main-process controller.
- [x] Wire global accelerator, configuration, screenshot-to-editor flow and room-bound draft delivery; annotate existing draft images.
- [x] Browser/Electron tests for tools, text, mosaic pixels, undo/redo, output resolution, cancellation, IPC sender validation, shortcut routing and existing chat flows. Test with generated fixture images, never capture the real desktop in automation.
- [x] Build, run relevant suites, inspect editor screenshots, independent review and user-guide update. Leave changes local, no push/release.

## Verification
- Passed core, multi-device sync, chat/attachment/screenshot unit suites and screenshot shortcut/model/controller suites.
- Passed Electron chat, attachments and screenshot annotation E2E with generated fixtures; native desktop capture was mocked.
- Inspected /tmp/axonmind-screenshot-annotation.png; Chinese text, shapes and mosaic render correctly.
- Independent reviewer found no actionable issues. Native OS hotkey delivery and screen-recording permission prompt still require manual validation.
