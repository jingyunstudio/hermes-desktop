export type HermesDeployStatus = "deploying" | "health_check" | "register" | "ready" | "failed";

export interface HermesInstanceItem {
  instance_id: string;
  user_id: string;
  mode: "desktop" | "byos";
  status: "online" | "offline" | "disabled";
  deploy_status?: HermesDeployStatus;
  deploy_error?: string;
  endpoint?: string;
  last_seen_at: number;
  last_health_checked_at?: number;
  version?: string;
  created_at: number;
}

export interface HermesDeployStatusResp {
  instance_id: string;
  deploy_status: HermesDeployStatus;
  deploy_error?: string;
  status: "online" | "offline" | "disabled";
  last_health_checked_at?: number;
}

export class JingyunHermesClient {
  constructor(private readonly baseUrl: string, private readonly token?: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Content-Type", "application/json");
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  listInstances() {
    return this.request<{ list: HermesInstanceItem[]; total: number }>("/v1/plugins/hermes_agent/instances");
  }

  deployStatus(instanceId: string) {
    return this.request<HermesDeployStatusResp>(
      `/v1/plugins/hermes_agent/instances/${instanceId}/deploy-status`,
    );
  }
}
