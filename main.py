from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from database import save_message
import os, shutil, httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

clients: list[WebSocket] = []

class Message(BaseModel):
    name: str
    number: str
    text: str
    date: str
    time: str

class SystemEvent(BaseModel):
    event: str
    data: str

class GeminiReplyRequest(BaseModel):
    api_key: str
    system_prompt: str
    user_message: str
    sender_number: str

class SyncConfigPayload(BaseModel):
    keyword:            Optional[str] = None
    trackOnlyKeywords:  Optional[str] = None
    customReply:        Optional[str] = None
    autoReplyEnabled:   Optional[bool] = None
    geminiEnabled:      Optional[bool] = None
    geminiApiKey:       Optional[str] = None
    geminiSystemPrompt: Optional[str] = None
    mediaPath:          Optional[str] = None
    mediaCaption:       Optional[str] = None
    newUserMode:        Optional[str] = None  # "all" | "keyword_only"

@app.get("/", response_class=HTMLResponse)
async def get_dashboard():
    if os.path.exists("index.html"):
        with open("index.html", "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>index.html file nahi mili!</h1>"

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, Exception):
        if ws in clients:
            clients.remove(ws)

@app.post("/message")
async def receive_message(data: Message):
    save_message(data.name, data.number, data.text, "MATCH", data.date, data.time, "")
    payload = {
        "type": "NEW_MESSAGE",
        "name": data.name,
        "number": data.number,
        "text": data.text,
        "date": data.date,
        "time": data.time,
        "direction": "Incoming" if data.name != "AI Engine" and data.name != "Gemini AI" else "Outbound",
    }
    dead = []
    for c in clients:
        try:    await c.send_json(payload)
        except: dead.append(c)
    for c in dead:
        if c in clients: clients.remove(c)
    return {"success": True}

@app.post("/system-event")
async def receive_system_event(event_data: SystemEvent):
    payload = {"type": "SYSTEM_NOTIFICATION", "event": event_data.event, "data": event_data.data}
    dead = []
    for c in clients:
        try:    await c.send_json(payload)
        except: dead.append(c)
    for c in dead:
        if c in clients: clients.remove(c)
    return {"success": True}

@app.post("/sync-config")
async def sync_config(payload: SyncConfigPayload):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post("http://localhost:9000/sync-config", json=payload.dict(exclude_none=True))
            return res.json()
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/gemini-reply")
async def gemini_reply(req: GeminiReplyRequest):
    if not req.api_key or req.api_key.strip() == "":
        return {"success": False, "reply": "", "error": "API key missing"}
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={req.api_key}"
    body = {"contents": [{"role": "user", "parts": [{"text": f"{req.system_prompt}\n\nUser message: {req.user_message}"}]}]}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(gemini_url, json=body)
            json_res = res.json()
        if "candidates" in json_res and json_res["candidates"]:
            reply_text = json_res["candidates"][0]["content"]["parts"][0]["text"]
            broadcast = {"type": "SYSTEM_NOTIFICATION", "event": "GEMINI_REPLY_SENT",
                         "data": f"To {req.sender_number}: {reply_text[:80]}..."}
            dead = []
            for c in clients:
                try:    await c.send_json(broadcast)
                except: dead.append(c)
            for c in dead:
                if c in clients: clients.remove(c)
            return {"success": True, "reply": reply_text}
        elif "error" in json_res:
            return {"success": False, "reply": "", "error": json_res["error"].get("message", "Unknown error")}
    except Exception as e:
        return {"success": False, "reply": "", "error": str(e)}