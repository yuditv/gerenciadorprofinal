export type VPNTestMode = "api" | "offline";

export interface VPNTestFormValues {
  username: string;
  password: string;
  connectionLimit: number;
  minutes: number;
  v2rayEnabled: boolean;
  v2rayUuid: string;
  ownerId?: number;
}

export interface VPNTestResult {
  mode: VPNTestMode;
  values: VPNTestFormValues;
  raw?: unknown;
}
