import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const config = {
  appEnv: process.env.APP_ENV || "prod",
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
  supabaseUrl: required("SUPABASE_SUPABASE_PUBLIC_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  port: Number(process.env.PORT || 3002),
  webhookPath: process.env.WEBHOOK_PATH || "/telegram/webhook",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  alertChannelId: process.env.ALERT_CHANNEL_ID || "",
};
