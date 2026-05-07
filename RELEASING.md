# Releasing

## GitHub Release

1. Push this plugin directory as a standalone repository.
2. Confirm `package.json` and `marketplace/logseq-block-to-page-db/manifest.json` use the final GitHub repo name.
3. Open a pull request with a conventional commit subject such as `fix: ...` or `feat: ...`.
4. Merge the pull request into `main`.

The GitHub workflow runs `semantic-release` on `main`. It analyzes conventional
commit subjects, updates `package.json` and `CHANGELOG.md`, creates the
`vX.Y.Z` tag, creates the GitHub Release, and uploads
`logseq-block-to-page-db.zip` plus `package.json`.

The release zip is also used by Logseq web. Keep `package.json`, `index.html`,
and `main.js` at the zip root so the web plugin entry checker can read
`package.json.main` directly.

To verify the zip shape locally:

```sh
npm run build:release
unzip -Z1 release/logseq-block-to-page-db.zip
unzip -p release/logseq-block-to-page-db.zip package.json | jq -r .main
```

Expected output: `index.html`.

## Logseq Marketplace

1. Fork `logseq/marketplace`.
2. Copy `marketplace/logseq-block-to-page-db` into `packages/logseq-block-to-page-db`.
3. Open a pull request to `logseq/marketplace`.

The marketplace manifest marks this plugin as DB graph only.
