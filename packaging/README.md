# Packaging ctop

## Quick manual install (no RPM)
    sudo mkdir -p /usr/share/cockpit/ctop
    sudo cp -r manifest.json index.html index.css src /usr/share/cockpit/ctop/

## Build noarch RPM
    mkdir -p ~/rpmbuild/SOURCES/ctop
    cp -r manifest.json index.html index.css src ~/rpmbuild/SOURCES/ctop/
    rpmbuild -bb packaging/ctop.spec
    # -> ~/rpmbuild/RPMS/noarch/cockpit-ctop-1.0.0-1.*.noarch.rpm
