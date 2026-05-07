# Releasing

## GitHub Release

1. Push this plugin directory as a standalone repository.
2. Confirm `package.json` and `marketplace/logseq-block-to-page-db/manifest.json` use the final GitHub repo name.
3. Run:

```sh
npm run check
```

4. Create a semver release commit and tag:

```sh
npm run release:patch
git push origin main --follow-tags
```

Use `release:minor` or `release:major` when the release scope calls for it.

The GitHub workflow uploads `logseq-block-to-page-db.zip` and `package.json` to the release.

The release zip is also used by Logseq web. Keep `package.json`, `index.html`,
and `main.js` at the zip root so the web plugin entry checker can read
`package.json.main` directly.

To verify the zip shape locally:

```sh
PLUGIN_NAME=logseq-block-to-page-db
rm -rf release
mkdir -p release/stage
cp -R README.md LICENSE package.json icon.svg index.html main.js src vendor assets release/stage/
(cd release/stage && zip -r "../${PLUGIN_NAME}.zip" README.md LICENSE package.json icon.svg index.html main.js src vendor assets)
unzip -Z1 "release/${PLUGIN_NAME}.zip"
unzip -p "release/${PLUGIN_NAME}.zip" package.json | jq -r .main
```

Expected output: `index.html`.

## Logseq Marketplace

1. Fork `logseq/marketplace`.
2. Copy `marketplace/logseq-block-to-page-db` into `packages/logseq-block-to-page-db`.
3. Open a pull request to `logseq/marketplace`.

The marketplace manifest marks this plugin as DB graph only.
