import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GameShell, SectionTitle } from "@/components/GameShell";
import { CROPS, CROP_KEYS, haptic, useGame, type CropKey } from "@/lib/game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Farm City — Grow, harvest & earn" },
      { name: "description", content: "Plant seeds, water your fields, harvest crops and earn in Farm City, a Telegram farming game." },
      { property: "og:title", content: "Farm City — Grow, harvest & earn" },
      { property: "og:description", content: "Plant seeds, water your fields and harvest crops in Farm City." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { state } = useGame();
  return (
    <GameShell>
      <section className="card-farm mb-5 p-4">
        <SectionTitle kicker="YOUR INVENTORY" title="Seeds" />
        <div className="grid grid-cols-5 gap-2">
          {CROP_KEYS.map((k) => (
            <div key={k} className="relative flex flex-col items-center rounded-xl bg-secondary p-2">
              <img src={CROPS[k].image} alt="" className="h-10 w-10" />
              <span className="text-[11px] font-bold">{CROPS[k].name}</span>
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-gradient px-1 text-[11px] font-extrabold text-gold-foreground">
                {state.seeds[k]}
              </span>
            </div>
          ))}
        </div>
      </section>

      <SectionTitle kicker="YOUR LAND" title="Fields" />
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">Tap an empty field to plant, tap again to water.</p>
      <div className="grid grid-cols-2 gap-3">
        {CROP_KEYS.map((k) => (
          <FieldCard key={k} k={k} />
        ))}
      </div>
    </GameShell>
  );
}

function FieldCard({ k }: { k: CropKey }) {
  const game = useGame();
  const crop = CROPS[k];
  const field = game.state.fields[k];
  const ready = field.planted && field.watered >= crop.waterNeed;
  const progress = field.planted ? field.watered / crop.waterNeed : 0;
  const [shake, setShake] = useState(false);
  const [drops, setDrops] = useState<number[]>([]);

  const onTap = () => {
    haptic();
    const res = !field.planted ? game.plant(k) : ready ? game.harvest(k) : game.waterField(k);
    if (!res.ok) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      toast.error(res.message);
      return;
    }
    if (field.planted && !ready) {
      const id = Date.now();
      setDrops((d) => [...d, id]);
      setTimeout(() => setDrops((d) => d.filter((x) => x !== id)), 800);
    } else {
      toast.success(res.message);
    }
  };

  const stage = progress >= 1 ? crop.emoji : progress >= 0.5 ? "🌿" : "🌱";

  return (
    <button
      type="button"
      onClick={onTap}
      className={`card-farm relative overflow-hidden p-2 text-left ${k === "pumpkin" ? "col-span-2" : ""} ${shake ? "animate-shake" : ""}`}
    >
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="font-display text-sm font-semibold">{crop.name} Field</span>
        {ready ? (
          <span className="rounded-full bg-gold-gradient px-2 py-0.5 text-[10px] font-extrabold text-gold-foreground">HARVEST</span>
        ) : field.planted ? (
          <span className="text-[11px] font-bold text-water">
            💧 {field.watered}/{crop.waterNeed}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-muted-foreground">Empty</span>
        )}
      </div>
      <div className={`grid gap-1.5 ${crop.plots === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
        {Array.from({ length: crop.plots }).map((_, i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-lg bg-soil-gradient text-3xl shadow-inner">
            {field.planted && (
              <span key={stage} className={`animate-pop-in ${ready ? "animate-sway" : ""}`}>
                {stage}
              </span>
            )}
          </div>
        ))}
      </div>
      {field.planted && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-water-gradient transition-all" style={{ width: `${Math.min(1, progress) * 100}%` }} />
        </div>
      )}
      {drops.map((id) => (
        <span key={id} className="pointer-events-none absolute left-1/2 top-1/3 animate-float-up text-2xl">
          💧
        </span>
      ))}
    </button>
  );
}
