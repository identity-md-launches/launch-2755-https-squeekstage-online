import { isAddress, parseUnits, zeroAddress } from "viem";

export interface Settings {
  streamer: string;
  accent: string;
  minTip: string;
  sound: boolean;
  demo: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  streamer: "",
  accent: "#f2c230",
  minTip: "1",
  sound: true,
  demo: false,
};
const KEY = "squeekstage:v1";
export const validRecipient = (value: string) =>
  isAddress(value, { strict: false }) && value.toLowerCase() !== zeroAddress;
export function exactAmount(input: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(input))
    throw new Error("Enter a positive amount, such as 5 or 1.5.");
  if ((input.split(".")[1]?.length ?? 0) > decimals)
    throw new Error(`SQK supports up to ${decimals} decimal places.`);
  const result = parseUnits(input, decimals);
  if (result >= 2n ** 256n)
    throw new Error("This amount is too large. Enter a smaller amount.");
  return result;
}
export function loadSettings(): Settings {
  let stored: Partial<Settings> = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    /* defaults when storage is unavailable */
  }
  const p = new URLSearchParams(location.search);
  const candidate = { ...DEFAULT_SETTINGS, ...stored };
  for (const key of ["streamer", "accent", "minTip"] as const)
    if (p.has(key)) candidate[key] = p.get(key)!;
  for (const key of ["sound", "demo"] as const)
    if (p.has(key)) candidate[key] = ["1", "true", "yes"].includes(p.get(key)!);
  return {
    streamer:
      typeof candidate.streamer === "string" &&
      validRecipient(candidate.streamer)
        ? candidate.streamer
        : "",
    accent:
      typeof candidate.accent === "string" &&
      /^#[0-9a-f]{6}$/i.test(candidate.accent)
        ? candidate.accent
        : DEFAULT_SETTINGS.accent,
    minTip:
      typeof candidate.minTip === "string" &&
      /^\d+(\.\d+)?$/.test(candidate.minTip)
        ? candidate.minTip
        : "1",
    sound: candidate.sound === true,
    demo: candidate.demo === true,
  };
}
export function persistSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
export function shareUrl(settings: Settings, kind: "overlay" | "tip"): string {
  const url = new URL(location.href);
  url.search = "";
  url.hash = kind === "overlay" ? "#/stage" : "#/tip";
  if (kind === "overlay") url.searchParams.set("obs", "1");
  if (settings.streamer) url.searchParams.set("streamer", settings.streamer);
  url.searchParams.set("accent", settings.accent);
  if (kind === "overlay") {
    url.searchParams.set("minTip", settings.minTip);
    url.searchParams.set("sound", settings.sound ? "1" : "0");
    if (settings.demo) url.searchParams.set("demo", "1");
  }
  return url.toString();
}
export const formatInt = (value: string | number | undefined | null) =>
  value == null || !Number.isFinite(Number(value))
    ? "–"
    : new Intl.NumberFormat("en-US").format(Number(value));
export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;
export function units(
  value: bigint | string | undefined,
  decimals = 18,
  places = 2,
): string {
  if (value == null) return "–";
  try {
    const number = BigInt(value);
    const base = 10n ** BigInt(decimals);
    const whole = new Intl.NumberFormat("en-US").format(number / base);
    const fraction = (number % base)
      .toString()
      .padStart(decimals, "0")
      .slice(0, places)
      .replace(/0+$/, "");
    return `${whole}${fraction ? `.${fraction}` : ""}`;
  } catch {
    return "–";
  }
}
export function ago(date?: string) {
  if (!date || !Number.isFinite(Date.parse(date))) return "Time unavailable";
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(date)) / 1000),
  );
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h ago`
        : `${Math.floor(seconds / 86400)}d ago`;
}
export function distance(mm?: string) {
  if (mm == null || !Number.isFinite(Number(mm)))
    return { value: "–", unit: "km" };
  return Number(mm) >= 1000000
    ? { value: (Number(mm) / 1000000).toFixed(2), unit: "km" }
    : { value: (Number(mm) / 1000).toFixed(1), unit: "m" };
}
