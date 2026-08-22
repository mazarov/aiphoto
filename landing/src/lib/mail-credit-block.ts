import type { MailRpcClient } from "@/lib/mail-outbox";

export function scheduleNoCreditsMail(
  supabase: MailRpcClient,
  sharedUserId: string,
  source: "generate" | "analyze",
): void {
  if (!sharedUserId) return;
  void (async () => {
    try {
      const { error } = await supabase.rpc("landing_mail_record_credit_block", {
        p_shared_user_id: sharedUserId,
        p_source: source,
      });
      if (error) {
        console.warn("[mail] credit-block due failed", {
          userId: sharedUserId,
          message: error.message,
        });
      }
    } catch (error) {
      console.warn("[mail] credit-block due failed", {
        userId: sharedUserId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
