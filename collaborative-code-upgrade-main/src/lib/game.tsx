import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import wheatImg from "@/assets/wheat-seed.svg";
import cornImg from "@/assets/corn-seed.svg";
import carrotImg from "@/assets/carrot-seed.svg";
import tomatoImg from "@/assets/tomato-seed.svg";
import pumpkinImg from "@/assets/pumpkin-seed.svg";

export type CropKey = "wheat" | "corn" | "carrot" | "tomato" | "pumpkin";

export const CROPS: Record<
  CropKey,
  { name: string; emoji: string; image: string; waterNeed: number; seedPrice: number; sellPrice: number; plots: number }
> = {
  wheat: { name: "Wheat", emoji: "🌾", image: wheatImg, waterNeed: 5, seedPrice: 20, sellPrice: 18, plots: 2 },
  corn: { name: "Corn", emoji: "🌽", image: cornImg, waterNeed: 7, seedPrice: 40, sellPrice: 32, plots: 2 },
  carrot: { name: "Carrot", emoji: "🥕", image: carrotImg, waterNeed: 10, seedPrice: 70, sellPrice: 55, plots: 2 },
  tomato: { name: "Tomato", emoji: "🍅", image: tomatoImg, waterNeed: 8, seedPrice: 55, sellPrice: 45, plots: 2 },
  pumpkin: { name: "Pumpkin", emoji: "🎃", image: pumpkinImg, waterNeed: 12, seedPrice: 120, sellPrice: 50, plots: 4 },
};
export const CROP_KEYS = Object.keys(CROPS) as CropKey[];

export const MAX_WATER = 20;
export const WATER_REGEN_MS = 30_000;
export const MIN_WITHDRAW = 5000;
export const REFER_BONUS = 100;

type Field = { planted: boolean; watered: number };
export type Withdrawal = { id: string; amount: number; method: string; account: string; status: "pending"; date: string };

type GameState = {
  balance: number;
  water: number;
  waterAt: number;
  seeds: Record<CropKey, number>;
  crops: Record<CropKey, number>;
  fields: Record<CropKey, Field>;
  withdrawals: Withdrawal[];
};

const makeRecord = <T,>(fn: () => T) =>
  Object.fromEntries(CROP_KEYS.map((k) => [k, fn()])) as Record<CropKey, T>;

const freshState = (): GameState => ({
  balance: 500,
  water: MAX_WATER,
  waterAt: Date.now(),
  seeds: makeRecord(() => 1),
  crops: makeRecord(() => 0),
  fields: makeRecord(() => ({ planted: false, watered: 0 })),
  withdrawals: [],
});

export type TgUser = { id: number | null; name: string; username?: string | undefined };

const STORAGE_KEY = "farm-city-save-v1";

function regen(s: GameState, now: number): GameState {
  if (s.water >= MAX_WATER) return { ...s, waterAt: now };
  const gained = Math.floor((now - s.waterAt) / WATER_REGEN_MS);
  if (gained <= 0) return s;
  const water = Math.min(MAX_WATER, s.water + gained);
  return { ...s, water, waterAt: water >= MAX_WATER ? now : s.waterAt + gained * WATER_REGEN_MS };
}

type Result = { ok: boolean; message: string };

type GameCtx = {
  state: GameState;
  user: TgUser;
  ready: boolean;
  nextWaterIn: number;
  buySeed: (k: CropKey, qty?: number) => Result;
  plant: (k: CropKey) => Result;
  waterField: (k: CropKey) => Result;
  harvest: (k: CropKey) => Result;
  sell: (k: CropKey, qty: number) => Result;
  requestWithdraw: (amount: number, method: string, account: string) => Result;
};

const Ctx = createContext<GameCtx | null>(null);

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  initDataUnsafe?: { user?: { id: number; first_name: string; last_name?: string; username?: string } };
  HapticFeedback?: { impactOccurred: (s: string) => void };
};
const getTg = (): TelegramWebApp | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;

export const haptic = () => getTg()?.HapticFeedback?.impactOccurred("light");

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(freshState);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0);
  const [user, setUser] = useState<TgUser>({ id: null, name: "Farmer" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(regen({ ...freshState(), ...JSON.parse(raw) }, Date.now()));
    } catch {
      /* ignore broken save */
    }
    const tg = getTg();
    tg?.ready();
    tg?.expand();
    const u = tg?.initDataUnsafe?.user;
    if (u) setUser({ id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(" "), username: u.username });
    setNow(Date.now());
    setReady(true);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setState((s) => regen(s, now));
  }, [now, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const act = useCallback((fn: (s: GameState) => GameState | string, success: string): Result => {
    let result: Result = { ok: true, message: success };
    setState((s) => {
      const out = fn(s);
      if (typeof out === "string") {
        result = { ok: false, message: out };
        return s;
      }
      return out;
    });
    return result;
  }, []);

  // Validation happens against the latest rendered state so the returned message is accurate.
  const value = useMemo<GameCtx>(() => {
    const s = state;
    return {
      state,
      user,
      ready,
      nextWaterIn: s.water >= MAX_WATER ? 0 : Math.max(0, Math.ceil((s.waterAt + WATER_REGEN_MS - now) / 1000)),
      buySeed: (k, qty = 1) => {
        const cost = CROPS[k].seedPrice * qty;
        if (s.balance < cost) return { ok: false, message: "Not enough balance" };
        return act(
          (st) => ({ ...st, balance: st.balance - cost, seeds: { ...st.seeds, [k]: st.seeds[k] + qty } }),
          `Bought ${qty} ${CROPS[k].name} seed`,
        );
      },
      plant: (k) => {
        if (s.fields[k].planted) return { ok: false, message: "This field is already growing" };
        if (s.seeds[k] < 1) return { ok: false, message: `No ${CROPS[k].name} seeds — buy some in the Market` };
        return act(
          (st) => ({
            ...st,
            seeds: { ...st.seeds, [k]: st.seeds[k] - 1 },
            fields: { ...st.fields, [k]: { planted: true, watered: 0 } },
          }),
          `${CROPS[k].name} planted! Now water it`,
        );
      },
      waterField: (k) => {
        const f = s.fields[k];
        if (!f.planted) return { ok: false, message: "Plant a seed first" };
        if (f.watered >= CROPS[k].waterNeed) return { ok: false, message: "Ready to harvest!" };
        if (s.water < 1) return { ok: false, message: "Out of water — wait for refill" };
        return act(
          (st) => ({
            ...st,
            water: st.water - 1,
            waterAt: st.water >= MAX_WATER ? Date.now() : st.waterAt,
            fields: { ...st.fields, [k]: { ...st.fields[k], watered: st.fields[k].watered + 1 } },
          }),
          "Watered 💧",
        );
      },
      harvest: (k) => {
        const f = s.fields[k];
        if (!f.planted || f.watered < CROPS[k].waterNeed) return { ok: false, message: "Not ready yet" };
        const qty = CROPS[k].plots;
        return act(
          (st) => ({
            ...st,
            crops: { ...st.crops, [k]: st.crops[k] + qty },
            fields: { ...st.fields, [k]: { planted: false, watered: 0 } },
          }),
          `Harvested ${qty} ${CROPS[k].name}! Sell them in the Market`,
        );
      },
      sell: (k, qty) => {
        if (qty < 1 || s.crops[k] < qty) return { ok: false, message: "Not enough crops" };
        const earn = CROPS[k].sellPrice * qty;
        return act(
          (st) => ({ ...st, balance: st.balance + earn, crops: { ...st.crops, [k]: st.crops[k] - qty } }),
          `Sold for $${earn}`,
        );
      },
      requestWithdraw: (amount, method, account) => {
        if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) return { ok: false, message: `Minimum withdraw is $${MIN_WITHDRAW}` };
        if (amount > s.balance) return { ok: false, message: "Not enough balance" };
        if (account.trim().length < 6) return { ok: false, message: "Enter a valid account number" };
        return act(
          (st) => ({
            ...st,
            balance: st.balance - amount,
            withdrawals: [
              { id: String(Date.now()), amount, method, account: account.trim(), status: "pending", date: new Date().toISOString() },
              ...st.withdrawals,
            ],
          }),
          "Withdraw request sent",
        );
      },
    };
  }, [state, user, ready, now, act]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGame must be inside GameProvider");
  return c;
}

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
