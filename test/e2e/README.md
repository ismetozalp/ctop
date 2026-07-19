# ctop end-to-end browser test

Drives real headless Chrome through Cockpit into **Tools → Cockpit Top** and
reports what rendered plus any console/page JS errors, with screenshots.

## Setup
1. `npm install` (installs the `playwright-core` devDependency).
2. A Chrome/Chromium binary (default `/usr/bin/google-chrome`, override `CHROME_BIN`).
3. A creds file with two lines — `username` then `password` — kept **out of the repo**:

       mkdir -p ~/.config/claude/ctop-e2e
       printf 'USER\nPASSWORD\n' >| ~/.config/claude/ctop-e2e/creds
       chmod 600 ~/.config/claude/ctop-e2e/creds

   Override the path with `CTOP_E2E_CREDS=/path/to/creds`.
4. ctop installed/served (`make devel-install`) and Cockpit reachable
   (default `https://localhost:9090`, override `CTOP_BASE`).

## Run
    npm run test:e2e
    # or: node test/e2e/ctop_test.mjs

Screenshots land in `test/e2e/out/` (gitignored): `ctop_full.png`,
`ctop_tokyo.png` (theme switch), `ctop_popup.png` (process detail).

## Security
The creds file is plaintext — keep it `chmod 600` and outside the repo. This
harness only reads its *path*; it never prints the password.
