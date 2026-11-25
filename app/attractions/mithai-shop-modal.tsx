"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATALOG_IDS, CATALOG_ITEMS, type CatalogItemId } from "../../src/shared/catalog.ts";
import {
  SUPPORTED_LANGUAGES,
  type ShopChatResult,
  type ShopPurchaseResult,
  type ShopVoiceResult,
  type SupportedLanguage,
} from "../../src/shared/protocol.ts";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  "en-IN": "English",
  "hi-IN": "हिन्दी (Hindi)",
  "ta-IN": "தமிழ் (Tamil)",
  "bn-IN": "বাংলা (Bengali)",
  "te-IN": "తెలుగు (Telugu)",
  "mr-IN": "मराठी (Marathi)",
};

export function MithaiShopModal({
  coins,
  inventory,
  muted,
  aiEnabled,
  onPurchase,
  onChat,
  onVoice,
  onClose,
}: {
  coins: number;
  inventory: Record<string, number>;
  muted: boolean;
  aiEnabled: boolean;
  onPurchase: (itemId: CatalogItemId) => Promise<ShopPurchaseResult>;
  onChat: (message: string, language: SupportedLanguage) => Promise<ShopChatResult>;
  onVoice: (audioBase64: string, mimeType: string, language: SupportedLanguage) => Promise<ShopVoiceResult>;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage>("en-IN");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "kaka"; text: string; mode?: "live" | "mock" }[]>([
    { role: "kaka", text: "Namaste! Welcome to the Mithai & Souvenir Shop. Ask me anything in your language!" },
  ]);
  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    closeButton.current?.focus();
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function playAudio(audioBase64?: string) {
    if (!audioBase64 || muted) return;
    try {
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      void audio.play().catch(() => undefined);
    } catch {
      // Ignore playback issues when autoplay is blocked.
    }
  }

  async function handleBuy(itemId: CatalogItemId) {
    setBusy(true);
    const result = await onPurchase(itemId);
    setBusy(false);
    if (result.ok) {
      setShopNotice(`Bought ${CATALOG_ITEMS[itemId].name}!`);
    } else if (result.code === "INSUFFICIENT_FUNDS") {
      setShopNotice("Not enough coins! Play the Balloon Stall game to earn more.");
    } else {
      setShopNotice("Could not complete purchase.");
    }
  }

  async function handleChat(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setBusy(true);
    const result = await onChat(trimmed, language);
    setBusy(false);
    if (result.ok) {
      setMessages((prev) => [...prev, { role: "kaka", text: result.reply, mode: result.mode }]);
      playAudio(result.audioBase64);
    } else {
      setMessages((prev) => [...prev, { role: "kaka", text: "Shopkeeper is busy right now." }]);
    }
  }

  async function toggleMic() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setShopNotice("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = typeof reader.result === "string" ? reader.result : "";
          const base64 = dataUrl.split(",")[1] ?? "";
          if (!base64) return;
          setBusy(true);
          void onVoice(base64, blob.type, language).then((res) => {
            setBusy(false);
            if (res.ok) {
              setMessages((prev) => [
                ...prev,
                { role: "user", text: res.transcript },
                { role: "kaka", text: res.reply, mode: res.mode },
              ]);
              playAudio(res.audioBase64);
            }
          });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setRecording(true);
      setShopNotice("Recording… click Stop when done.");
      window.setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          setRecording(false);
        }
      }, 6000);
    } catch {
      setShopNotice("Microphone permission denied.");
    }
  }

  return (
    <div className="world-dialog shop-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-title">
      <div className="balloon-header">
        <h2 id="shop-title">Mithai &amp; Souvenir Shop</h2>
        <p className="balloon-timer">Coins: {coins}</p>
      </div>

      <div className="shop-catalog" aria-label="Shop catalog">
        {CATALOG_IDS.map((id) => {
          const item = CATALOG_ITEMS[id];
          const owned = inventory[id] ?? 0;
          return (
            <div key={id} className="shop-item">
              <div>
                <strong>{item.name}</strong> · {item.price} coins
                {owned > 0 && <span className="lobby-muted"> (Owned: {owned})</span>}
                <p className="shop-item-desc">{item.description}</p>
              </div>
              <button type="button" className="lobby-secondary" disabled={busy || coins < item.price}
                onClick={() => void handleBuy(id)}>
                Buy
              </button>
            </div>
          );
        })}
      </div>

      {shopNotice && <p role="status" className="balloon-feedback">{shopNotice}</p>}

      {aiEnabled && (
        <div className="shop-chat-box">
          <div className="shop-chat-top">
            <label htmlFor="shop-language">Kaka (Sarvam AI)</label>
            <select id="shop-language" value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>
              ))}
            </select>
          </div>
          <div className="shop-chat-log" aria-live="polite">
            {messages.map((msg, idx) => (
              <p key={idx} className={msg.role === "user" ? "shop-msg-user" : "shop-msg-kaka"}>
                <strong>{msg.role === "user" ? "You" : "Kaka"}:</strong> {msg.text}
                {msg.mode && <span className="shop-mode-tag"> [{msg.mode}]</span>}
              </p>
            ))}
          </div>
          <form className="shop-chat-form" onSubmit={(e) => void handleChat(e)}>
            <input
              aria-label="Message shopkeeper"
              placeholder="Ask about sweets or prices…"
              value={prompt}
              maxLength={300}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button type="submit" className="lobby-primary" disabled={busy || !prompt.trim()}>Send</button>
            <button type="button" className="lobby-secondary" disabled={busy} onClick={() => void toggleMic()}>
              {recording ? "Stop" : "Mic"}
            </button>
          </form>
        </div>
      )}

      <div className="world-dialog-actions">
        <button ref={closeButton} type="button" className="lobby-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
