import os
import json
from datetime import datetime

# Determine storage location – a lightweight JSON lines file in the project root
DB_FILE = os.path.join(os.path.dirname(__file__), "messages.log")

def _ensure_file():
    """Create the log file if it doesn't exist."""
    if not os.path.exists(DB_FILE):
        # Create an empty file
        open(DB_FILE, "a", encoding="utf-8").close()

def save_message(name: str, number: str, text: str, status: str, date: str, time: str, extra: str = ""):
    """Append a message record to the JSON‑lines log.

    Parameters
    ----------
    name: str
        Sender name.
    number: str
        Phone number (without country code if stripped).
    text: str
        Message content.
    status: str
        Arbitrary status placeholder (e.g., "MATCH").
    date: str
        Date string as provided by the bot.
    time: str
        Time string as provided by the bot.
    extra: str, optional
        Any additional data you may want to store.
    """
    _ensure_file()
    record = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "name": name,
        "number": number,
        "text": text,
        "status": status,
        "date": date,
        "time": time,
        "extra": extra,
    }
    # Append as a single JSON line for easy later parsing
    with open(DB_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")
    return True
