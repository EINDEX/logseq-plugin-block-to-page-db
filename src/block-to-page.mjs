const exactPageRefPattern = /^\[\[([^\]]+)\]\]$/;
const inlinePageRefPattern = /\[\[([^\]]+)\]\]/g;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function blockContent(block) {
  return typeof block?.content === "string" ? block.content : "";
}

function blockIsBlank(block) {
  return !hasText(blockContent(block));
}

function blockIsCollapsed(block) {
  return Boolean(
    block?.["collapsed?"] ||
      block?.collapsed ||
      block?.properties?.collapsed ||
      block?.properties?.["collapsed?"],
  );
}

function pagePropertiesFromBlock(block) {
  const properties = block?.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      return !["id", "collapsed", "collapsed?"].includes(key) && value !== undefined;
    }),
  );
}

function blockTags(block) {
  return asArray(block?.tags);
}

function tagIdentity(tag) {
  if (typeof tag === "string" || typeof tag === "number") {
    return tag;
  }

  if (Array.isArray(tag)) {
    return tag.at(-1);
  }

  if (tag && typeof tag === "object") {
    return tag.uuid ?? tag.id ?? tag.ident ?? tag.name ?? tag.title;
  }

  return null;
}

export function getConversionPlan(content = "") {
  const sourceContent = String(content);
  const firstLine = (sourceContent.split("\n")[0] ?? "").trim();

  if (!firstLine) {
    return null;
  }

  const exactPageRefMatch = exactPageRefPattern.exec(firstLine);
  const inlinePageRefMatches = [...firstLine.matchAll(inlinePageRefPattern)];
  const inlinePageRefMatch = inlinePageRefMatches.at(-1);
  const pageRefMatch = inlinePageRefMatch ?? exactPageRefMatch;
  const pageName = pageRefMatch ? pageRefMatch[1] : firstLine;

  if (!hasText(pageName)) {
    return null;
  }

  return {
    pageName,
    usesExistingPageRef: Boolean(inlinePageRefMatch || exactPageRefMatch),
    nextSourceContent: inlinePageRefMatch || exactPageRefMatch
      ? null
      : sourceContent.replace(firstLine, `[[${firstLine}]]`),
  };
}

function pageNameFromBlock(block) {
  const page = block?.page;
  if (typeof page === "string") {
    return page.trim();
  }

  return (
    page?.originalName ??
    page?.name ??
    page?.title ??
    ""
  ).trim();
}

function getCurrentPagePlan(block) {
  const pageName = pageNameFromBlock(block);
  if (!hasText(pageName)) {
    return null;
  }

  return {
    pageName,
    usesExistingPageRef: true,
    nextSourceContent: null,
  };
}

async function getPageBlocks(editor, pageName) {
  return asArray(await editor.getPageBlocksTree(pageName));
}

async function addTagsToPage(editor, page, tags) {
  if (typeof editor.addBlockTag !== "function" || !page?.uuid) {
    return;
  }

  for (const tag of tags) {
    const identity = tagIdentity(tag);
    if (identity) {
      await editor.addBlockTag(page.uuid, identity);
    }
  }
}

async function removePropertiesFromBlock(editor, block, properties) {
  if (typeof editor.removeBlockProperty !== "function" || !block?.uuid) {
    return;
  }

  for (const propertyName of Object.keys(properties)) {
    await editor.removeBlockProperty(block.uuid, propertyName);
  }
}

async function removeTagsFromBlock(editor, block, tags) {
  if (typeof editor.removeBlockTag !== "function" || !block?.uuid) {
    return;
  }

  for (const tag of tags) {
    const identity = tagIdentity(tag);
    if (identity) {
      await editor.removeBlockTag(block.uuid, identity);
    }
  }
}

async function removeMetadataFromBlock(editor, block, metadata) {
  await removePropertiesFromBlock(editor, block, metadata?.properties ?? {});
  await removeTagsFromBlock(editor, block, metadata?.tags ?? []);
}

async function createPageIfNeeded(editor, pageName, metadata) {
  const page = await editor.getPage(pageName);
  if (page) {
    return { page, created: false };
  }

  const pageProperties = metadata?.properties ?? {};
  const newPage = await editor.createPage(
    pageName,
    pageProperties,
    { createFirstBlock: true, redirect: false },
  );
  if (!newPage) {
    return { page: null, created: false };
  }

  await addTagsToPage(editor, newPage, metadata?.tags ?? []);

  return { page: newPage, created: true };
}

async function appendEmptyAnchor(editor, pageName, page) {
  if (typeof editor.appendBlockInPage === "function") {
    const block = await editor.appendBlockInPage(pageName, "", { sibling: false });
    if (block) {
      return block;
    }
  }

  if (typeof editor.insertBlock === "function" && page?.uuid) {
    const block = await editor.insertBlock(page.uuid, "", { sibling: false });
    if (block) {
      return block;
    }
  }

  const blocks = await getPageBlocks(editor, pageName);
  return blocks.at(-1) ?? null;
}

async function getTargetAnchor(editor, pageName, metadata) {
  const { page, created } = await createPageIfNeeded(editor, pageName, metadata);
  if (!page) {
    return { anchor: null, created: false };
  }

  const blocks = await getPageBlocks(editor, pageName);

  if (blocks.length > 0) {
    return { anchor: blocks.at(-1), created };
  }

  return {
    anchor: await appendEmptyAnchor(editor, pageName, page),
    created,
  };
}

async function expandSourceBlockIfNeeded(editor, block) {
  if (!blockIsCollapsed(block)) {
    return;
  }

  if (typeof editor.setBlockCollapsed === "function") {
    await editor.setBlockCollapsed(block.uuid, false);
    return;
  }

  if (typeof editor.removeBlockProperty === "function") {
    await editor.removeBlockProperty(block.uuid, "collapsed");
  }
}

async function turnBlockWithPlan(logseq, blockId, getPlan) {
  const editor = logseq?.Editor;
  if (!editor) {
    throw new Error("Logseq Editor API is unavailable.");
  }

  const block = await editor.getBlock(blockId, { includeChildren: true });
  const children = asArray(block?.children);

  if (!block || children.length === 0) {
    return { status: "skipped" };
  }

  const plan = getPlan(block);
  if (!plan) {
    return { status: "skipped" };
  }

  const metadata = plan.usesExistingPageRef
    ? {}
    : {
        properties: pagePropertiesFromBlock(block),
        tags: blockTags(block),
      };
  const target = await getTargetAnchor(editor, plan.pageName, metadata);
  const targetAnchor = target.anchor;
  if (!targetAnchor?.uuid) {
    await logseq?.App?.showMsg?.("target page error", "error");
    return { status: "failed" };
  }

  let targetUuid = targetAnchor.uuid;
  for (const child of children) {
    try {
      await editor.moveBlock(child.uuid, targetUuid, {
        children: false,
        before: false,
      });
      targetUuid = child.uuid;
    } catch (error) {
      console.error("moveBlock error", error);
      await logseq?.App?.showMsg?.("move block error", "error");
      return { status: "failed", error };
    }
  }

  if (blockIsBlank(targetAnchor)) {
    await editor.removeBlock(targetAnchor.uuid);
  }

  if (plan.nextSourceContent) {
    await editor.updateBlock(block.uuid, plan.nextSourceContent);
  }

  if (target.created) {
    try {
      await removeMetadataFromBlock(editor, block, metadata);
    } catch (error) {
      console.error("remove metadata error", error);
      await logseq?.App?.showMsg?.("metadata cleanup error", "warning");
    }
  }

  await editor.exitEditingMode?.();
  await expandSourceBlockIfNeeded(editor, block);

  return { status: "ok", pageName: plan.pageName };
}

export async function turnBlockIntoPage(logseq, blockId) {
  return turnBlockWithPlan(logseq, blockId, (block) => getConversionPlan(blockContent(block)));
}

export async function turnBlockIntoCurrentPage(logseq, blockId) {
  return turnBlockWithPlan(logseq, blockId, getCurrentPagePlan);
}
