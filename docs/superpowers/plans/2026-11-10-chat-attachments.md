# Chat screenshots, images and files

User requested this extension after authorizing direct implementation of the chat defaults. Continue inline on feat/shared-chat; preserve the existing uncommitted work.

## Design
- Screenshots use the native macOS region selector; Esc cancels, and a successful image appears in the draft before sending. Other systems can paste system screenshots. Never capture automatically or send without clicking Send.
- Select, paste or drag images/files into the composer, remove draft attachments, then send up to 5 attachments (12 MiB each) with optional text. Detect previewable raster images from bytes; SVG/HTML remain downloadable files.
- Encrypt binary attachments separately from message batches. Keep names, types, sizes and hashes in encrypted message bodies; message history contains references, not base64 content. Download image previews/files on demand; cache encrypted bytes locally.
- Preserve text-only history; add a body-format migration. Personal cloud identity and group-key changes re-upload attachments under the current room/key. Hydrate existing attachments before group rotation to preserve history.
- File save uses a native save dialog and never executes attachments. Group access/readonly and session/config fences apply to staging, sending, downloading and saving.

## Tasks
- [x] Failing-first tests for encrypted staging/storage, binary round trip between independent personal and group clients, retry order, lazy downloads, ACL/session isolation, and rotation/rebinding.
- [x] Implement attachment crypto/metadata helpers, schema, service staging, binary sync, lazy retrieval and rotation preparation.
- [x] Add native selection/file save/screenshot adapters and typed IPC; re-encrypt cached attachments on local password changes.
- [x] Add composer toolbar, drafts, paste/drop, image previews and downloadable file cards; maintain compact layout and readonly behavior.
- [x] Run core/chat/sync and Electron end-to-end tests, inspect screenshots, independently review and update the guide. Real screen capture permission flow and live Feishu transfers require manual acceptance; do not invoke native capture during automated tests.


## Verification

- Passed core tests, multi-device sync tests and all chat tests (text/history, attachments and screenshot workflow).
- Passed production TypeScript/Vite UI build and existing user-group Electron regression.
- Passed attachment Electron flows: file picker, remove draft, paste image, drop file, image enlargement, native save dialog, password change and compact composer visibility. Native file dialogs are stubbed in isolated test profiles; real filesystem/IPC/encryption paths run.
- Native screenshot workflow is unit-tested with an injected command: interactive arguments, cancel, permission failure, restore window and temporary-file cleanup. Actual screen capture was not invoked in automated tests. Verified native command flags from the installed screencapture help.
- Tested raw 12MiB binaries under the encrypted 20MB cloud limit, zero-byte files, malformed cloud bytes, stale drafts and readonly permissions.
- Independent review found a rotation/hydration race; deterministic concurrent-import regression now passes. Rotation repeatedly hydrates until complete, then rotates synchronously without yielding. Reviewer rechecked with no remaining concrete findings.
- Visual inspection found the old chat percentage-height rule let image history push the composer outside the viewport. A failing bounding-box assertion preceded a fixed viewport-sized conversation and internal timeline scroll; desktop/compact E2E passes.
- No live Feishu cloud transfers or real macOS permission prompt were exercised. Those require manual acceptance on configured devices. Changes remain local; no push/release.
