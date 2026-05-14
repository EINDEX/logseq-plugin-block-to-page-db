import {
  turnBlockIntoCurrentPage,
  turnBlockIntoPage,
} from "./src/block-to-page.mjs";

const plugin = window.logseq;

async function run(event, handler) {
  if (!event?.uuid) {
    return;
  }

  await handler(plugin, event.uuid);
}

plugin
  .ready(() => {
    plugin.Editor.registerSlashCommand("Turn Into Page", (event) => run(event, turnBlockIntoPage));
    plugin.Editor.registerSlashCommand("Turn Into Current Page", (event) => run(event, turnBlockIntoCurrentPage));
    plugin.Editor.registerBlockContextMenuItem("Turn into page", (event) => run(event, turnBlockIntoPage));
    plugin.Editor.registerBlockContextMenuItem("Turn into current page", (event) => run(event, turnBlockIntoCurrentPage));
  })
  .catch(console.error);
