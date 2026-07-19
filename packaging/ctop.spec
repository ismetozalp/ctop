Name:           cockpit-ctop
Version:        0.1.0
Release:        1%{?dist}
Summary:        btop-style system monitor for Cockpit
License:        MIT
BuildArch:      noarch
Requires:       cockpit-bridge >= 215

%description
A native Cockpit plugin that reproduces btop's resource-monitor UI:
CPU, memory/disk, network, and process boxes with gradient braille graphs.

%prep
# sources are provided out-of-tree; nothing to unpack

%install
mkdir -p %{buildroot}%{_datadir}/cockpit/ctop
cp -r %{_sourcedir}/ctop/manifest.json %{_sourcedir}/ctop/index.html \
      %{_sourcedir}/ctop/index.css %{_sourcedir}/ctop/src \
      %{buildroot}%{_datadir}/cockpit/ctop/

%files
%{_datadir}/cockpit/ctop

%changelog
* Sun Jul 19 2026 ismetozalp <ismetozalp@users.noreply.github.com> - 0.1.0-1
- Initial package
