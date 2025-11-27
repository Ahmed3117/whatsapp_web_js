const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');

    // Example: Send a message
    const number = '201003844417@c.us';
    const text = 'Hello from whatsapp-web.js!';
    client.sendMessage(number, text);
    console.log('Message sent to ' + number);
});

client.initialize();
