import { config } from "../config";

export async function sendAlert(message: string, details?: Record<string, string | number>): Promise<void> {
  if (!config.alertChannelId) return;

  let text = `💳 *payment_bot*\n\n${escapeMarkdown(message)}`;
  if (details && Object.keys(details).length > 0) {
    text += "\n\n📋 *Details:*";
    for (const [key, value] of Object.entries(details)) {
      text += `\n• ${escapeMarkdown(key)}: \`${escapeMarkdown(String(value))}\``;
    }
  }

  try {
    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.alertChannelId,
        text: text.slice(0, 4000),
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("[alert] failed:", err);
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(/[_*`\[]/g, "\\$&");
}
