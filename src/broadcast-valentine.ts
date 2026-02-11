/**
 * Valentine's Day broadcast — 10 Feb 2026
 * 
 * Sends: text with buttons (no images). Buttons stacked vertically for readability.
 * Rate limit: ~10 users/sec (1 API call per user)
 * 
 * Usage:
 *   npx ts-node src/broadcast-valentine.ts          # dry run (count only)
 *   npx ts-node src/broadcast-valentine.ts --send    # actually send
 */

import "dotenv/config";
import { config } from "./config";
import { createClient } from "@supabase/supabase-js";

const BOT_TOKEN = config.telegramBotToken;
const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

const TEST_MODE = process.argv.includes("--test");
const TEST_TO = process.argv.find((a) => a.startsWith("--test-to="))?.split("=")[1]; // --test-to=123456789
const DRY_RUN = !process.argv.includes("--send") && !TEST_MODE && !TEST_TO; // --test or --test-to always sends
const RATE_LIMIT_PER_SEC = 10; // 10 users/sec (1 msg per user)
const DELAY_MS = Math.ceil(1000 / RATE_LIMIT_PER_SEC);

// --- Messages ---

// Valentine-appropriate styles: id, group_id (for style_example_v2), emoji, label
const VALENTINE_STYLES = [
  { id: "ru_love_is", group_id: "russian", emoji: "💑", label_ru: "Love Is", label_en: "Love Is" },
  { id: "love_heart", group_id: "love", emoji: "💖", label_ru: "С сердечками", label_en: "Hearts" },
  { id: "love_couple", group_id: "love", emoji: "👫", label_ru: "Парочки", label_en: "Couple" },
  { id: "love_soft", group_id: "love", emoji: "🌸", label_ru: "Нежный", label_en: "Soft" },
  { id: "anime_romance", group_id: "anime", emoji: "💗", label_ru: "Аниме-романтика", label_en: "Anime romance" },
];

const MESSAGE_RU = `💝 14 февраля уже скоро!

Сделай уникальный подарок — стикерпак с вашими совместными фото 💑

Выбери стиль и отправь фото 👇

🔥 Только до 15 февраля — скидка 10%!

💰 Пакеты со скидкой 10% — выбирай ниже 👇`;

const MESSAGE_EN = `💝 Valentine's Day is almost here!

Create a unique gift — a sticker pack with your couple photos 💑

Choose a style and send your photo 👇

🔥 Until Feb 15 — 10% off all packs!

💰 Packs with 10% off — choose below 👇`;

// --- Buttons: style links + discount ---

function getButtons(lang: string) {
  const isRu = lang === "ru";
  const exampleText = isRu ? "Пример" : "Example";

  // Same layout as main menu: style name + example button (broadcast_example — original msg stays on Back)
  const styleRows = VALENTINE_STYLES.map((s) => [
    { text: `${s.emoji} ${isRu ? s.label_ru : s.label_en}`, callback_data: `val_${s.id}` },
    { text: exampleText, callback_data: `broadcast_example:${s.id}:${s.group_id}` },
  ]);
  const discountRows = [
    [{ text: "⭐ 10 — 135⭐ (−10%)", callback_data: "pack_10_135" }],
    [{ text: "💎 30 — 270⭐ (−10%)", callback_data: "pack_30_270" }],
    [{ text: "👑 100 — 630⭐ (−10%)", callback_data: "pack_100_630" }],
    [{ text: "🚀 250 — 1350⭐ (−10%)", callback_data: "pack_250_1350" }],
  ];

  return {
    inline_keyboard: [...styleRows, ...discountRows],
  };
}

// --- Telegram API helpers ---

async function tgApi(method: string, body: any): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendTextWithButtons(chatId: number, text: string, lang: string): Promise<boolean> {
  const res = await tgApi("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: getButtons(lang),
  });
  if (!res.ok) {
    if (res.error_code === 403) return false;
    console.error(`sendMessage failed for ${chatId}:`, res.description);
    return false;
  }
  return true;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Main ---

async function main() {
  console.log(`=== Valentine's Day Broadcast ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (add --send to actually send)" : "SENDING"}`);
  console.log();

  // 1. Get users to send to
  let users: { telegram_id: string; lang: string }[] = [];

  if (TEST_MODE || TEST_TO) {
    const targetId = TEST_TO ? parseInt(TEST_TO, 10) : config.adminIds[0];
    if (!targetId || isNaN(targetId)) {
      console.error("TEST: Use --test-to=TELEGRAM_ID (e.g. --test-to=161456957) or set ADMIN_IDS in .env");
      process.exit(1);
    }
    users = [{ telegram_id: String(targetId), lang: "ru" }];
    console.log(`Test: sending to ${targetId}`);
  } else {
    const { data, error } = await supabase
      .from("users")
      .select("telegram_id, lang")
      .eq("env", "prod");

    if (error) {
      console.error("Failed to fetch users:", error);
      process.exit(1);
    }
    users = data || [];
    console.log(`Total users: ${users.length}`);
  }

  if (DRY_RUN) {
    console.log("\n--- DRY RUN ---");
    console.log(`Would send to ${users?.length || 0} users`);
    console.log(`Estimated time: ${Math.ceil((users?.length || 0) / RATE_LIMIT_PER_SEC)} seconds`);
    console.log(`\nExample message (RU):\n${MESSAGE_RU}`);
    console.log(`\nRun with --send to actually broadcast.`);
    process.exit(0);
  }

  // 3. Send to each user
  let sent = 0;
  let failed = 0;
  let blocked = 0;
  const startTime = Date.now();

  for (const user of users!) {
    const chatId = Number(user.telegram_id);
    const lang = user.lang || "en";
    const message = lang === "ru" ? MESSAGE_RU : MESSAGE_EN;

    try {
      // Send text + buttons only (no images)
      const textOk = await sendTextWithButtons(chatId, message, lang);
      if (!textOk) {
        blocked++;
        continue;
      }

      sent++;
      if (sent % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Sent: ${sent}/${users!.length} (${elapsed}s, blocked: ${blocked}, failed: ${failed})`);
      }
    } catch (err: any) {
      failed++;
      console.error(`Error for ${user.telegram_id}:`, err.message);
    }

    // Rate limit
    await sleep(DELAY_MS);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done ===`);
  console.log(`Sent: ${sent}`);
  console.log(`Blocked: ${blocked}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total time: ${totalTime}s`);
}

main().catch(console.error);
