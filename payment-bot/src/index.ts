import express from "express";
import axios from "axios";
import { Markup, Telegraf } from "telegraf";
import { config } from "./config";
import { supabase } from "./lib/supabase";
import { sendAlert } from "./lib/alerts";

const bot = new Telegraf(config.telegramBotToken);
const app = express();
app.use(express.json({ limit: "2mb" }));

const WEB_CREDIT_PACKS = [
  { credits: 10, price: 150, label_ru: "⭐ Старт", label_en: "⭐ Start" },
  { credits: 30, price: 300, label_ru: "💎 Поп", label_en: "💎 Pop" },
  { credits: 100, price: 700, label_ru: "👑 Про", label_en: "👑 Pro" },
];

function safeAnswerCbQuery(ctx: any) {
  return ctx.answerCbQuery().catch(() => {});
}

function getStartPayload(ctx: { message?: { text?: string } }): string {
  const text = ctx.message?.text || "";
  const match = text.match(/^\/start\s+(.+)$/);
  return match ? match[1].trim() : "";
}

function getLang(ctx: any): "ru" | "en" {
  return (ctx.from?.language_code || "").toLowerCase().startsWith("ru") ? "ru" : "en";
}

async function showWebCreditPacks(ctx: any, lang: "ru" | "en") {
  const title = lang === "ru" ? "Пакеты кредитов для PromptShot:" : "PromptShot credit packs:";
  const unit = lang === "ru" ? "кредитов" : "credits";
  const buttons = WEB_CREDIT_PACKS.map((pack) => {
    const label = lang === "ru" ? pack.label_ru : pack.label_en;
    return [
      Markup.button.callback(
        `${label}: ${pack.credits} ${unit} — ${pack.price}⭐`,
        `webpack_${pack.credits}_${pack.price}`
      ),
    ];
  });
  await ctx.reply(title, Markup.inlineKeyboard(buttons));
}

async function handleWebCreditsStartPayload(ctx: any, startPayload: string): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId || !startPayload) return false;
  const lang = getLang(ctx);

  if (startPayload.startsWith("weblink_")) {
    const otp = startPayload.replace("weblink_", "").trim().toLowerCase();
    if (!/^[a-f0-9]{12}$/.test(otp)) {
      await ctx.reply(
        lang === "ru"
          ? "Ссылка некорректна. Нажмите «Купить кредиты» в extension ещё раз."
          : "Invalid link. Tap Buy credits in extension again."
      );
      return true;
    }

    const { data: token } = await supabase
      .from("landing_link_tokens")
      .select("id, landing_user_id")
      .eq("otp", otp)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!token?.id || !token?.landing_user_id) {
      await ctx.reply(
        lang === "ru"
          ? "Ссылка устарела. Нажмите «Купить кредиты» в extension ещё раз."
          : "Link expired. Tap Buy credits in extension again."
      );
      return true;
    }

    const { data: linkByTelegram } = await supabase
      .from("landing_user_telegram_links")
      .select("landing_user_id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (linkByTelegram?.landing_user_id && linkByTelegram.landing_user_id !== token.landing_user_id) {
      await ctx.reply(
        lang === "ru"
          ? "Этот Telegram уже привязан к другому аккаунту PromptShot."
          : "This Telegram is already linked to another PromptShot account."
      );
      return true;
    }

    const { data: linkByLandingUser } = await supabase
      .from("landing_user_telegram_links")
      .select("telegram_id")
      .eq("landing_user_id", token.landing_user_id)
      .maybeSingle();

    if (linkByLandingUser?.telegram_id && Number(linkByLandingUser.telegram_id) !== Number(telegramId)) {
      await ctx.reply(
        lang === "ru"
          ? "Этот аккаунт PromptShot уже привязан к другому Telegram."
          : "This PromptShot account is already linked to another Telegram."
      );
      return true;
    }

    const { error: upsertError } = await supabase
      .from("landing_user_telegram_links")
      .upsert(
        {
          landing_user_id: token.landing_user_id,
          telegram_id: telegramId,
          linked_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

    if (upsertError) {
      console.error("[payment-bot] failed to upsert link:", upsertError.message);
      await ctx.reply(
        lang === "ru" ? "Не удалось привязать аккаунт. Попробуйте позже." : "Failed to link account. Try later."
      );
      return true;
    }

    await supabase.from("landing_link_tokens").update({ used: true }).eq("id", token.id);
    await ctx.reply(
      lang === "ru" ? "✅ Аккаунт PromptShot привязан!" : "✅ PromptShot account linked!"
    );
    await showWebCreditPacks(ctx, lang);
    return true;
  }

  if (startPayload === "webcredits") {
    const { data: link } = await supabase
      .from("landing_user_telegram_links")
      .select("landing_user_id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (!link?.landing_user_id) {
      await ctx.reply(
        lang === "ru"
          ? "Сначала привяжите аккаунт через extension (кнопка «Купить кредиты»)."
          : "Link your account from extension first (Buy credits button)."
      );
      return true;
    }

    await showWebCreditPacks(ctx, lang);
    return true;
  }

  return false;
}

bot.start(async (ctx) => {
  const startPayload = getStartPayload(ctx);
  const handled = await handleWebCreditsStartPayload(ctx, startPayload);
  if (handled) return;

  const lang = getLang(ctx);
  await ctx.reply(
    lang === "ru"
      ? "Этот бот принимает оплату за кредиты PromptShot. Нажмите «Купить кредиты» в extension."
      : "This bot handles PromptShot credit payments. Tap Buy credits in the extension."
  );
});

bot.action(/^webpack_(\d+)_(\d+)$/, async (ctx) => {
  safeAnswerCbQuery(ctx);

  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  const lang = getLang(ctx);
  const credits = parseInt(ctx.match[1], 10);
  const price = parseInt(ctx.match[2], 10);

  const pack = WEB_CREDIT_PACKS.find((p) => p.credits === credits && p.price === price);
  if (!pack) {
    await ctx.reply(lang === "ru" ? "Неверный пакет." : "Invalid pack.");
    return;
  }

  const { data: link } = await supabase
    .from("landing_user_telegram_links")
    .select("landing_user_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (!link?.landing_user_id) {
    await ctx.reply(
      lang === "ru"
        ? "Привяжите аккаунт через extension (кнопка «Купить кредиты»)."
        : "Link account from extension first (Buy credits button)."
    );
    return;
  }

  await supabase
    .from("landing_web_transactions")
    .update({ state: "canceled", updated_at: new Date().toISOString() })
    .eq("landing_user_id", link.landing_user_id)
    .eq("telegram_id", telegramId)
    .eq("state", "created");

  const { data: transaction, error: txError } = await supabase
    .from("landing_web_transactions")
    .insert({
      landing_user_id: link.landing_user_id,
      telegram_id: telegramId,
      amount: credits,
      price_stars: price,
      state: "created",
    })
    .select("*")
    .single();

  if (txError || !transaction) {
    console.error("[payment-bot] failed to create transaction:", txError?.message || "unknown");
    await ctx.reply(lang === "ru" ? "Не удалось создать оплату." : "Failed to create payment.");
    return;
  }

  const title = lang === "ru" ? "Кредиты PromptShot" : "PromptShot credits";
  const description = lang === "ru"
    ? `${credits} кредитов для генераций в extension`
    : `${credits} credits for extension generations`;
  const label = lang === "ru" ? "Кредиты" : "Credits";

  try {
    await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendInvoice`, {
      chat_id: telegramId,
      title,
      description,
      payload: `[${transaction.id}]`,
      currency: "XTR",
      prices: [{ label, amount: price }],
    });
  } catch (err: any) {
    console.error("[payment-bot] sendInvoice failed:", err.response?.data || err.message);
    await ctx.reply(lang === "ru" ? "Не удалось выставить счёт." : "Failed to send invoice.");
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on("successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;
  const transactionId = payment.invoice_payload.replace(/[\[\]]/g, "");
  const telegramId = ctx.from?.id || 0;

  const { data: existingCharge } = await supabase
    .from("landing_web_transactions")
    .select("id, state")
    .eq("telegram_payment_charge_id", payment.telegram_payment_charge_id)
    .maybeSingle();

  if (existingCharge?.state === "done") {
    return;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("landing_web_transactions")
    .update({
      state: "done",
      telegram_payment_charge_id: payment.telegram_payment_charge_id,
      provider_payment_charge_id: payment.provider_payment_charge_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .eq("state", "created")
    .is("telegram_payment_charge_id", null)
    .select("*");

  if (updateError) {
    console.error("[payment-bot] successful_payment update failed:", updateError.message);
    return;
  }

  const webTx = updatedRows?.[0];
  if (!webTx) return;

  const { data: balance, error: addCreditsError } = await supabase.rpc("landing_add_credits", {
    p_user_id: webTx.landing_user_id,
    p_amount: webTx.amount,
  });

  if (addCreditsError || balance === -1) {
    console.error("[payment-bot] landing_add_credits failed:", addCreditsError?.message || "user not found");
    await ctx.reply("Payment received, but crediting failed. Please contact support.");
    await sendAlert("landing_add_credits failed", {
      transaction_id: webTx.id,
      telegram_id: telegramId,
    });
    return;
  }

  const lang = getLang(ctx);
  if (lang === "ru") {
    await ctx.reply(`✅ Зачислено ${webTx.amount} кредитов для PromptShot!`);
  } else {
    await ctx.reply(`✅ Added ${webTx.amount} PromptShot credits!`);
  }

  await sendAlert("Web payment completed", {
    transaction_id: webTx.id,
    telegram_id: telegramId,
    amount: webTx.amount,
    stars: webTx.price_stars,
  });
});

app.get("/", (_req, res) => {
  res.status(200).json({ ok: true, service: "promptshot-payment-bot" });
});

app.post(config.webhookPath, async (req, res) => {
  try {
    if (config.telegramWebhookSecret) {
      const got = req.get("x-telegram-bot-api-secret-token");
      if (got !== config.telegramWebhookSecret) {
        res.status(401).send("invalid secret");
        return;
      }
    }
    await bot.handleUpdate(req.body, res);
  } catch (err) {
    console.error("[payment-bot] webhook handler failed:", err);
    res.status(500).send("error");
  }
});

app.listen(config.port, () => {
  console.log(`[payment-bot] listening on :${config.port}`);
});

async function startBot() {
  if (config.publicBaseUrl) {
    const webhookUrl = `${config.publicBaseUrl.replace(/\/$/, "")}${config.webhookPath}`;
    await bot.telegram.setWebhook(
      webhookUrl,
      config.telegramWebhookSecret ? { secret_token: config.telegramWebhookSecret } : undefined
    );
    console.log(`[payment-bot] webhook set: ${webhookUrl}`);
  } else {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    await bot.launch({ dropPendingUpdates: true });
    console.log("[payment-bot] launched in long polling mode");
  }
}

startBot().catch(async (err) => {
  console.error("[payment-bot] failed to start:", err);
  await sendAlert("Payment bot failed to start", { error: err?.message || String(err) });
  process.exit(1);
});

process.on("uncaughtException", async (err) => {
  console.error("[payment-bot] uncaught exception:", err);
  await sendAlert("Uncaught exception", { error: err.message });
  process.exit(1);
});

process.on("unhandledRejection", async (reason: any) => {
  console.error("[payment-bot] unhandled rejection:", reason);
  await sendAlert("Unhandled rejection", { error: reason?.message || String(reason) });
  process.exit(1);
});
