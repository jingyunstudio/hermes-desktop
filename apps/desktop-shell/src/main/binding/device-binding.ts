import { createHash } from "node:crypto";
import os from "node:os";
import { app } from "electron";
import { AppSettings, DeviceBindingState } from "@hermes-desktop/shared-types";

interface PairActivateResponse {
  instance_id: string;
  instance_token: string;
}

interface ApiResponseEnvelope<T> {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
}

interface JwtClaims {
  tenant_id?: string | number;
  user_id?: string | number;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

function toStringClaim(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export class DesktopDeviceBindingService {
  private state: DeviceBindingState = {
    status: "idle",
    message: "请先在 User-App 的 Hermes 页面生成设备码。",
    updatedAt: Date.now(),
  };

  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private readonly settings: AppSettings) {}

  dispose(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  getState(): DeviceBindingState {
    return { ...this.state };
  }

  async activateWithPairCode(pairCode: string): Promise<DeviceBindingState> {
    const trimmedCode = pairCode.trim();
    if (!trimmedCode) {
      const message = "请输入设备码。";
      this.setState({
        status: "error",
        message,
      });
      throw new Error(message);
    }

    try {
      const payload = {
        pair_code: trimmedCode,
      };
      const res = await this.request<PairActivateResponse>("/v1/plugins/hermes_agent/pair/activate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const claims = res.instance_token ? this.decodeJwtClaims(res.instance_token) : null;
      const tenantId = toStringClaim(claims?.tenant_id);
      const userId = toStringClaim(claims?.user_id);

      this.setState({
        status: "bound",
        pairCode: trimmedCode,
        pollIntervalSec: undefined,
        expiresAt: undefined,
        instanceId: res.instance_id,
        tenantId,
        userId,
        message: "设备绑定成功。",
      });

      this.startHeartbeatLoop();
      void this.sendHeartbeat();
      
      return this.getState();
    } catch (error) {
      const message = error instanceof Error ? error.message : "绑定设备码失败";
      this.dispose();
      this.setState({
        status: "error",
        pairCode: trimmedCode,
        message,
      });
      throw new Error(message);
    }
  }

  private startHeartbeatLoop(): void {
    if (!this.state.instanceId) {
      return;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.state.instanceId) {
      return;
    }

    try {
      await this.request<{ success: boolean }>("/v1/plugins/hermes_agent/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          instance_id: this.state.instanceId,
          version: app.getVersion(),
        }),
      });
    } catch {}
  }

  private buildDeviceFingerprint(): string {
    const networkInterfaces = os.networkInterfaces();
    const macAddresses = Object.values(networkInterfaces)
      .flatMap((entries) => (entries ?? []).map((entry) => entry.mac || ""))
      .filter((mac) => mac && mac !== "00:00:00:00:00:00")
      .sort()
      .join("|");

    const seed = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.release(),
      macAddresses,
    ].join("|");

    return createHash("sha256").update(seed).digest("hex").slice(0, 32);
  }

  private buildDeviceInfo(): Record<string, unknown> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      app_version: app.getVersion(),
      type: os.type(),
    };
  }

  private decodeJwtClaims(token: string): JwtClaims | null {
    const segments = token.split(".");
    if (segments.length < 2) {
      return null;
    }

    const encodedPayload = segments[1];
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

    try {
      const json = Buffer.from(padded, "base64").toString("utf8");
      return JSON.parse(json) as JwtClaims;
    } catch {
      return null;
    }
  }

  private setState(patch: Partial<DeviceBindingState>): void {
    this.state = {
      ...this.state,
      ...patch,
      updatedAt: Date.now(),
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = this.settings.jingyunBaseUrl.replace(/\/+$/, "");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const tenantSlug = this.settings.jingyunTenantSlug?.trim();
    if (tenantSlug) {
      headers.set("X-Tenant-Slug", tenantSlug);
    }

    const res = await fetch(`${baseUrl}${normalizedPath}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const message = await this.extractErrorMessage(res);
      throw new Error(message);
    }

    const raw = await res.json() as ApiResponseEnvelope<T> | T;

    if (raw && typeof raw === "object" && "code" in raw) {
      const code = (raw as ApiResponseEnvelope<T>).code;
      if (typeof code === "number" && code !== 0 && code !== 200) {
        const message = (raw as ApiResponseEnvelope<T>).msg || (raw as ApiResponseEnvelope<T>).message || `请求失败: ${code}`;
        throw new Error(message);
      }

      const data = (raw as ApiResponseEnvelope<T>).data;
      if (data !== undefined) {
        return data;
      }
    }

    return raw as T;
  }

  private async extractErrorMessage(res: Response): Promise<string> {
    const raw = await res.text();
    if (!raw) {
      return `请求失败: ${res.status}`;
    }

    try {
      const parsed = JSON.parse(raw) as { msg?: string; message?: string; error?: string };
      const message = parsed.msg || parsed.message || parsed.error;
      if (message) {
        return message;
      }
    } catch {}

    return `请求失败: ${res.status} ${raw}`;
  }
}