// Which supported file-browser plugins are installed, from Cockpit's manifests
// map ({ files: {...}, explorer: {...}, ... }). Order = selector order.
export function availableFileBrowsers(manifests) {
  const m = manifests || {};
  const out = [];
  if (m.files) out.push("files");
  if (m.explorer) out.push("explorer");
  return out;
}

// Build a Cockpit shell URL (for cockpit.jump) that opens a filesystem path in
// the chosen file-browser plugin. Pure + unit-tested.
export function fileBrowserUrl(path, browser) {
  const abs = "/" + String(path || "").replace(/^\/+/, "");
  if (browser === "explorer") {
    // Contract with the Explorer plugin: on load / hashchange it reads
    // `open=<url-encoded absolute path>` from its location hash and opens
    // that directory (see docs/explorer-deeplink-prompt.md).
    return "/explorer#open=" + encodeURIComponent(abs);
  }
  // Cockpit Files (default): hash path with each segment individually encoded.
  return "/files#" + abs.split("/").map(encodeURIComponent).join("/");
}
