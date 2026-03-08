![License](https://img.shields.io/github/license/tropical-express/groupme-admin-bot)
![Issues](https://img.shields.io/github/issues/tropical-express/groupme-admin-bot)
![Stars](https://img.shields.io/github/stars/tropical-express/groupme-admin-bot)
![Last Commit](https://img.shields.io/github/last-commit/tropical-express/groupme-admin-bot)

# GroupMe Admin Bot 🤖

A **moderation and enforcement bot for GroupMe groups** powered by **Cloudflare Workers**.

This bot monitors messages in a GroupMe group and automatically enforces rules such as:

* NSFW filtering
* Suspicious link detection
* Captcha verification
* Strike tracking
* Automatic bans
* Owner moderation commands

The bot is designed to run **serverlessly using Cloudflare Workers and KV storage**.

---

# Features

* NSFW word filtering
* Suspicious link detection
* Automatic captcha verification
* Strike tracking system
* Automatic bans after repeated violations
* Owner-only master command system
* Lockdown mode
* Message logging
* Remote admin controls

---

# Architecture

```
GroupMe Group
      │
      ▼
GroupMe API
      │
      ▼
Cloudflare Worker
      │
 ┌────┴─────┐
 ▼          ▼
Captcha   Message Filter
System    (Links + NSFW)
      │
      ▼
Cloudflare KV Storage
```

---

# Requirements

You need the following:

* Cloudflare account
* Node.js
* Wrangler CLI
* GroupMe Bot ID

---

# Installation

Clone the repository:

```
git clone https://github.com/tropical-express/groupme-admin-bot.git
cd groupme-admin-bot
```

Install Wrangler CLI:

```
npm install -g wrangler
```

Login to Cloudflare:

```
wrangler login
```

---

# Configuration

Edit the **wrangler.toml** file and add your credentials.

```
name = "your-admin-bot-name"
account_id = "YOUR_ACCOUNT_ID"

[vars]
BOT_ID = "YOUR_BOT_ID"
GROUP_ID = "YOUR_GROUP_ID"
OWNER_ID = "YOUR_USER_ID"
GROUPME_TOKEN = "YOUR_GROUPME_TOKEN"

[[kv_namespaces]]
binding = "ENFORCE_KV"
id = "YOUR_KV_NAMESPACE_ID"
```

---

# KV Setup

Create a KV namespace:

```
wrangler kv namespace create ENFORCE_KV
```

Copy the returned ID into `wrangler.toml`.

---

# Deploy

Deploy the worker:

```
wrangler deploy
```

Your bot will be available at:

```
https://your-worker-name.your-subdomain.workers.dev
```

---

# GroupMe Setup

1. Go to the **GroupMe Developer Portal**
2. Create a new bot
3. Set the **Callback URL** to your worker endpoint

Example:

```
https://your-worker-name.your-subdomain.workers.dev
```

Once connected, the worker will receive messages from your GroupMe group.

---

# Owner Commands

Only the configured **OWNER_ID** can run these commands.

| Command                 | Description               |
| ----------------------- | ------------------------- |
| /master status          | View bot status           |
| /master reset           | Reset all strikes         |
| /master ban USER_ID     | Ban a user                |
| /master unban USER_ID   | Unban a user              |
| /master addnsfw WORD    | Add NSFW filter word      |
| /master removensfw WORD | Remove NSFW word          |
| /master purge           | Ban users with 3+ strikes |
| /master lockdown        | Enable lockdown           |
| /master unlock          | Disable lockdown          |
| /master export          | Export message logs       |
| /master wipe            | Clear message logs        |
| /master enable          | Enable enforcement        |
| /master disable         | Disable enforcement       |
| /master nuke            | Full system reset         |

---

# Example Bot Message

```
⚠️ @User verification required: 🧩 4 + 7
```

The user must respond with the correct answer within **60 seconds** to avoid a strike.

---

# Security Features

* Link expansion to detect shortened malicious links
* NSFW word filtering
* Captcha verification system
* Strike tracking
* Automatic bans for repeated violations
* Owner moderation controls

---

# License

MIT License

---

# Disclaimer

This project is not affiliated with GroupMe.
It is an independent open-source moderation bot created for educational and administrative automation purposes.
