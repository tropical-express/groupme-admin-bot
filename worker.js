// ================= CONFIG =================
const BLOCKED_DOMAINS = [
  "bit.ly", "tinyurl", "grabify", "iplogger",
  "porn", "xnxx", "xvideos", "discord.gg", "pornhub.com"
];
const CAPTCHA_TTL = 60000;
const MAX_STRIKES = 3;

// ================= WORKER =================
export default {
  async fetch(request, env) {
    try {
      const body = await request.json();
      if (!body?.group_id || body.group_id !== env.GROUP_ID) {
        return new Response("Ignored", { status: 200 });
      }

      const sender = body.sender_id;
      const text = body.text?.trim() || "";
      const name = body.name || "User";
      const isOwner = sender === env.OWNER_ID;

      // ============ LOAD KV DATA ============
      const strikes = JSON.parse(await env.ENFORCE_KV.get("strikes") || "{}");
      const banned = JSON.parse(await env.ENFORCE_KV.get("banned") || "{}");
      const nsfwWords = JSON.parse(await env.ENFORCE_KV.get("nsfw_words") || '["nsfw","sex","porn"]');
      const lockdown = (await env.ENFORCE_KV.get("lockdown")) === "true";
      const enabled = (await env.ENFORCE_KV.get("enabled")) !== "false";

      // ============ DISABLED / LOCKDOWN CHECK ============
      if (!enabled) return new Response("Enforcement disabled", { status: 200 });
      if (lockdown && !isOwner) return new Response("Lockdown active", { status: 200 });

      // ============ IGNORE OWNER ============
      if (isOwner) return new Response("Owner ignored", { status: 200 });

      // ============ BANNED CHECK ============
      if (banned[sender]) return new Response("User banned", { status: 200 });

      // ============ CAPTCHA CHECK ============
      const captchaDataRaw = await env.ENFORCE_KV.get(`captcha:${sender}`);
      if (captchaDataRaw) {
        const captcha = JSON.parse(captchaDataRaw);
        if (Date.now() > captcha.expires) {
          strikes[sender] = (strikes[sender] || 0) + 1;
          await env.ENFORCE_KV.put("strikes", JSON.stringify(strikes));
          await env.ENFORCE_KV.delete(`captcha:${sender}`);
          return post(env, `❌ @${name} captcha expired. Strike added.`);
        }
        if (parseInt(text) === captcha.answer) {
          await env.ENFORCE_KV.delete(`captcha:${sender}`);
          return post(env, `✅ @${name} verified.`);
        } else {
          strikes[sender] = (strikes[sender] || 0) + 1;
          await env.ENFORCE_KV.put("strikes", JSON.stringify(strikes));
          await env.ENFORCE_KV.delete(`captcha:${sender}`);
          return post(env, `❌ Wrong captcha. Strike added.`);
        }
      }

      // ============ MASTER COMMAND ============
      if (text.startsWith("/master") && isOwner) {
        const args = text.split(" ");
        switch (args[1]) {
          case "status":
            return post(env, JSON.stringify({ strikes, banned, nsfwWords }, null, 2));
          case "reset":
            await env.ENFORCE_KV.put("strikes", "{}");
            return post(env, "✅ All strikes reset");
          case "ban":
            if (!args[2]) return post(env, "User ID required");
            banned[args[2]] = true;
            await env.ENFORCE_KV.put("banned", JSON.stringify(banned));
            return post(env, `👢 User ${args[2]} banned`);
          case "unban":
            if (!args[2]) return post(env, "User ID required");
            delete banned[args[2]];
            await env.ENFORCE_KV.put("banned", JSON.stringify(banned));
            return post(env, `✅ User ${args[2]} unbanned`);
          case "addnsfw":
            if (!args[2]) return post(env, "Word required");
            if (!nsfwWords.includes(args[2])) nsfwWords.push(args[2]);
            await env.ENFORCE_KV.put("nsfw_words", JSON.stringify(nsfwWords));
            return post(env, `➕ NSFW word added: ${args[2]}`);
          case "removensfw":
            if (!args[2]) return post(env, "Word required");
            await env.ENFORCE_KV.put("nsfw_words", JSON.stringify(nsfwWords.filter(w => w !== args[2])));
            return post(env, `➖ NSFW word removed: ${args[2]}`);
          case "purge":
            let purged = 0;
            for (const uid in strikes) if (strikes[uid] >= 3) { banned[uid] = true; purged++; }
            await env.ENFORCE_KV.put("banned", JSON.stringify(banned));
            return post(env, `🔥 Purge complete. ${purged} users banned.`);
          case "lockdown":
            await env.ENFORCE_KV.put("lockdown", "true");
            return post(env, "🔒 Lockdown ENABLED");
          case "unlock":
            await env.ENFORCE_KV.put("lockdown", "false");
            return post(env, "🔓 Lockdown DISABLED");
          case "export":
            const logs = await env.ENFORCE_KV.get("messages") || "[]";
            return post(env, "📦 LOG EXPORT:\n```json\n" + logs + "\n```");
          case "wipe":
            await env.ENFORCE_KV.put("messages", "[]");
            return post(env, "🧹 Messages wiped");
          case "enable":
            await env.ENFORCE_KV.put("enabled", "true");
            return post(env, "✅ Enforcement ENABLED");
          case "disable":
            await env.ENFORCE_KV.put("enabled", "false");
            return post(env, "🛑 Enforcement DISABLED");
          case "nuke":
            await env.ENFORCE_KV.put("strikes", "{}");
            await env.ENFORCE_KV.put("banned", "{}");
            await env.ENFORCE_KV.put("messages", "[]");
            await env.ENFORCE_KV.put("lockdown", "false");
            return post(env, "☢️ NUKE: Everything reset");
          default:
            return post(env, "❓ Unknown master command");
        }
      }

      // ============ LINK SCAN ============
      const urls = text.match(/https?:\/\/\S+/gi);
      let violation = false;
      if (urls) {
        for (const url of urls) {
          const resolved = await resolveUrl(url);
          if (!resolved) continue;
          if (BLOCKED_DOMAINS.some(d => resolved.toLowerCase().includes(d))) {
            violation = true;
            break;
          }
        }
      }

      // ============ NSFW CHECK ============
      const nsfw = nsfwWords.some(w => text.toLowerCase().includes(w));

      if (violation || nsfw) {
        // ISSUE CAPTCHA
        const captcha = generateCaptcha();
        await env.ENFORCE_KV.put(`captcha:${sender}`, JSON.stringify({
          answer: captcha.a,
          expires: Date.now() + CAPTCHA_TTL
        }));
        return post(env, `⚠️ @${name}, verification required: 🧩 ${captcha.q}`);
      }

      // Log message
      const logJSON = await env.ENFORCE_KV.get("messages") || "[]";
      const messages = JSON.parse(logJSON);
      messages.push({ sender, name, text, timestamp: Date.now() });
      await env.ENFORCE_KV.put("messages", JSON.stringify(messages));

      return new Response("OK", { status: 200 });

    } catch (err) {
      console.error("WORKER ERROR:", err);
      return new Response("Error", { status: 500 });
    }
  }
};

// ================= HELPERS =================
async function resolveUrl(url) {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow" });
    return r.url;
  } catch { return null; }
}

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { q: `${a} + ${b}`, a: a + b };
}

async function post(env, text) {
  return fetch("https://api.groupme.com/v3/bots/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: env.BOT_ID, text })
  });
}

