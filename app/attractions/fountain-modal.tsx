"use client";

import { useEffect, useRef, useState } from "react";
import type { FireworksContributeResult, FireworksState } from "../../src/shared/protocol.ts";

export function FountainModal({
  coins,
  fireworksState,
  onContribute,
  onClose,
}: {
  coins: number;
  fireworksState: FireworksState | null;
  onContribute: (amount: number) => Promise<FireworksContributeResult>;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  const pool = fireworksState?.pool ?? 0;
  const threshold = fireworksState?.threshold ?? 20;

  async function contribute(amount: number) {
    setBusy(true);
    setStatus(null);
    const result = await onContribute(amount);
    setBusy(false);
    if (result.ok) {
      setStatus(result.started ? "Fireworks launched for the whole room!" : `Contributed ${amount} coins!`);
    } else if (result.code === "INSUFFICIENT_FUNDS") {
      setStatus("Not enough coins to contribute.");
    } else if (result.code === "COOLDOWN") {
      setStatus("Fireworks are cooling down — try again in a few seconds.");
    } else {
      setStatus("Could not contribute right now.");
    }
  }

  return (
    <div className="world-dialog" role="dialog" aria-modal="true" aria-labelledby="fountain-title">
      <h2 id="fountain-title">Plaza Fountain &amp; Fireworks</h2>
      <p>Pool coins with your friends to launch a synchronized fireworks celebration over the fairground.</p>
      <p><strong>Pool: {pool} / {threshold} coins</strong> (Your coins: {coins})</p>
      {status && <p role="status" className="balloon-feedback">{status}</p>}
      <div className="world-dialog-actions">
        <button type="button" className="lobby-primary" disabled={busy || coins < 5}
          onClick={() => void contribute(5)}>
          Contribute 5
        </button>
        <button type="button" className="lobby-primary" disabled={busy || coins < 10}
          onClick={() => void contribute(10)}>
          Contribute 10
        </button>
        <button ref={closeButton} type="button" className="lobby-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
