# Prompt: add a deep-link "open this directory" entry point to the Explorer plugin

Paste the block below to the Explorer plugin's AI.

---

Add a **deep-link entry point** so another Cockpit plugin can tell Explorer to open a specific directory.

**Who calls it & how.** A sibling Cockpit plugin ("Cockpit Top" / ctop) navigates the Cockpit shell to Explorer with:

```js
cockpit.jump("/explorer#open=" + encodeURIComponent(absolutePath));
// e.g. cockpit.jump("/explorer#open=%2Fhome%2Fismet")  -> opens /home/ismet
```

`cockpit.jump` switches the shell to the Explorer component and sets **Explorer's iframe location hash** to `#open=<url-encoded absolute path>`. Explorer must react to that hash.

**What to implement in Explorer:**

1. On **startup** (after the app/tabs are ready) **and** on every **`hashchange`** event, parse the location hash for an `open=` parameter:
   ```js
   function openParamFromHash() {
     const h = (window.location.hash || "").replace(/^#/, "");
     // hash may be "open=%2F..." or "/?open=..." or contain other params —
     // scan robustly:
     const m = h.match(/(?:^|[#/?&])open=([^&]+)/);
     return m ? decodeURIComponent(m[1]) : null;
   }
   ```
2. If a path is present:
   - If it's an existing **directory**, open it (open a **new tab** for it, or navigate the active tab) and **focus** that tab.
   - If it's a **file**, open its **parent directory** and select/scroll to the file (optional but nice).
   - If the path doesn't exist or isn't accessible, show a small toast/notification (e.g. "Path not accessible: …") rather than failing silently. Reading another user's path may require the user's Administrative access — surface that if relevant.
3. After handling it, **clear the `open=` param from the hash** (e.g. `history.replaceState(null, "", "#" + hashWithoutOpen)`) so a page reload doesn't re-open it and so it doesn't clobber Explorer's own tab-persistence hash state.
4. Make it **idempotent / de-duped**: if the same `open=` value fires twice (initial read + a hashchange for the same value), only open it once.

**Constraints / notes:**
- Paths are absolute and URL-encoded (each call uses `encodeURIComponent` on the whole path, so slashes are `%2F`). Decode with `decodeURIComponent`.
- Don't break Explorer's existing hash-based tab persistence — only consume the `open=` key and leave any other hash content intact.
- CSP: this is pure client-side navigation (reading `location.hash`); no network permissions needed.
- Keep it resilient: wrap the read/open in try/catch so a malformed hash never throws during startup.

**Acceptance:** From another tab, running `cockpit.jump("/explorer#open=" + encodeURIComponent("/etc"))` switches to Explorer and opens `/etc` in a focused tab; the hash no longer contains `open=` afterward; doing it again re-opens `/etc` (one tab, focused) without duplicating.
