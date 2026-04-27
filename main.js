import { turnBlockIntoPage } from "./src/block-to-page.mjs";

const plugin = window.logseq;

async function run(event) {
  if (!event?.uuid) {
    return;
  }

  await turnBlockIntoPage(plugin, event.uuid);
}

plugin
  .ready(() => {
    plugin.Editor.registerSlashCommand("Turn Into Page", run);
    plugin.Editor.registerBlockContextMenuItem("Turn into page", run);
  })
  .catch(console.error);
