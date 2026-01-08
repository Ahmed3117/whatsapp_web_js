const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Room, Sender, ProcessLog, MessageLog } = require('./database');
const clientManager = require('./clientManager');
// const expressLayouts = require('express-ejs-layouts'); // Unused, using custom middleware 
// Wait, I didn't install express-ejs-layouts. I'll stick to manual structure or simple res.render with layout option if I configured it, but standard ejs doesn't have layout by default.
// I'll use a simple wrapper function or just include header/footer in views. 
// Actually, I wrote layout.ejs with <%- body %>. I need a way to use it.
// I will install express-ejs-layouts quickly or just change the views to include header/footer.
// Let's just use a helper to render with layout for now to avoid extra install if possible, OR just install it. It's cleaner.
// I'll assume I can install it or I'll just rewrite views to include partials. 
// Let's rewrite views to be simple includes? No, layout is better. I'll install express-ejs-layouts.

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Simple Layout Implementation
app.use((req, res, next) => {
    const originalRender = res.render;
    res.render = function (view, locals = {}) {
        originalRender.call(this, view, locals, (err, html) => {
            if (err) return next(err);
            originalRender.call(this, 'layout', { body: html, ...locals });
        });
    };
    next();
});

// Database Sync
sequelize.sync().then(() => {
    console.log('Database synced');
    // Restore active senders
    Sender.findAll({ where: { is_active: true } }).then(senders => {
        senders.forEach(sender => clientManager.initializeSender(sender));
    });
});

// Routes

// Dashboard Home
app.get('/', async (req, res) => {
    const rooms = await Room.findAll();
    res.render('index', { rooms });
});

// Create Room
app.post('/create-room', async (req, res) => {
    const { name, website_url } = req.body;
    await Room.create({ name, website_url });
    res.redirect('/');
});

// Room Details
app.get('/room/:id', async (req, res) => {
    const room = await Room.findByPk(req.params.id);
    const senders = await Sender.findAll({ where: { room_id: room.id } });
    res.render('room', { room, senders });
});

// Add Sender
app.post('/room/:id/add-sender', async (req, res) => {
    const roomId = req.params.id;
    const sender = await Sender.create({
        room_id: roomId,
        client_id: uuidv4() // Unique ID for LocalAuth
    });

    clientManager.initializeSender(sender);
    res.redirect(`/room/${roomId}`);
});

// Get QR Code
app.get('/sender/:id/qr', async (req, res) => {
    const senderId = req.params.id;
    const qr = clientManager.getQrCode(senderId);

    if (qr) {
        // Render QR code using a library or just send the string to be rendered by client JS
        // For simplicity, we'll use a simple QR code API or just text for now.
        // Better: use 'qrcode' package to render to data URL.
        // I didn't install 'qrcode' (node package), I installed 'qrcode-terminal'.
        // I should install 'qrcode' for web rendering.
        // For now, I'll just send the text string and let the user know.
        // OR I can use a public API like goqr.me
        res.send(`
            <html><body>
                <h1>Scan this QR Code</h1>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" />
                <p>Refresh if it expires.</p>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </body></html>
        `);
    } else {
        const isReady = clientManager.isReady(senderId);
        if (isReady) {
            res.send('<h1>Client is Ready and Authenticated!</h1>');
        } else {
            res.send('<h1>Waiting for QR Code... (Refresh in a few seconds)</h1><script>setTimeout(() => location.reload(), 3000);</script>');
        }
    }
});

// Toggle Sender
app.post('/sender/:id/toggle', async (req, res) => {
    const sender = await Sender.findByPk(req.params.id);
    sender.is_active = !sender.is_active;
    await sender.save();

    if (sender.is_active) {
        clientManager.initializeSender(sender);
    } else {
        clientManager.stopSender(sender.id);
    }

    res.redirect(`/room/${sender.room_id}`);
});

// Delete Sender
app.post('/sender/:id/delete', async (req, res) => {
    const sender = await Sender.findByPk(req.params.id);
    await clientManager.stopSender(sender.id);
    const roomId = sender.room_id;
    await sender.destroy();
    res.redirect(`/room/${roomId}`);
});

// API: Send Messages
app.post('/send-messages', async (req, res) => {
    console.log('Received body:', req.body);
    const { website_url, room_token, delay_seconds, max_sending_times, receivers, message_body } = req.body;

    // Validation
    const room = await Room.findOne({ where: { token: room_token, website_url } });
    if (!room) {
        return res.status(401).json({ error: 'Invalid room token or website URL' });
    }

    if (!room.is_active) {
        return res.status(400).json({ error: 'Room is inactive' });
    }

    const senders = await Sender.findAll({ where: { room_id: room.id, is_active: true } });
    if (senders.length === 0) {
        return res.status(400).json({ error: 'No active senders in this room' });
    }

    // Start Process
    // We'll run this in background to avoid timeout
    processMessages(room, senders, receivers, delay_seconds, max_sending_times, message_body);

    res.json({ status: 'started', message: 'Message sending process started' });
});

// API: Send Custom Messages
app.post('/send-custom-messages', async (req, res) => {
    const { website_url, room_token, delay_seconds, max_sending_times, messages } = req.body;

    // Validation
    const room = await Room.findOne({ where: { token: room_token, website_url } });
    if (!room) {
        return res.status(401).json({ error: 'Invalid room token or website URL' });
    }

    if (!room.is_active) {
        return res.status(400).json({ error: 'Room is inactive' });
    }

    const senders = await Sender.findAll({ where: { room_id: room.id, is_active: true } });
    if (senders.length === 0) {
        return res.status(400).json({ error: 'No active senders in this room' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Invalid messages array' });
    }

    // Start Process
    processCustomMessages(room, senders, messages, delay_seconds, max_sending_times);

    res.json({ status: 'started', message: 'Custom message sending process started' });
});

async function processCustomMessages(room, senders, messages, delay, maxPerSender) {
    console.log(`Starting processCustomMessages for Room ${room.name} (${room.id})`);
    console.log(`Messages: ${messages.length}, Senders: ${senders.length}, Delay: ${delay}s, MaxPerSender: ${maxPerSender}`);

    const log = await ProcessLog.create({
        room_id: room.id,
        start_time: new Date()
    });

    let sentCount = 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    let msgIdx = 0;
    while (msgIdx < messages.length) {
        console.log(`Starting cycle at message index ${msgIdx}`);
        for (const sender of senders) {
            if (msgIdx >= messages.length) break;

            console.log(`Using Sender ${sender.id} (${sender.phone_number})`);

            if (!clientManager.isReady(sender.id)) {
                console.warn(`Sender ${sender.id} is NOT READY. Skipping.`);
                continue;
            }

            for (let k = 0; k < maxPerSender; k++) {
                if (msgIdx >= messages.length) break;

                const item = messages[msgIdx];
                const number = item.number;
                const text = item.message;

                console.log(`Attempting to send to ${number}...`);
                try {
                    await clientManager.sendMessage(sender.id, number, text);
                    console.log(`Success: Sent to ${number}`);

                    await MessageLog.create({
                        room_id: room.id,
                        sender_id: sender.id,
                        receiver_number: number,
                        status: 'success'
                    });

                    sender.total_sent += 1;
                    await sender.save();
                    sentCount++;
                } catch (err) {
                    console.error(`Failed to send to ${number} via ${sender.id}:`, err.message);
                    await MessageLog.create({
                        room_id: room.id,
                        sender_id: sender.id,
                        receiver_number: number,
                        status: 'failed',
                        error_message: err.message
                    });
                }

                msgIdx++;
                await sleep(1000);
            }
        }

        if (msgIdx < messages.length) {
            console.log(`Cycle complete. Sleeping for ${delay} seconds...`);
            await sleep(delay * 1000);
        }
    }

    log.end_time = new Date();
    log.total_sent_in_process = sentCount;
    await log.save();
    console.log('Custom Process finished. Total sent:', sentCount);
}

async function processMessages(room, senders, receivers, delay, maxPerSender, messageBody) {
    console.log(`Starting processMessages for Room ${room.name} (${room.id})`);
    console.log(`Receivers: ${receivers.length}, Senders: ${senders.length}, Delay: ${delay}s, MaxPerSender: ${maxPerSender}`);
    console.log(`Message Body: "${messageBody}"`);

    const log = await ProcessLog.create({
        room_id: room.id,
        start_time: new Date()
    });

    let sentCount = 0;

    // Helper to sleep
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Re-implementation of loop logic
    let receiverIdx = 0;
    while (receiverIdx < receivers.length) {
        console.log(`Starting cycle at receiver index ${receiverIdx}`);
        for (const sender of senders) {
            if (receiverIdx >= receivers.length) break;

            console.log(`Using Sender ${sender.id} (${sender.phone_number})`);

            // Check if client is ready
            const isReady = clientManager.isReady(sender.id);
            if (!isReady) {
                console.warn(`Sender ${sender.id} is NOT READY. Skipping.`);
                continue;
            }

            // Send up to maxPerSender messages
            for (let k = 0; k < maxPerSender; k++) {
                if (receiverIdx >= receivers.length) break;

                const number = receivers[receiverIdx];
                console.log(`Attempting to send to ${number}...`);
                try {
                    const text = messageBody || `Message from ${room.name}`;
                    await clientManager.sendMessage(sender.id, number, text);
                    console.log(`Success: Sent to ${number}`);

                    await MessageLog.create({
                        room_id: room.id,
                        sender_id: sender.id,
                        receiver_number: number,
                        status: 'success'
                    });

                    // Update stats
                    sender.total_sent += 1;
                    await sender.save();

                    sentCount++;
                } catch (err) {
                    console.error(`Failed to send to ${number} via ${sender.id}:`, err.message);
                    await MessageLog.create({
                        room_id: room.id,
                        sender_id: sender.id,
                        receiver_number: number,
                        status: 'failed',
                        error_message: err.message
                    });
                }

                receiverIdx++;
                // Small delay between individual messages to avoid instant block
                await sleep(1000);
            }
        }

        if (receiverIdx < receivers.length) {
            console.log(`Cycle complete. Sleeping for ${delay} seconds...`);
            await sleep(delay * 1000);
        }
    }

    log.end_time = new Date();
    log.total_sent_in_process = sentCount;
    await log.save();
    console.log('Process finished. Total sent:', sentCount);
}

// Room Analytics
app.get('/room/:id/analytics', async (req, res) => {
    const { id } = req.params;
    const { start_date, end_date, sender_id } = req.query;
    const room = await Room.findByPk(id);

    if (!room) return res.status(404).send('Room not found');

    const senders = await Sender.findAll({ where: { room_id: id } });

    const { Op } = require('sequelize');
    let whereClause = { room_id: id };

    if (start_date || end_date) {
        whereClause.timestamp = {};
        if (start_date) {
            whereClause.timestamp[Op.gte] = new Date(start_date);
        }
        if (end_date) {
            const end = new Date(end_date);
            end.setHours(23, 59, 59, 999);
            whereClause.timestamp[Op.lte] = end;
        }
    }

    if (sender_id) {
        whereClause.sender_id = sender_id;
    }

    const logs = await MessageLog.findAll({
        where: whereClause,
        order: [['timestamp', 'DESC']],
        include: [Sender]
    });

    const stats = {
        total: logs.length,
        success: logs.filter(l => l.status === 'success').length,
        failed: logs.filter(l => l.status === 'failed').length
    };

    res.render('analytics', { room, logs, stats, start_date, end_date, sender_id, senders });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
