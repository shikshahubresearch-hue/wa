const {
    default: makeWASocket,
    useMultiFileAuthState
} = require("@whiskeysockets/baileys")

const http = require("http");
const WebSocket = require("ws");
const qrcode = require("qrcode-terminal")
const axios = require("axios")
const express = require("express")
const cors = require("cors") // ✅ Yeh line add ki
const P = require("pino")
const fs = require("fs")         
const path = require("path")     

const app = express()
app.use(cors()) // ✅ Yeh line add ki (CORS Policy fix ke liye)
app.use(express.json())


// Server.js mein ye add karein
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Server ko bataiye ki 'public' folder ke andar files hain
app.use(express.static('public'));

// Ab aapko alag se app.get('/dashboard.html') likhne ki zarurat nahi hai, 
// express automatic public folder mein file dhund lega.

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth")

    sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    // ✅ YAHAN PASTE KAREIN / UPDATE KAREIN:
    sock.ev.on("connection.update", (update) => {
        const { qr, connection } = update;
        
        if (qr) {
            qrData = qr; // Web ke liye global variable update ho raha hai
            qrcode.generate(qr, { small: true }); // Terminal mein dikhane ke liye
        }
        
        if (connection === "open") {
            isConnected = true;
            qrData = null; // Scan hote hi web se QR hata dein
            console.log("WHATSAPP CONNECTED ✅");
        }
        
        if (connection === "close") {
            isConnected = false;
            // Connection toote toh dobara start karein
            startBot(); 
        }
    });

    // ... baaki ka message listener wala code yahan rahega
}





// --- YAHAN PASTE KAREIN (app.use(express.json()) ke baad) ---
app.post("/login", (req, res) => {
    const { user, pass } = req.body;
    // Aap apna admin/password yahan change kar sakte hain
    if (user === "admin" && pass === "12345") {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

app.get("/status", (req, res) => {
    // Ye variable aapke code mein pehle se hone chahiye
    res.json({ 
        connected: (typeof isConnected !== 'undefined' ? isConnected : false), 
        qr: (typeof qrData !== 'undefined' ? qrData : null) 
    });
});
// -------------------------------------------------------------




// 🟢 NEW: HTML Dashboard ke Add button se data replies.json me save karne ke liye endpoint
app.post("/update-file-reply", (req, res) => {
    try {
        const { keyword, reply } = req.body
        if (!keyword || !reply) return res.status(400).json({ status: "error", message: "Data missing" })

        const fileRepliesPath = path.join(__dirname, "replies.json")
        let currentReplies = {}

        if (fs.existsSync(fileRepliesPath)) {
            currentReplies = JSON.parse(fs.readFileSync(fileRepliesPath, "utf8") || "{}")
        }

        currentReplies[keyword.trim().toLowerCase()] = reply.trim()
        
        fs.writeFileSync(fileRepliesPath, JSON.stringify(currentReplies, null, 2), "utf8")
        console.log(`💾 Saved to file -> ${keyword}: ${reply}`)
        
        res.json({ status: "success" })
    } catch (err) {
        console.error("File write error:", err.message)
        res.status(500).json({ status: "error", message: err.message })
    }
})

let sock
let qrData = null; // 1. Variable define karein
let isConnected = false; // 2. Connection status

// ... baaki ka code ...

let CRM_CONFIG = {
    keyword: "string",
    mode: "both",
    allowedNumbers: [],
    customReply: "",
    trackOnlyKeywords: "",
    autoReplyEnabled: true,
    geminiEnabled: false,
    geminiApiKey: "",
    geminiSystemPrompt: "Reply nicely and helpfully in the same language as user.",
    mediaPath: "",    
    mediaCaption: "",
    newUserMode: "all"
}

const msgCounters = {}

// ================= CONFIG =================

app.post("/config", (req, res) => {
    CRM_CONFIG = {
        ...CRM_CONFIG,
        ...req.body
    }
    res.json({ status: "updated", config: CRM_CONFIG })
})

app.post("/sync-config", (req, res) => {
    const { keyword, trackOnlyKeywords, customReply, autoReplyEnabled, geminiEnabled, geminiApiKey, geminiSystemPrompt, mediaPath, mediaCaption, newUserMode } = req.body
    if (keyword !== undefined)            CRM_CONFIG.keyword = keyword
    if (trackOnlyKeywords !== undefined)  CRM_CONFIG.trackOnlyKeywords = trackOnlyKeywords
    if (customReply !== undefined)        CRM_CONFIG.customReply = customReply
    if (autoReplyEnabled !== undefined)   CRM_CONFIG.autoReplyEnabled = autoReplyEnabled
    if (geminiEnabled !== undefined)      CRM_CONFIG.geminiEnabled = geminiEnabled
    if (geminiApiKey !== undefined)       CRM_CONFIG.geminiApiKey = geminiApiKey
    if (geminiSystemPrompt !== undefined) CRM_CONFIG.geminiSystemPrompt = geminiSystemPrompt
    if (mediaPath !== undefined)          CRM_CONFIG.mediaPath = mediaPath
    if (mediaCaption !== undefined)       CRM_CONFIG.mediaCaption = mediaCaption
    if (newUserMode !== undefined)        CRM_CONFIG.newUserMode = newUserMode
    
    console.log("[CONFIG SYNCED SUCCESSFULLY]", CRM_CONFIG)
    res.json({ status: "synced", config: CRM_CONFIG })
})

// ================= GEMINI AI HELPER =================

async function getGeminiReply(userMessage) {
    if (!CRM_CONFIG.geminiApiKey) return null
    try {
        const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CRM_CONFIG.geminiApiKey}`,
            {
                contents: [{
                    role: "user",
                    parts: [{ text: `${CRM_CONFIG.geminiSystemPrompt}\n\nUser message: ${userMessage}` }]
                }]
            },
            { timeout: 10000 }
        )
        return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || null
    } catch (e) {
        console.log("[GEMINI ERROR]", e.message)
        return null
    }
}

// ================= WHATSAPP =================

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth")

    sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" })
    })





    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { qr, connection } = update;
        
        if (qr) {
            qrData = qr; // ✅ QR ko global variable mein save karein
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === "open") {
            isConnected = true; // ✅ Connected status true karein
            qrData = null;      // ✅ Scan ho gaya toh QR hata dein
            console.log("WHATSAPP CONNECTED ✅");
            // ...
        }
        
        if (connection === "close") {
            isConnected = false;
            startBot();
        }
    })

    // ================= MESSAGE LISTENER =================
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return

        const sender = msg.key.remoteJid || ""
        if (sender.includes("status@broadcast")) return

        const jid = msg.key.remoteJidAlt || msg.key.remoteJid || ""
        let number = jid.split("@")[0]
        if (number.startsWith("91") && number.length === 12) {
            number = number.slice(2)
        }

        const name = msg.pushName || msg.notifyName || "Unknown"
        let text = ""
        if (msg.message.conversation) {
            text = msg.message.conversation
        } else if (msg.message.extendedTextMessage?.text) {
            text = msg.message.extendedTextMessage.text
        } else if (msg.message.imageMessage?.caption) {
            text = msg.message.imageMessage.caption
        } else if (msg.message.videoMessage?.caption) {
            text = msg.message.videoMessage.caption
        } else if (msg.message.ephemeralMessage?.message?.conversation) {
            text = msg.message.ephemeralMessage.message.conversation
        }
        text = text.trim()

        if (!text) return

        const now = new Date()
        const date = now.toLocaleDateString("en-IN")
        const time = now.toLocaleTimeString("en-IN")

        const activeKeywords = CRM_CONFIG.keyword.split(",").map(k => k.trim().toLowerCase())
        const trackKeywords = CRM_CONFIG.trackOnlyKeywords.split(",").map(k => k.trim().toLowerCase())
        const currentMsgLower = text.toLowerCase()

        const isAutoReplyMatch = activeKeywords.some(k => currentMsgLower.includes(k))
        const isTrackMatch = trackKeywords.some(k => currentMsgLower.includes(k))

        if (CRM_CONFIG.newUserMode === "keyword_only") {
            if (!isAutoReplyMatch && !isTrackMatch) {
                return
            }
        }

        console.log("================================")
        console.log("DATE :", date)
        console.log("TIME :", time)
        console.log("NAME :", name)
        console.log("NUMBER :", number)
        console.log("MESSAGE:", text)
        console.log("================================")

        if (!msgCounters[number]) {
            msgCounters[number] = 0
            console.log(`🆕 [NEW USER CONVERSATION] ${number} — ${name}`)
        }

        if (msgCounters[number] >= 1) return
        msgCounters[number]++

        await axios.post("http://localhost:8000/message", {
            name, number, text, date, time
        }).catch(() => {})

        if (msg.key.fromMe) return

        const fileRepliesPath = path.join(__dirname, "replies.json")
        let fileMatchedReply = null

        if (CRM_CONFIG.autoReplyEnabled && fs.existsSync(fileRepliesPath)) {
            try {
                const rawFileData = fs.readFileSync(fileRepliesPath, "utf8")
                const customFileReplies = JSON.parse(rawFileData || "{}")

                for (const fileKey in customFileReplies) {
                    if (currentMsgLower.includes(fileKey.toLowerCase().trim())) {
                        fileMatchedReply = customFileReplies[fileKey]
                        break
                    }
                }
            } catch (err) {
                console.log("❌ [FILE READ ERROR]:", err.message)
            }
        }

        if (CRM_CONFIG.autoReplyEnabled && fileMatchedReply) {
            await sock.sendMessage(sender, { text: fileMatchedReply })
            await axios.post("http://localhost:8000/message", {
                name: "AI Engine",
                number: number,
                text: fileMatchedReply,
                date, time
            }).catch(() => {})

        } else if (CRM_CONFIG.autoReplyEnabled && isAutoReplyMatch) {
            await sock.sendMessage(sender, { text: CRM_CONFIG.customReply })
            await axios.post("http://localhost:8000/message", {
                name: "AI Engine",
                number: number,
                text: CRM_CONFIG.customReply,
                date, time
            }).catch(() => {})

        } else if (CRM_CONFIG.autoReplyEnabled && CRM_CONFIG.geminiEnabled) {
            const aiText = await getGeminiReply(text)
            if (aiText) {
                await sock.sendMessage(sender, { text: aiText })
                await axios.post("http://localhost:8000/message", {
                    name: "Gemini AI",
                    number: number,
                    text: aiText,
                    date, time
                }).catch(() => {})
            }
        }
    })
}

startBot()
app.listen(9000, () => console.log("NODE EXTENSION SERVICE RUNNING ON PORT 9000"))
