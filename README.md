# Cockpit Top (ctop)

A btop-style system monitor as a [Cockpit](https://cockpit-project.org/) plugin.
Native web UI (plain ES modules + `<canvas>`, no framework) that reproduces
btop's look: gradient braille graphs, per-core CPU meters, memory/swap/mounts,
disk I/O, auto-scaling network graphs, and a live sortable process table with
kill/signal.

Data comes from Cockpit's built-in `metrics1` internal channel (reads `/proc`
and `/sys`, no PCP required) plus a 2s `ps` poll for the process list.

## Install

    sudo make install
    sudo systemctl try-restart cockpit

Then reload Cockpit in the browser — look under **Tools → Cockpit Top**.

## Development

    make devel-install     # symlink into ~/.local/share/cockpit/ctop (no root, no restart)
    # edit, then reload the browser tab
    make devel-uninstall

## Test

    npm test               # or: node --test  (pure-logic modules)

## Package

    make zip               # ctop-<version>.zip
    rpmbuild -bb packaging/ctop.spec   # noarch RPM (cockpit-ctop)

## Targets

Run `make help` for the full list.
