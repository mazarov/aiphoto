import { config } from "../config";

type AlertType = 
  | "generation_failed" 
  | "gemini_error" 
  | "rembg_failed" 
  | "worker_error" 
  | "api_error"
  | "not_enough_credits";

interface AlertOptions {
  type: AlertType;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

const EMOJI: Record<AlertType, string> = {
  generation_failed: "🟡",
  gemini_error: "🟠",
  rembg_failed: "🟠",
  worker_error: "🔴",
  api_error: "🔴",
  not_enough_credits: "💸",
};

export async function sendAlert(options: AlertOptions): Promise<void> {
  const channelId = config.alertChannelId;
  if (!channelId) {
    console.log("[Alert] No ALERT_CHANNEL_ID configured, skipping alert");
    return;
  }

  const emoji = EMOJI[options.type] || "⚠️";

  let text = `${emoji} *${options.type}*\n\n`;
  text += `⏰ ${new Date().toISOString()}\n\n`;
  text += `❌ ${escapeMarkdown(options.message)}\n`;

  if (options.details && Object.keys(options.details).length > 0) {
    text += `\n📋 *Details:*\n`;
    for (const [key, value] of Object.entries(options.details)) {
      text += `• ${key}: \`${String(value).slice(0, 100)}\`\n`;
    }
  }

  if (options.stack) {
    text += `\n📜 *Stack:*\n\`\`\`\n${options.stack.slice(0, 500)}\n\`\`\``;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channelId,
          text: text.slice(0, 4000),
          parse_mode: "Markdown",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Alert] Failed to send:", errorData);
    }
  } catch (err) {
    console.error("[Alert] Error sending alert:", err);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*`\[]/g, "\\$&");
}

// Business notifications
type NotificationType = "new_user" | "new_sticker" | "new_payment";

const NOTIFICATION_EMOJI: Record<NotificationType, string> = {
  new_user: "👤",
  new_sticker: "🎨",
  new_payment: "💰",
};

const NOTIFICATION_TITLE: Record<NotificationType, string> = {
  new_user: "Новый пользователь",
  new_sticker: "Новый стикер",
  new_payment: "Новая оплата",
};

interface NotificationOptions {
  type: NotificationType;
  message: string;
  imageBuffer?: Buffer;
}

export async function sendNotification(options: NotificationOptions): Promise<void> {
  const channelId = config.alertChannelId;
  if (!channelId) {
    return;
  }

  const emoji = NOTIFICATION_EMOJI[options.type];
  const title = NOTIFICATION_TITLE[options.type];
  const caption = `${emoji} *${title}*\n\n${options.message}`;

  try {
    if (options.imageBuffer) {
      // Send photo with caption
      const formData = new FormData();
      formData.append("chat_id", channelId);
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");
      formData.append("photo", new Blob([options.imageBuffer], { type: "image/webp" }), "sticker.webp");

      const response = await fetch(
        `https://api.telegram.org/bot${config.telegramBotToken}/sendPhoto`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[Notification] Failed to send photo:", errorData);
      }
    } else {
      // Send text only
      const response = await fetch(
        `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channelId,
            text: caption,
            parse_mode: "Markdown",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[Notification] Failed to send:", errorData);
      }
    }
  } catch (err) {
    console.error("[Notification] Error:", err);
  }
}
