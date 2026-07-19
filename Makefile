PREFIX ?= /usr/share/cockpit
NAME = ctop
INSTALL_DIR = $(PREFIX)/$(NAME)
VERSION := $(shell cat VERSION)
TAG := v$(VERSION)
DEVEL_DIR = $(HOME)/.local/share/cockpit/$(NAME)

# Release notes for `make publish`. Override on the command line, e.g.
#   make publish RELEASE_NOTES="Fix the thing"
RELEASE_NOTES ?= Release $(VERSION)
export RELEASE_NOTES

FILES = manifest.json index.html index.css src README.md VERSION Makefile

.PHONY: all help version test install uninstall devel-install devel-uninstall zip publish clean

all: help

help:
	@echo "Cockpit Top (ctop) — version $(VERSION)"
	@echo
	@echo "Targets:"
	@echo "  make install          Copy plugin to $(INSTALL_DIR) (use sudo)"
	@echo "  make uninstall        Remove plugin from $(INSTALL_DIR) (use sudo)"
	@echo "  make devel-install    Symlink into $(DEVEL_DIR) for development (no root)"
	@echo "  make devel-uninstall  Remove the development symlink"
	@echo "  make test             Run the unit tests (node --test)"
	@echo "  make zip              Produce ctop-$(VERSION).zip"
	@echo "  make publish          Build the zip and publish GitHub release $(TAG)"
	@echo "  make version          Print current version"
	@echo "  make clean            Remove build artifacts"

version:
	@echo $(VERSION)

test:
	node --test

install:
	@if [ "$$(id -u)" != "0" ]; then echo "install requires root (use sudo)"; exit 1; fi
	@if [ -d $(INSTALL_DIR) ]; then echo "Removing previous install at $(INSTALL_DIR)"; rm -rf $(INSTALL_DIR); fi
	install -d $(INSTALL_DIR)
	cp -r $(FILES) $(INSTALL_DIR)/
	@echo
	@echo "Installed ctop $(VERSION) to $(INSTALL_DIR)"
	@echo "Restart Cockpit with: systemctl try-restart cockpit"
	@echo "Then reload Cockpit in the browser. Look under 'Tools -> Cockpit Top'."

uninstall:
	@if [ "$$(id -u)" != "0" ]; then echo "uninstall requires root (use sudo)"; exit 1; fi
	rm -rf $(INSTALL_DIR)
	@echo "Removed $(INSTALL_DIR)"

devel-install:
	install -d $(HOME)/.local/share/cockpit
	ln -sfn "$(CURDIR)" $(DEVEL_DIR)
	@echo "Symlinked $(DEVEL_DIR) -> $(CURDIR)"
	@echo "Reload Cockpit in the browser. Look under 'Tools -> Cockpit Top'."

devel-uninstall:
	rm -f $(DEVEL_DIR)
	@echo "Removed $(DEVEL_DIR)"

zip:
	@tmp=$$(mktemp -d); \
	mkdir "$$tmp/$(NAME)"; \
	cp -r $(FILES) "$$tmp/$(NAME)/"; \
	(cd "$$tmp" && zip -rq "$(NAME)-$(VERSION).zip" $(NAME) -x '$(NAME)/$(NAME)-*.zip'); \
	mv "$$tmp/$(NAME)-$(VERSION).zip" .; \
	rm -rf "$$tmp"; \
	echo "Wrote $(NAME)-$(VERSION).zip"

# Build the zip and publish it as a GitHub release tagged $(TAG). The repo is
# detected from the git "origin" remote by the gh CLI. Commit & push first.
publish: zip
	@command -v gh >/dev/null 2>&1 || { echo "gh CLI not found - install it first."; exit 1; }
	@gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated - run: gh auth login"; exit 1; }
	@notes="$$(mktemp)"; trap 'rm -f "$$notes"' EXIT; \
	printf '%s\n' "$$RELEASE_NOTES" > "$$notes"; \
	if gh release view "$(TAG)" >/dev/null 2>&1; then \
	  echo "Release $(TAG) already exists - uploading asset (clobber)"; \
	  gh release upload "$(TAG)" "$(NAME)-$(VERSION).zip" --clobber; \
	  gh release edit "$(TAG)" --notes-file "$$notes"; \
	else \
	  echo "Creating release $(TAG)"; \
	  gh release create "$(TAG)" "$(NAME)-$(VERSION).zip" --title "$(NAME) $(VERSION)" --notes-file "$$notes"; \
	fi
	@echo "Published $(TAG) ($(NAME)-$(VERSION).zip)"

clean:
	rm -f $(NAME)-*.zip $(NAME)-*.tar.gz
