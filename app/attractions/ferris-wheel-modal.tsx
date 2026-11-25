"use client";

import { useEffect, useRef, useState } from "react";
import type { RideBoardResult, RideExitResult, RideState } from "../../src/shared/protocol.ts";

export function FerrisWheelModal({
  playerId,
  rideState,
  onBoard,
  onExit,
  onClose,
}: {
  playerId: string;
  rideState: RideState | null;
  onBoard: (seatIndex?: number) => Promise<RideBoardResult>;
  onExit: () => Promise<RideExitResult>;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  const seats = rideState?.seats ?? Array.from({ length: 8 }, () => null);
  const mySeat = seats.indexOf(playerId);

  async function handleBoard(seatIndex?: number) {
    setBusy(true);
    setStatus(null);
    const result = await onBoard(seatIndex);
    setBusy(false);
    if (result.ok) {
      setStatus(`Boarded Gondola #${result.seatIndex + 1}! Enjoy the view.`);
    } else if (result.code === "SEAT_OCCUPIED") {
      setStatus("That gondola is already occupied.");
    } else if (result.code === "TOO_FAR") {
      setStatus("Move closer to the Ferris Wheel to board.");
    } else {
      setStatus("Could not board right now.");
    }
  }

  async function handleExit() {
    setBusy(true);
    const result = await onExit();
    setBusy(false);
    if (result.ok) setStatus("Exited safely onto the plaza.");
  }

  return (
    <div className="world-dialog balloon-dialog" role="dialog" aria-modal="true" aria-labelledby="ferris-title">
      <h2 id="ferris-title">Ferris Wheel</h2>
      <p>
        {mySeat !== -1
          ? `You are riding in Gondola #${mySeat + 1}.`
          : "Choose an open gondola to ride above the night fair."}
      </p>
      <div className="ferris-seats" role="group" aria-label="Gondola seats">
        {seats.map((occupant, index) => {
          const isMine = occupant === playerId;
          const taken = occupant !== null && !isMine;
          return (
            <button
              key={index}
              type="button"
              className={`ferris-seat ${isMine ? "ferris-seat-mine" : taken ? "ferris-seat-taken" : ""}`}
              disabled={busy || taken || mySeat !== -1}
              onClick={() => void handleBoard(index)}
            >
              Gondola {index + 1} {isMine ? "(You)" : taken ? "(Taken)" : "(Open)"}
            </button>
          );
        })}
      </div>
      {status && <p role="status" className="balloon-feedback">{status}</p>}
      <div className="world-dialog-actions">
        {mySeat === -1 ? (
          <button type="button" className="lobby-primary" disabled={busy} onClick={() => void handleBoard()}>
            Board next open
          </button>
        ) : (
          <button type="button" className="lobby-primary" disabled={busy} onClick={() => void handleExit()}>
            Exit ride
          </button>
        )}
        <button ref={closeButton} type="button" className="lobby-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
