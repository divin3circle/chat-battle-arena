SHELL := /bin/bash

BACKEND_DIR := chat-battle-arena-backend
OVERLAY_DIR := chat-battle-arena-overlay
EXTENSION_DIR := chat-battle-arena-extension-config

BACKEND_HOST ?= 127.0.0.1
BACKEND_PORT ?= 8010
OVERLAY_PORT ?= 3002
EXTENSION_PORT ?= 3003
BACKEND_URL ?= http://$(BACKEND_HOST):$(BACKEND_PORT)
PYTHON ?= python3

.PHONY: help setup setup-backend setup-overlay backend overlay extension clean-runtime

help:
	@echo "Chat Battle Arena commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          Install backend and overlay dependencies"
	@echo "  make setup-backend  Create backend venv and install Python deps"
	@echo "  make setup-overlay  Install overlay Node deps"
	@echo ""
	@echo "Run services in separate terminals:"
	@echo "  make backend        Start API/socket server on $(BACKEND_URL)"
	@echo "  make overlay        Start standalone overlay on http://localhost:$(OVERLAY_PORT)"
	@echo "  make extension      Serve Twitch extension assets on http://localhost:$(EXTENSION_PORT)"
	@echo ""
	@echo "Variables:"
	@echo "  BACKEND_PORT=8010 OVERLAY_PORT=3002 EXTENSION_PORT=3003 BACKEND_URL=http://127.0.0.1:8010"

setup: setup-backend setup-overlay

setup-backend:
	cd $(BACKEND_DIR) && $(PYTHON) -m venv .venv
	cd $(BACKEND_DIR) && .venv/bin/python -m pip install --upgrade pip setuptools wheel
	cd $(BACKEND_DIR) && grep -v '^mysqlclient' requirements.txt | .venv/bin/pip install -r /dev/stdin
	@if [ ! -f $(BACKEND_DIR)/.env ]; then cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; fi

setup-overlay:
	cd $(OVERLAY_DIR) && npm install

backend:
	cd $(BACKEND_DIR) && .venv/bin/python -m uvicorn main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT)

overlay:
	cd $(OVERLAY_DIR) && BACKEND_URL=$(BACKEND_URL) PORT=$(OVERLAY_PORT) npm start

extension:
	cd $(EXTENSION_DIR) && $(PYTHON) -m http.server $(EXTENSION_PORT)

clean-runtime:
	rm -f $(BACKEND_DIR)/*.db $(BACKEND_DIR)/*.sqlite $(BACKEND_DIR)/*.sqlite3
	find $(BACKEND_DIR) -type d -name '__pycache__' -prune -exec rm -rf {} +
