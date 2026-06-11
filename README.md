# WhatsApp Business AI Automation Dashboard

A **premium‑looking** single‑page web dashboard that visualises real‑time WhatsApp message activity, supports keyword‑based auto‑replies, and integrates with **Gemini AI** for smart replies.

## Project structure
```
whatsapp-dashboard/
├─ index.html          # Front‑end UI (pure HTML + vanilla CSS + JS)
├─ main.py             # FastAPI backend – serves the HTML and pushes WS events
├─ requirements.txt    # Python dependencies
├─ app.js              # Node.js WhatsApp bot (Baileys) – forwards inbound messages to FastAPI
├─ package.json        # Node dependencies & scripts
└─ README.md           # This file
```

## Prerequisites
- **Python 3.10+**
- **Node 20+** (npm comes with it)
- A working WhatsApp number and the Baileys library will handle QR‑code login.

## Setup & run (Windows)
```powershell
# 1️⃣ Clone / create the folder (already created for you)
cd C:\Users\Nishu\.gemini\antigravity\scratch\whatsapp-dashboard

# 2️⃣ Python backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
# Run FastAPI (exposes the dashboard at http://localhost:8000)
uvicorn main:app --reload
```
Open a new terminal for the Node bot:
```powershell
# 3️⃣ Node WhatsApp bot
npm install     # installs @whiskeysockets/baileys, express, axios, pino, qrcode-terminal
node app.js     # will show a QR code in the console – scan it with your phone
```

The dashboard automatically connects to the WebSocket (`ws://localhost:8000/ws`) and will start showing live messages once the bot forwards them via the `/message` endpoint.

## How it works
- **Node bot (`app.js`)** listens for incoming WhatsApp messages. When a message matches the configured keyword it POSTs to the FastAPI `/message` endpoint.
- **FastAPI (`main.py`)** saves the payload (placeholder `save_message` stub) and forwards it to all connected browsers over a WebSocket.
- **Front‑end (`index.html`)** receives the WS payload, updates counters, renders keywords, and offers simulation, CSV export, and UI controls.

## Customisation
- Edit `CRM_CONFIG` in `app.js` to change the trigger keyword, allowed numbers, or mode (`both`, `self`, `others`).
- Provide a Gemini API key in the UI to enable AI‑driven replies.
- Extend the backend with a real database by implementing `save_message` in `database.py`.

---
*Designed with rich colour palettes, glass‑morphism cards, micro‑animations, and responsive layout for a premium feel.*
