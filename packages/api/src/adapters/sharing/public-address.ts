import type { ShareInfo } from "@pairbox/shared";

/**
 * Works out the public address of the app for invite links: PUBLIC_URL if set, otherwise the
 * address of the Cloudflare quick tunnel, read from cloudflared's status endpoint.
 */
export class PublicAddress {
  private tunnelUrl: string | undefined;

  constructor(
    private readonly publicUrl: string | undefined,
    private readonly tunnelStatusUrl: string | undefined,
  ) {}

  async get(): Promise<ShareInfo> {
    if (this.publicUrl) return { baseUrl: this.publicUrl.replace(/\/$/, ""), pending: false };
    if (!this.tunnelStatusUrl) return { baseUrl: null, pending: false };

    this.tunnelUrl ??= await this.askTunnel();
    // Not known yet: either it's still starting, or it isn't running at all.
    return { baseUrl: this.tunnelUrl ?? null, pending: this.tunnelUrl === undefined };
  }

  private async askTunnel(): Promise<string | undefined> {
    try {
      const response = await fetch(`${this.tunnelStatusUrl}/quicktunnel`, {
        signal: AbortSignal.timeout(2_000),
      });
      const { hostname } = (await response.json()) as { hostname?: string };
      return hostname ? `https://${hostname}` : undefined;
    } catch {
      return undefined;
    }
  }
}
