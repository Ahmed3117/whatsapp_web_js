const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal'); // Optional, mainly for debug logs
const { Sender } = require('./database');

class ClientManager {
    constructor() {
        this.clients = new Map(); // senderId -> Client instance
        this.qrCodes = new Map(); // senderId -> QR code string
        this.readyStatus = new Map(); // senderId -> boolean
    }

    async initializeSender(sender) {
        if (this.clients.has(sender.id)) {
            console.log(`Client ${sender.id} already initialized.`);
            return;
        }

        console.log(`Initializing client for sender ${sender.id} (Client ID: ${sender.client_id})`);

        const client = new Client({
            authStrategy: new LocalAuth({ clientId: sender.client_id }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        client.on('qr', (qr) => {
            console.log(`QR Code received for sender ${sender.id}`);
            this.qrCodes.set(sender.id, qr);
            this.readyStatus.set(sender.id, false);
        });

        client.on('ready', async () => {
            console.log(`Client ${sender.id} is ready!`);
            this.qrCodes.delete(sender.id);
            this.readyStatus.set(sender.id, true);

            // Update phone number if not set
            if (!sender.phone_number) {
                const info = client.info;
                if (info && info.wid) {
                    sender.phone_number = info.wid.user;
                    await sender.save();
                }
            }
        });

        client.on('authenticated', () => {
            console.log(`Client ${sender.id} authenticated.`);
        });

        client.on('auth_failure', msg => {
            console.error(`Client ${sender.id} auth failure:`, msg);
        });

        client.on('disconnected', (reason) => {
            console.log(`Client ${sender.id} disconnected:`, reason);
            this.clients.delete(sender.id);
            this.qrCodes.delete(sender.id);
            this.readyStatus.set(sender.id, false);
            // Optional: Auto-reconnect logic could go here
        });

        try {
            await client.initialize();
            this.clients.set(sender.id, client);
        } catch (err) {
            console.error(`Failed to initialize client ${sender.id}:`, err);
        }
    }

    getQrCode(senderId) {
        return this.qrCodes.get(senderId);
    }

    isReady(senderId) {
        return this.readyStatus.get(senderId) || false;
    }

    async sendMessage(senderId, number, text) {
        const client = this.clients.get(senderId);
        if (!client) {
            throw new Error('Client not found or not initialized');
        }
        if (!this.isReady(senderId)) {
            throw new Error('Client is not ready');
        }

        // Format number: ensure it ends with @c.us
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

        return await client.sendMessage(chatId, text);
    }

    async stopSender(senderId) {
        const client = this.clients.get(senderId);
        if (client) {
            await client.destroy();
            this.clients.delete(senderId);
            this.qrCodes.delete(senderId);
            this.readyStatus.delete(senderId);
        }
    }
}

module.exports = new ClientManager();
