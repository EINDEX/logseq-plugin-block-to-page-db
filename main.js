import {
  turnBlockIntoPageWithSource,
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
    plugin.Editor.registerSlashCommand("Turn Into Page With Source", (event) => run(event, turnBlockIntoPageWithSource));
    plugin.Editor.registerBlockContextMenuItem("Turn into page", (event) => run(event, turnBlockIntoPage));
    plugin.Editor.registerBlockContextMenuItem("Turn into page with source", (event) => run(event, turnBlockIntoPageWithSource));
  })
  .catch(console.error);
