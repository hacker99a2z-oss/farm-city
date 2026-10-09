import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GameShell, SectionTitle } from "@/components/GameShell";
import { CROPS, CROP_KEYS, haptic, money, useGame } from "@/lib/game";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market — Farm City" },
      { name: "description", content: "Sell your harvested crops and buy new seeds in the Farm City market." },
      { property: "og:title", content: "Market — Farm City" },
      { property: "og:description", content: "Sell crops and buy seeds in Farm City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Market,
});

function Market() {
  const game = useGame();
  const [tab, setTab] = useState<"sell" | "buy">("sell");
  const report = (r: { ok: boolean; message: string }) => {
    haptic();
    if (r.ok) toast.success(r.message);
    else toast.error(r.message);
  };

  return (
    <GameShell>
      <SectionTitle kicker="TRADE" title="Market" />
      <div className="card-farm mb-4 grid grid-cols-2 gap-1 p-1">
        {(["sell", "buy"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl py-2 font-display font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t === "sell" ? "Sell crops" : "Buy seeds"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {CROP_KEYS.map((k) => {
          const c = CROPS[k];
          const have = game.state.crops[k];
          return (
            <div key={k} className="card-farm flex items-center gap-3 p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-3xl">
                {tab === "sell" ? c.emoji : <img src={c.image} alt="" className="h-10 w-10" />}
              </div>
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tab === "sell" ? `You have ${have} · ${money(c.sellPrice)} each` : `Owned ${game.state.seeds[k]} · grows ${c.plots} crops`}
                </p>
              </div>
              {tab === "sell" ? (
                <div className="flex gap-1.5">
                  <button className="btn-game btn-gold px-3 text-sm" disabled={have < 1} onClick={() => report(game.sell(k, 1))}>
                    Sell 1
                  </button>
                  <button className="btn-game px-3 text-sm" disabled={have < 1} onClick={() => report(game.sell(k, have))}>
                    All
                  </button>
                </div>
              ) : (
                <button
                  className="btn-game px-3 text-sm"
                  disabled={game.state.balance < c.seedPrice}
                  onClick={() => report(game.buySeed(k))}
                >
                  {money(c.seedPrice)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </GameShell>
  );
}
