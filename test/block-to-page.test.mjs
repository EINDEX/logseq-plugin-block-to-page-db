import test from "node:test";
import assert from "node:assert/strict";

import {
  getConversionPlan,
  turnBlockIntoCurrentPage,
  turnBlockIntoPage,
} from "../src/block-to-page.mjs";

function createLogseqMock({
  block,
  pageBlocks = [],
  page = { uuid: "page-1" },
  createdPage = { uuid: "created-page" },
  moveError = null,
} = {}) {
  const calls = [];
  const editor = {
    async getBlock(id, opts) {
      calls.push(["getBlock", id, opts]);
      return block;
    },
    async getPage(name) {
      calls.push(["getPage", name]);
      return page;
    },
    async createPage(name, properties, opts) {
      calls.push(["createPage", name, properties, opts]);
      page = createdPage ? { ...createdPage, name } : null;
      return page;
    },
    async addBlockTag(blockId, tagId) {
      calls.push(["addBlockTag", blockId, tagId]);
    },
    async getPageBlocksTree(name) {
      calls.push(["getPageBlocksTree", name]);
      return pageBlocks;
    },
    async appendBlockInPage(name, content, opts) {
      calls.push(["appendBlockInPage", name, content, opts]);
      const anchor = { uuid: "anchor-1", content };
      pageBlocks = [anchor];
      return anchor;
    },
    async moveBlock(src, target, opts) {
      calls.push(["moveBlock", src, target, opts]);
      if (moveError) throw moveError;
    },
    async removeBlock(uuid) {
      calls.push(["removeBlock", uuid]);
    },
    async removeBlockTag(blockId, tagId) {
      calls.push(["removeBlockTag", blockId, tagId]);
    },
    async removeBlockProperty(blockId, propertyName) {
      calls.push(["removeBlockProperty", blockId, propertyName]);
    },
    async updateBlock(uuid, content) {
      calls.push(["updateBlock", uuid, content]);
    },
    async exitEditingMode() {
      calls.push(["exitEditingMode"]);
    },
    async setBlockCollapsed(uuid, flag) {
      calls.push(["setBlockCollapsed", uuid, flag]);
    },
  };

  return {
    calls,
    logseq: {
      Editor: editor,
      App: {
        async showMsg(message, status) {
          calls.push(["showMsg", message, status]);
        },
      },
    },
  };
}

test("getConversionPlan wraps a plain first line as a page reference", () => {
  assert.deepEqual(getConversionPlan("Project Alpha\nnotes"), {
    pageName: "Project Alpha",
    usesExistingPageRef: false,
    nextSourceContent: "[[Project Alpha]]\nnotes",
  });
});

test("getConversionPlan keeps an existing page reference unchanged", () => {
  assert.deepEqual(getConversionPlan("[[Project Alpha]]\nnotes"), {
    pageName: "Project Alpha",
    usesExistingPageRef: true,
    nextSourceContent: null,
  });
});

test("getConversionPlan uses an inline page reference and keeps source content unchanged", () => {
  assert.deepEqual(getConversionPlan("task should be done [[Project ABC]]"), {
    pageName: "Project ABC",
    usesExistingPageRef: true,
    nextSourceContent: null,
  });
});

test("getConversionPlan uses the last inline page reference", () => {
  assert.deepEqual(getConversionPlan("Fix [[Issue 123]] for [[Project ABC]]"), {
    pageName: "Project ABC",
    usesExistingPageRef: true,
    nextSourceContent: null,
  });
});

test("turnBlockIntoPage creates an anchor for an empty target page and moves children in order", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "Project Alpha\nnotes",
      children: [{ uuid: "child-1" }, { uuid: "child-2" }],
      "collapsed?": true,
    },
    pageBlocks: [],
    page: null,
  });

  await turnBlockIntoPage(logseq, "source-1");

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "Project Alpha"],
    ["createPage", "Project Alpha", {}, { createFirstBlock: true, redirect: false }],
    ["getPageBlocksTree", "Project Alpha"],
    ["appendBlockInPage", "Project Alpha", "", { sibling: false }],
    ["moveBlock", "child-1", "anchor-1", { children: false, before: false }],
    ["moveBlock", "child-2", "child-1", { children: false, before: false }],
    ["removeBlock", "anchor-1"],
    ["updateBlock", "source-1", "[[Project Alpha]]\nnotes"],
    ["exitEditingMode"],
    ["setBlockCollapsed", "source-1", false],
  ]);
});

test("turnBlockIntoPage moves source metadata when creating a page from plain text", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "Project Alpha",
      properties: { status: "active", id: "source-block-id" },
      tags: [{ uuid: "tag-project" }],
      children: [{ uuid: "child-1" }],
    },
    pageBlocks: [],
    page: null,
  });

  await turnBlockIntoPage(logseq, "source-1");

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "Project Alpha"],
    ["createPage", "Project Alpha", { status: "active" }, { createFirstBlock: true, redirect: false }],
    ["addBlockTag", "created-page", "tag-project"],
    ["getPageBlocksTree", "Project Alpha"],
    ["appendBlockInPage", "Project Alpha", "", { sibling: false }],
    ["moveBlock", "child-1", "anchor-1", { children: false, before: false }],
    ["removeBlock", "anchor-1"],
    ["updateBlock", "source-1", "[[Project Alpha]]"],
    ["removeBlockProperty", "source-1", "status"],
    ["removeBlockTag", "source-1", "tag-project"],
    ["exitEditingMode"],
  ]);
});

test("turnBlockIntoPage stops when page creation returns null", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "Project Alpha",
      properties: { status: "active" },
      tags: [{ uuid: "tag-project" }],
      children: [{ uuid: "child-1" }],
    },
    pageBlocks: [],
    page: null,
    createdPage: null,
  });

  await turnBlockIntoPage(logseq, "source-1");

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "Project Alpha"],
    ["createPage", "Project Alpha", { status: "active" }, { createFirstBlock: true, redirect: false }],
    ["showMsg", "target page error", "error"],
  ]);
});

test("turnBlockIntoPage reuses an existing plain target page without copying metadata", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "Project Alpha",
      properties: { status: "active" },
      tags: [{ uuid: "tag-project" }],
      children: [{ uuid: "child-1" }],
    },
    pageBlocks: [{ uuid: "last-1", content: "existing" }],
    page: { uuid: "page-1", name: "Project Alpha" },
  });

  await turnBlockIntoPage(logseq, "source-1");

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "Project Alpha"],
    ["getPageBlocksTree", "Project Alpha"],
    ["moveBlock", "child-1", "last-1", { children: false, before: false }],
    ["updateBlock", "source-1", "[[Project Alpha]]"],
    ["exitEditingMode"],
  ]);
});

test("turnBlockIntoPage keeps source metadata on explicit page references", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "task should be done [[Project ABC]]",
      properties: { status: "active" },
      tags: [{ uuid: "tag-project" }],
      children: [{ uuid: "child-1" }],
    },
    pageBlocks: [],
    page: null,
  });

  await turnBlockIntoPage(logseq, "source-1");

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "Project ABC"],
    ["createPage", "Project ABC", {}, { createFirstBlock: true, redirect: false }],
    ["getPageBlocksTree", "Project ABC"],
    ["appendBlockInPage", "Project ABC", "", { sibling: false }],
    ["moveBlock", "child-1", "anchor-1", { children: false, before: false }],
    ["removeBlock", "anchor-1"],
    ["exitEditingMode"],
  ]);
});

test("turnBlockIntoCurrentPage uses the source page as the target and keeps source content", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "Task should be done",
      page: { name: "2026-05-15" },
      properties: { status: "active" },
      tags: [{ uuid: "tag-project" }],
      children: [{ uuid: "child-1" }],
    },
    pageBlocks: [{ uuid: "last-1", content: "existing" }],
    page: { uuid: "page-1", name: "2026-05-15" },
  });

  await turnBlockIntoCurrentPage(logseq, "source-1");

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "2026-05-15"],
    ["getPageBlocksTree", "2026-05-15"],
    ["moveBlock", "child-1", "last-1", { children: false, before: false }],
    ["exitEditingMode"],
  ]);
});

test("turnBlockIntoPage appends to the last block when the target page already has blocks", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "[[Project Alpha]]",
      children: [{ uuid: "child-1" }],
    },
    pageBlocks: [{ uuid: "last-1", content: "existing" }],
  });

  await turnBlockIntoPage(logseq, "source-1");

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "Project Alpha"],
    ["getPageBlocksTree", "Project Alpha"],
    ["moveBlock", "child-1", "last-1", { children: false, before: false }],
    ["exitEditingMode"],
  ]);
});

test("turnBlockIntoPage reports a move failure and leaves later changes untouched", async () => {
  const { logseq, calls } = createLogseqMock({
    block: {
      uuid: "source-1",
      content: "Project Alpha",
      children: [{ uuid: "child-1" }],
    },
    pageBlocks: [{ uuid: "last-1", content: "existing" }],
    moveError: new Error("boom"),
  });

  const originalError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args);

  try {
    await turnBlockIntoPage(logseq, "source-1");
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(calls, [
    ["getBlock", "source-1", { includeChildren: true }],
    ["getPage", "Project Alpha"],
    ["getPageBlocksTree", "Project Alpha"],
    ["moveBlock", "child-1", "last-1", { children: false, before: false }],
    ["showMsg", "move block error", "error"],
  ]);
  assert.equal(errors.length, 1);
});
