# Mela.io — 60-second sponsor demo

Record one real room with three independent browser profiles or devices. Use the host as the main view, with guest views inset only when they prove a shared event. Cut the real session to 60 seconds. Keep clicks, a balloon pop and Kaka’s voice audible. Skip intro cards and end on gameplay.

| Time | Show | Say |
| --- | --- | --- |
| 0–8s | Host creates a private room and copies the invite. Two guests open that link in separate profiles. Jump-cut to the roster showing **3 of 5**. | “One invite brings three friends into Mela.io, our Indian night carnival.” |
| 8–14s | Enter the fair. Show the man, woman and cat moving together past the fountain. Use a short guest inset to show the same moment. | “Pick an avatar and meet at the fountain. Everyone sees each other move.” |
| 14–25s | Brief inset of the real Flagsmith flag flipping on. Keep a connected player's coin HUD visible as **(2x)** appears. Cut to two players popping balloons, then the shared scores and earned coins. | “Flagsmith turns on double rewards without a redeploy. We pop balloons, compare scores, and earn coins.” |
| 25–39s | Open the Mithai Shop, choose Hindi, tap the mic and ask “जलेबी कितने की है?” Show the transcript and let Kaka’s real audio play. Then click **Buy** on Warm Jalebi and show the balance change. | “At the Mithai Shop, Sarvam AI lets us ask Kaka about jalebi in Hindi.” Then pause for the spoken exchange. |
| 39–47s | Two players board the Ferris wheel. Show two distinct seats and the synchronized ride from two views. | “Then we take the Ferris wheel together.” |
| 47–60s | At the fountain, two guests contribute 10 coins each. Show the 20-coin threshold and the same fireworks burst on the host and one guest view. Hold the final shot for two seconds. | “We pool twenty coins at the fountain, and the same fireworks light up everyone’s sky.” |

## Recording notes

- Preflight on the `sponsor-demo` branch at `efaa855` or the intended successor. Verify a live Hindi mic request, a readable transcript and audible shopkeeper reply. Allow mic access on localhost or HTTPS. Caption the real reply. If voice fails but live text works, capture the typed Hindi exchange and say “Sarvam AI answers our questions in Hindi.” If the app returns a mock reply, label the fallback and omit the live sponsor claim.
- Prepare Flagsmith's `double_rewards` flag and wait for the **(2x)** HUD change in an already connected client before continuing. Trim the polling delay in the edit. If that change cannot be verified, omit the flag clip and say “We pop balloons, compare scores, and earn coins.”
- Use the host for the 15-coin jalebi purchase and reserve at least 10 earned coins each on the two contributing guests. Play extra rounds before filming the finale if needed. Cut the 30-second balloon round from action to results. Use real joins, rewards, purchases and contributions throughout. Keep the invite token and any dashboard secrets out of the exported video.
- NudgeBee is excluded from the main cut. The branch exposes Prometheus metrics at `/api/metrics`, but the reviewed files and ledger provide no evidence of a live NudgeBee connection. If live evidence becomes available, trade a few seconds from the ride for a real NudgeBee workload view tied to a captured gameplay signal and name exactly what it showed.

## Branch evidence & recorded capture

- **Recorded video:** [`docs/media/mela-demo.mp4`](media/mela-demo.mp4) (`51.4s`, `1280x720`, H.264 + AAC) captures a real 3-player room (`Mira`, `Asha`, `Kabir`) on branch `sponsor-demo` with synthesized voice narration via Sarvam AI `bulbul:v3`, including a verified **`[live]`** Sarvam AI Hindi exchange (`"जलेबी कितने की है?"` -> `"नमस्ते! गर्म जलेबी 15 सिक्कों की है। कृपया दुकान पैनल में Buy पर क्लिक करें।"`), a Warm Jalebi purchase, shared Balloon Stall play, Ferris Wheel gondola reservations, and the 20-coin Fountain Fireworks finale.
- **Screenshots:** `docs/media/01-lobby-room.png` through `docs/media/06-fireworks.png` show each stage of the session.
- **Sponsor scope notes:** Live Flagsmith dashboard toggling and a live NudgeBee cluster connection remain outside this local recording; both adapters and `/api/metrics` are implemented and documented honestly in `README.md` and `docs/PROGRESS.md`.
