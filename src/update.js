// Self-update from GitHub releases — mirrors the Explorer plugin's mechanism.
// Checks the configured repo's latest release; if newer, downloads the
// ctop-<version>.zip asset and runs a privileged install (unzip -> make install
// -> restart cockpit). Pure version helpers are exported for unit testing.

export function versionTuple(v) {
  return String(v).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
}
export function isNewer(a, b) {
  const x = versionTuple(a), y = versionTuple(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}
// Normalise "https://github.com/owner/repo(.git)" or "owner/repo" -> "owner/repo".
export function normalizeRepo(r) {
  let s = String(r || "").trim();
  const m = s.match(/github\.com[/:]([^/]+\/[^/#?]+)/i);
  if (m) s = m[1];
  return s.replace(/\.git$/i, "").replace(/\/+$/, "");
}
function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

export class Updater {
  constructor({ repo, name = "ctop" } = {}) {
    this.repo = normalizeRepo(repo);
    this.name = name;
    this.current = null;
  }

  // The plugin's own VERSION file (served next to index.html), with sysfs fallbacks.
  async loadCurrentVersion() {
    try {
      const r = await fetch("VERSION", { cache: "no-store" });
      if (r.ok) { this.current = (await r.text()).trim(); if (this.current) return this.current; }
    } catch (e) { /* fall through */ }
    if (window.cockpit) {
      for (const p of ["/usr/share/cockpit/" + this.name + "/VERSION", "/usr/local/share/cockpit/" + this.name + "/VERSION"]) {
        try { const t = await window.cockpit.file(p).read(); if (t && t.trim()) { this.current = t.trim(); return this.current; } } catch (e) { /* next */ }
      }
    }
    return this.current;
  }

  // Latest release via server-side gh (if present) else anonymous curl.
  async latestRelease() {
    if (!this.repo || !this.repo.includes("/")) throw new Error("update repo not configured");
    const api = "https://api.github.com/repos/" + this.repo + "/releases/latest";
    let out;
    try {
      out = await window.cockpit.spawn(["gh", "api", "repos/" + this.repo + "/releases/latest"], { err: "message" });
    } catch (e) {
      out = await window.cockpit.spawn(["sh", "-c", "curl -fsSL " + shq(api)], { err: "message" });
    }
    const j = JSON.parse(out);
    if (!j || !j.tag_name) return null;
    return { tag: j.tag_name, version: String(j.tag_name).replace(/^v/i, ""), assets: j.assets || [] };
  }

  // { available, latest, current }
  async check() {
    if (!this.current) await this.loadCurrentVersion();
    const latest = await this.latestRelease();
    const available = !!(latest && this.current && isNewer(latest.version, this.current));
    return { available, latest, current: this.current };
  }

  // Privileged install of a release. Streams output; onData(text), onClose(opts).
  // Returns the channel so callers can close it. superuser:"require" -> admin.
  installStream(rel, onData, onClose) {
    const asset = (rel.assets || []).find((a) => /^ctop-.*\.zip$/.test(a.name));
    const dl = asset
      ? 'curl -fsSL -o "$Z" ' + shq(asset.browser_download_url)
      : "env GH_PROMPT_DISABLED=1 gh release download " + shq(rel.tag) + " -R " + shq(this.repo) +
        " --pattern 'ctop-*.zip' --clobber -O \"$Z\"";
    const cmd =
      'set -e; T=$(mktemp -d); Z="$T/ctop.zip"; ' + dl + "; " +
      'unzip -oq "$Z" -d "$T"; ' +
      'D=$(dirname "$(find "$T" -name Makefile -path "*/ctop/*" | head -1)"); [ -n "$D" ] || D="$T/ctop"; ' +
      'make -C "$D" install; rm -rf "$T"; ' +
      'echo "Installed. Restarting Cockpit…"; ' +
      "(sleep 2; systemctl restart cockpit || systemctl restart cockpit.socket) >/dev/null 2>&1 &";
    const ch = window.cockpit.channel({ payload: "stream", spawn: ["sh", "-c", cmd], superuser: "require", err: "out" });
    ch.addEventListener("message", (_e, d) => onData(typeof d === "string" ? d : new TextDecoder().decode(d)));
    ch.addEventListener("close", (_e, opts) => onClose(opts || {}));
    return ch;
  }
}
