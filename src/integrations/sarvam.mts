import type { SupportedLanguage } from "../shared/protocol.ts";

const SARVAM_BASE_URL = "https://api.sarvam.ai";

const SYSTEM_PROMPT = [
  "You are Kaka, a warm, cheerful mithai and souvenir shopkeeper at an Indian nighttime carnival (MelaQuest).",
  "Menu items and fixed prices: Warm Jalebi (15 coins), Motichoor Ladoo (20 coins), Mango Lassi (12 coins), Paper Lantern (25 coins), Marigold Garland (10 coins).",
  "Reply in 1-2 short, friendly sentences in the requested language.",
  "Never change prices, never promise free coins, and never claim to authorize purchases—tell guests to click Buy in the shop panel.",
].join(" ");

const MOCK_REPLIES: Record<SupportedLanguage, string> = {
  "en-IN": "Namaste! Try our warm jalebi (15 coins) or chilled mango lassi (12 coins) — click Buy anytime!",
  "hi-IN": "नमस्ते! गरमा-गरम जलेबी (15 सिक्के) या आम की लस्सी (12 सिक्के) ज़रूर चखें — खरीदने के लिए Buy पर क्लिक करें!",
  "ta-IN": "வணக்கம்! சூடான ஜிலேபி (15 நாணயங்கள்) அல்லது மாம்பழ லஸ்ஸி (12 நாணயங்கள்) முயற்சி செய்யுங்கள்!",
  "bn-IN": "নমস্কার! গরম জিলিপি (১৫ কয়েন) বা আমের লস্যি (১২ কয়েন) খেয়ে দেখুন — কিনতে Buy বোতামে ক্লিক করুন!",
  "te-IN": "నమస్కారం! వేడి జిలేబీ (15 నాణేలు) లేదా మామిడి లస్సీ (12 నాణేలు) రుచి చూడండి!",
  "mr-IN": "नमस्कार! गरमागरम जिलेबी (15 नाणी) किंवा मँगो लस्सी (12 नाणी) नक्की घ्या!",
};

function getApiKey(): string | null {
  if (process.env.SPONSOR_MODE === "mock") return null;
  const key = process.env.SARVAM_API_KEY?.trim();
  return key ? key : null;
}

async function synthesizeSpeech(apiKey: string, text: string, language: SupportedLanguage): Promise<string | undefined> {
  try {
    const response = await fetch(`${SARVAM_BASE_URL}/text-to-speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 300),
        target_language_code: language,
        model: "bulbul:v3",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { audios?: string[] };
    return data.audios?.[0];
  } catch {
    return undefined;
  }
}

export async function sarvamShopChat(
  message: string,
  language: SupportedLanguage,
): Promise<{ reply: string; audioBase64?: string; mode: "live" | "mock" }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { reply: MOCK_REPLIES[language], mode: "mock" };
  }

  try {
    const response = await fetch(`${SARVAM_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        model: "sarvam-105b-conversations",
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT} Respond in language code ${language}.` },
          { role: "user", content: message },
        ],
        max_tokens: 180,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { reply: MOCK_REPLIES[language], mode: "mock" };
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return { reply: MOCK_REPLIES[language], mode: "mock" };
    }
    const audioBase64 = await synthesizeSpeech(apiKey, reply, language);
    return { reply, audioBase64, mode: "live" };
  } catch {
    return { reply: MOCK_REPLIES[language], mode: "mock" };
  }
}

export async function sarvamShopVoice(
  audioBase64: string,
  mimeType: string,
  language: SupportedLanguage,
): Promise<{ transcript: string; reply: string; audioBase64?: string; mode: "live" | "mock" }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      transcript: "(Voice mock mode)",
      reply: MOCK_REPLIES[language],
      mode: "mock",
    };
  }

  try {
    const bytes = Buffer.from(audioBase64, "base64");
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimeType }), "voice.webm");
    form.append("model", "saaras:v3");
    form.append("language_code", language);

    const sttResponse = await fetch(`${SARVAM_BASE_URL}/speech-to-text`, {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!sttResponse.ok) {
      return { transcript: "(Transcription unavailable)", reply: MOCK_REPLIES[language], mode: "mock" };
    }
    const sttData = (await sttResponse.json()) as { transcript?: string };
    const transcript = sttData.transcript?.trim() || "Hello shopkeeper!";
    const chat = await sarvamShopChat(transcript, language);
    return { transcript, ...chat };
  } catch {
    return { transcript: "(Voice timeout)", reply: MOCK_REPLIES[language], mode: "mock" };
  }
}
