import { useQuery } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";

export const API_BASE = "https://api.squeekchain.com";
export interface ChainInfo {
  chainId?: string;
  safeBlockTimestamp?: string;
}
export interface CoreData {
  chain?: ChainInfo;
  configuration?: {
    genesisTimestamp?: string;
    roundDuration?: string;
    blockUnitsPerBlock?: string;
  };
  core?: {
    blockHeight?: string;
    blockProgress?: string;
    settledThroughRound?: string;
    cumulativeWork?: string;
    paused?: boolean;
  };
}
export interface EconomyData {
  chain?: ChainInfo;
  asset?: { address?: string; symbol?: string; decimals?: number };
  staking?: { totalStakedBaseUnits?: string };
  supply?: { liveSupplyBaseUnits?: string };
}
export interface StatsData {
  lifetime?: {
    observedDistanceMm?: string;
    acceptedWorkUnits?: string;
    settlementCount?: string;
    activeDayCount?: number;
  };
}
export interface StatusData {
  measurement?: {
    freshness?: string;
    observedAt?: string;
    staleAfterSeconds?: number;
  };
}
export interface StageEvent {
  id: string;
  type: string;
  occurredAt?: string;
  source?: { transactionHash?: string; blockNumber?: string };
  payload?: {
    blockHeight?: string;
    workAdded?: string;
    settledThroughRound?: string;
    throughRound?: string;
    amountBaseUnits?: string;
    asset?: { decimals?: number; symbol?: string };
  };
}
export interface EventsData {
  events?: StageEvent[];
}
export interface Snapshot {
  core: CoreData | null;
  economy: EconomyData | null;
  stats: StatsData | null;
  status: StatusData | null;
  events: EventsData | null;
  failed: string[];
  updatedAt: number;
}
let previous: Snapshot | null = null;

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Squeekchain returned ${response.status}`);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Unexpected API response");
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}
export async function loadSnapshot(): Promise<Snapshot> {
  const [core, economy, stats, status, events] = await Promise.allSettled([
    get<CoreData>("/v1/core"),
    get<EconomyData>("/v1/economy/state"),
    get<StatsData>("/v1/measurement/stats?range=7d"),
    get<StatusData>("/v1/status"),
    get<EventsData>("/v1/events?category=all&limit=10"),
  ]);
  const pick = <T>(
    result: PromiseSettledResult<T>,
    fallback: T | null | undefined,
  ): T | null =>
    result.status === "fulfilled" ? result.value : (fallback ?? null);
  previous = {
    core: pick(core, previous?.core),
    economy: pick(economy, previous?.economy),
    stats: pick(stats, previous?.stats),
    status: pick(status, previous?.status),
    events: pick(events, previous?.events),
    updatedAt: Date.now(),
    failed: [
      ["core", core],
      ["economy", economy],
      ["stats", stats],
      ["status", status],
      ["events", events],
    ]
      .filter(
        ([, result]) =>
          (result as PromiseSettledResult<unknown>).status === "rejected",
      )
      .map(([key]) => String(key)),
  };
  return previous;
}
export function useSnapshot() {
  return useQuery({
    queryKey: ["snapshot"],
    queryFn: loadSnapshot,
    refetchInterval: 7000,
    staleTime: 5000,
    retry: 1,
  });
}
export function getToken(
  snap: Snapshot | undefined,
): { address: Address; symbol: "SQK"; decimals: number } | null {
  const asset = snap?.economy?.asset;
  if (
    snap?.economy?.chain?.chainId !== "11155111" ||
    !asset?.address ||
    !isAddress(asset.address) ||
    asset.symbol !== "SQK" ||
    !Number.isInteger(asset.decimals) ||
    asset.decimals! < 0 ||
    asset.decimals! > 36
  )
    return null;
  return { address: asset.address, symbol: "SQK", decimals: asset.decimals! };
}
export function liveState(
  snap: Snapshot | undefined,
  now: number,
): "Loading" | "Live" | "Stale" | "Offline" {
  if (!snap) return "Loading";
  if (!snap.core && !snap.status) return "Offline";
  const measurement = snap.status?.measurement;
  const age = (now - Date.parse(measurement?.observedAt ?? "")) / 1000;
  if (
    snap.failed.length ||
    !Number.isFinite(age) ||
    age > (measurement?.staleAfterSeconds ?? 120) ||
    measurement?.freshness === "stale"
  )
    return "Stale";
  return ["online", "fresh", "live"].includes(measurement?.freshness ?? "")
    ? "Live"
    : "Offline";
}
export const EVENT_NAMES: Record<string, string> = {
  "system.settlement_completed": "Round settled",
  "system.mining_checkpointed": "Mining checkpoint",
  "account.rewards_claimed": "Rewards claimed",
  "account.rewards_staked": "Rewards staked",
  "account.sqk_staked": "SQK staked",
  "account.sqk_unstaked": "SQK unstaked",
  "nft.deposited": "NFT deposited",
  "nft.withdrawn": "NFT withdrawn",
  "nft.merged": "NFT merged",
  "measurement.distance_milestone": "Distance milestone",
  "measurement.speed_record": "Speed record",
};
