# WhatsApp Web Manager

A Node.js application to manage multiple WhatsApp sessions and send messages via a Dashboard and API.

## Features
- **Dashboard**: Manage Rooms and Senders.
- **Multi-Session**: Support for multiple WhatsApp accounts.
- **API**: Send messages programmatically with round-robin distribution.
- **Custom Messages**: Send specific messages to specific numbers.

## Usage
1.  Run `node server.js`.
2.  Open `http://localhost:3000`.
3.  Create a Room and Add Senders (Scan QR).
4.  Use the API endpoints `/send-messages` or `/send-custom-messages`.

## ⚠️ Important: Anti-Ban & Best Practices

Using automated tools with WhatsApp carries a risk of being banned. Follow these guidelines to minimize risk:

### 1. Account Visibility
-   **Business Accounts**: Only "Official Business Accounts" (Green Tick) display the business name to unsaved contacts. Standard business accounts show the number, but the "Push Name" is visible in contact info.
-   **Personal Accounts**: You cannot force your name to appear instead of the number for unsaved contacts. They will see the number first.

### 2. Warming Up Accounts
-   **New Accounts**: Do NOT start sending hundreds of messages immediately.
    -   Day 1-3: 10-20 messages/day.
    -   Day 4-7: 30-50 messages/day.
    -   Gradually increase.
-   **Old Accounts**: Safer, but sudden spikes in activity can still trigger flags.

### 3. Sending Limits & Delays
-   **Delays**: Always use delays between messages. The current system allows setting a `delay_seconds` parameter.
    -   Recommended: **15-60 seconds** between messages.
-   **Volume**:
    -   Safe zone: **50-100 messages per day** per account.
    -   Risky: >500 messages per day.
-   **Content**: Avoid sending the exact same message to everyone. Use the "Custom Messages" feature to vary the content (e.g., include names).

### 4. Block Rate
-   If recipients block or report you, your account health drops rapidly.
-   Only send messages to people who expect them or have opted in.

*Disclaimer: This tool is for educational purposes. The developers are not responsible for any banned accounts.*