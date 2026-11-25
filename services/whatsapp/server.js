/**
 * EDITH WhatsApp Bridge Microservice
 * Lightweight Node.js daemon exposing clean REST endpoints to EDITH core.
 * Port: 18422 (or process.env.PORT)
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 18422;

let clientState = {
    connected: false,
    user: null,
    qr: null
};

// Health and Status Endpoint
app.get('/api/status', (req, res) => {
    res.json({
        service: "EDITH WhatsApp Microservice",
        connected: clientState.connected,
        user: clientState.user,
        timestamp: new Date().toISOString()
    });
});

// Send Message Endpoint
app.post('/api/send', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ success: false, error: "Missing 'phone' or 'message' parameters" });
    }

    try {
        console.log(`[WhatsApp Service] Outgoing message to +${phone}: "${message}"`);
        
        // When Baileys socket is connected:
        // const jid = `${phone}@s.whatsapp.net`;
        // await sock.sendMessage(jid, { text: message });

        return res.json({
            success: true,
            recipient: phone,
            message: message,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[WhatsApp Service Error]', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`[EDITH WhatsApp Microservice] Listening on http://127.0.0.1:${PORT}`);
});
