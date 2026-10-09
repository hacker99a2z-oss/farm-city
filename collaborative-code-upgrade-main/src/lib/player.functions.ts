import { createServerFn } from "@tanstack/react-start";

type TgVerified = { id: number; first_name: string; username?: string; start_param?: string };

// Verifies Telegram Mini App initData with the bot token (HMAC-SHA256, per Telegram docs).
async function verifyInitData(initData: string): Promise<TgVerified> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Bot token missing");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Invalid login");
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const enc = new TextEncoder();
  const k1 = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = await crypto.subtle.sign("HMAC", k1, enc.encode(token));
  const k2 = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k2, enc.encode(check)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== hash) throw new Error("Invalid login");
  const authDate = Number(params.get("auth_date") ?? 0);
  if (Date.now() / 1000 - authDate > 7 * 86400) throw new Error("Login expired, reopen the game");
  const user = JSON.parse(params.get("user") ?? "{}");
  if (typeof user.id !== "number") throw new Error("Invalid login");
  return { id: user.id, first_name: user.first_name ?? "Farmer", username: user.username, start_param: params.get("start_param") ?? undefined };
}

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const initOnly = (d: unknown) => {
  const o = d as { initData?: unknown };
  if (typeof o?.initData !== "string" || o.initData.length > 4096) throw new Error("Invalid input");
  return o as { initData: string };
};

export const loadPlayer = createServerFn({ method: "POST" })
  .inputValidator(initOnly)
  .handler(async ({ data }) => {
    const tg = await verifyInitData(data.initData);
    const db = await admin();
    const { data: row } = await db.from("players").select("*").eq("telegram_id", tg.id).maybeSingle();
    if (row) {
      await db.from("players").update({ first_name: tg.first_name, username: tg.username ?? null }).eq("telegram_id", tg.id);
      return { state: row.state as Record<string, unknown> | null, referralCount: row.referral_count, referralBonus: row.referral_bonus, isNew: false };
    }
    const m = tg.start_param?.match(/^ref_(\d+)$/);
    const refId = m && Number(m[1]) !== tg.id ? Number(m[1]) : null;
    let referredBy: number | null = null;
    if (refId) {
      const { data: ref } = await db.from("players").select("telegram_id, referral_count, referral_bonus").eq("telegram_id", refId).maybeSingle();
      if (ref) {
        referredBy = refId;
        await db.from("players").update({ referral_count: ref.referral_count + 1, referral_bonus: ref.referral_bonus + 100 }).eq("telegram_id", refId);
      }
    }
    await db.from("players").insert({ telegram_id: tg.id, first_name: tg.first_name, username: tg.username ?? null, referred_by: referredBy });
    return { state: null, referralCount: 0, referralBonus: 0, isNew: true };
  });

export const savePlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = initOnly(d) as { initData: string; state?: unknown };
    if (!o.state || typeof o.state !== "object" || JSON.stringify(o.state).length > 50_000) throw new Error("Invalid state");
    return o as { initData: string; state: Record<string, unknown> };
  })
  .handler(async ({ data }) => {
    const tg = await verifyInitData(data.initData);
    const db = await admin();
    // Referral bonuses are granted server-side; merge any unclaimed bonus into balance.
    const { data: row } = await db.from("players").select("referral_bonus").eq("telegram_id", tg.id).maybeSingle();
    const state = { ...data.state, claimedBonus: Number(data.state.claimedBonus ?? 0) };
    await db.from("players").update({ state: JSON.parse(JSON.stringify(state)), updated_at: new Date().toISOString() }).eq("telegram_id", tg.id);
    return { referralBonus: row?.referral_bonus ?? 0 };
  });

export const createWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = d as { initData: string; amount: number; method: string; account: string };
    initOnly(o);
    if (!Number.isInteger(o.amount) || o.amount < 5000) throw new Error("Invalid amount");
    if (typeof o.method !== "string" || o.method.length > 40) throw new Error("Invalid method");
    if (typeof o.account !== "string" || o.account.trim().length < 6 || o.account.length > 60) throw new Error("Invalid account");
    return o;
  })
  .handler(async ({ data }) => {
    const tg = await verifyInitData(data.initData);
    const db = await admin();
    const { error } = await db.from("withdrawals").insert({ telegram_id: tg.id, amount: data.amount, method: data.method, account: data.account.trim() });
    if (error) throw new Error("Could not save request");
    return { ok: true };
  });
