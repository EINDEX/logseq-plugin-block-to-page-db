module.exports = {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", {
      changelogFile: "CHANGELOG.md",
    }],
    ["@semantic-release/exec", {
      prepareCmd: "npm version ${nextRelease.version} --no-git-tag-version && npm run build:release",
    }],
    ["@semantic-release/git", {
      assets: ["package.json", "package-lock.json", "CHANGELOG.md"],
      message: "release: v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
    }],
    ["@semantic-release/github", {
      assets: [
        { path: "release/logseq-block-to-page-db.zip", label: "Logseq plugin zip" },
        { path: "package.json", label: "package.json" },
      ],
    }],
  ],
};
