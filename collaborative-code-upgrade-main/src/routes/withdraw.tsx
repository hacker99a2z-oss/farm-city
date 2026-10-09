import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GameShell, SectionTitle } from "@/components/GameShell";
import { MIN_WITHDRAW, money, useGame } from "@/lib/game";

const METHODS = ["bKash", "Nagad", "Rocket"];

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: "Withdraw — Farm City" },
      { name: "description", content: "Request a withdrawal of your Farm City balance." },
      { property: "og:title", content: "Withdraw — Farm City" },
      { property: "og:description", content: "Request a withdrawal of your Farm City balance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Withdraw,
});

function Withdraw() {
  const game = useGame();
  const [method, setMethod] = useState<string>("bKash");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const pct = Math.min(100, (game.state.balance / MIN_WITHDRAW) * 100);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = game.requestWithdraw(Number(amount), method, account);
    if (r.ok) {
      toast.success(r.message);
      setAmount("");
    } else toast.error(r.message);
  };

  return (
    <GameShell>
      <SectionTitle kicker="CASH OUT" title="Withdraw" />
      <section className="card-farm mb-4 p-4">
        <p className="text-xs font-bold text-muted-foreground">PROGRESS TO MINIMUM</p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gold-gradient" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-sm font-semibold">
          {money(game.state.balance)} / {money(MIN_WITHDRAW)}
        </p>
      </section>

      <form onSubmit={submit} className="card-farm mb-4 space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-xl border-2 py-2 font-display font-semibold ${method === m ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          className="w-full rounded-xl border-2 border-input bg-background px-3 py-2.5 font-semibold outline-none focus:border-ring"
          placeholder={`${method} number`}
          inputMode="tel"
          maxLength={20}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
        <input
          className="w-full rounded-xl border-2 border-input bg-background px-3 py-2.5 font-semibold outline-none focus:border-ring"
          placeholder={`Amount (min ${money(MIN_WITHDRAW)})`}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        />
        <button className="btn-game btn-gold w-full" disabled={game.state.balance < MIN_WITHDRAW}>
          Request withdraw
        </button>
      </form>

      <h3 className="mb-2 text-lg font-semibold">History</h3>
      {game.state.withdrawals.length === 0 ? (
        <p className="card-farm p-4 text-center text-sm text-muted-foreground">No requests yet</p>
      ) : (
        <div className="space-y-2">
          {game.state.withdrawals.map((w) => (
            <div key={w.id} className="card-farm flex items-center justify-between p-3">
              <div>
                <p className="font-display font-semibold">{money(w.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {w.method} · {w.account}
                </p>
              </div>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">Pending</span>
            </div>
          ))}
        </div>
      )}
    </GameShell>
  );
}
