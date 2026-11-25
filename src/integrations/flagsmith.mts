import type { FeatureFlags } from "../shared/protocol.ts";

export const DEFAULT_FLAGS: FeatureFlags = {
  balloon_game: true,
  ferris_wheel: true,
  ai_shopkeeper: true,
  fireworks: true,
  double_rewards: false,
};

interface FlagsmithFlag {
  feature?: { name?: string };
  enabled?: boolean;
}

export class FlagsmithAdapter {
  private flags: FeatureFlags = { ...DEFAULT_FLAGS };
  private readonly onChange?: (flags: FeatureFlags) => void;

  constructor(onChange?: (flags: FeatureFlags) => void) {
    this.onChange = onChange;
  }

  getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  async refresh(): Promise<FeatureFlags> {
    if (process.env.SPONSOR_MODE === "mock") return this.getFlags();
    const envKey = process.env.FLAGSMITH_ENVIRONMENT_KEY?.trim();
    if (!envKey) return this.getFlags();

    const baseUrl = (process.env.FLAGSMITH_API_URL?.trim() || "https://edge.api.flagsmith.com/api/v1/").replace(/\/+$/, "");
    try {
      const response = await fetch(`${baseUrl}/flags/`, {
        headers: { "X-Environment-Key": envKey },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return this.getFlags();
      const items = (await response.json()) as FlagsmithFlag[];
      const next: FeatureFlags = { ...DEFAULT_FLAGS };
      for (const item of items) {
        const name = item.feature?.name;
        if (name && name in next && typeof item.enabled === "boolean") {
          next[name as keyof FeatureFlags] = item.enabled;
        }
      }
      const changed = (Object.keys(next) as (keyof FeatureFlags)[]).some((k) => next[k] !== this.flags[k]);
      this.flags = next;
      if (changed) this.onChange?.(this.getFlags());
    } catch {
      // Keep last known safe defaults if Flagsmith is unreachable.
    }
    return this.getFlags();
  }
}
