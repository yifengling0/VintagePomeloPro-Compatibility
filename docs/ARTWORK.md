# Game artwork policy

All 16 current games have small, locally stored images used to identify games. These images are not compatibility evidence. Images are never fetched automatically from Steam during a visitor's page load: changing store imagery cannot silently replace the reviewed image.

## Sources and rights

The per-image source page, original asset URL, visual review, review date, dimensions, and rights statement are in `data/game-images.json`. Fifteen images are official Steam promotional headers, preserved unchanged. The White Album 2 text logo is from Wikimedia Commons, marked PD-textlogo there (trademark restrictions may still apply).

Official promotional images remain copyrighted to their respective rights holders. No open redistribution license has been verified for the Steam headers. They are used here as low-resolution identification illustrations in a community compatibility reference; they are not relicensed under this project's code license. Attribution does not grant unrestricted reuse. Rights holders can request removal/replacement via the repository Issues. Do not reuse these assets in unrelated projects based on this repository's presence alone.

## Review and replacement

Each current image was visually inspected on 2026-10-18. No pornographic or sexually suggestive imagery is included. Winter Memories uses the fully clothed winter portrait header; White Album 2 uses only a text logo. Civilization VI includes a non-sexual classical stone statue. This review applies only to these exact files, not the games' contents or linked third-party websites.

For a new game or replacement:
1. Prefer an appropriate official promotional image or a safely licensed logo, and verify the game's identity.
2. Download and visually inspect the actual image, not just its title, rating or source URL. Reject nudity, sexualized poses and sexually suggestive artwork; use a clearly labeled neutral title card if an appropriate image cannot be obtained.
3. Store a small asset under `public/images/games/<slug>.<ext>` and update `data/game-images.json` with actual provenance and review information. Never claim an unknown license is open.
4. Keep each file under 200 KB and at most 1200 pixels on either axis. Prefer 460×215, with contain fitting to avoid cropping text/logos.
5. Run `npm test`, `npm run validate`, `npm run check`, and `npm run build`. Check search results, recent games and detail pages on desktop/mobile.

New-game issue imports may omit an artwork registry entry; the built-in neutral title card then appears automatically, without fetching unreviewed images or blocking the report PR. The visible in-page title-card fallback works for absent or failed images and is explicitly labeled as not game footage. `validate-artwork.ts` checks coverage, local paths, dimensions, size and provenance. It does not classify visual content; human visual review is required before changing an asset.
