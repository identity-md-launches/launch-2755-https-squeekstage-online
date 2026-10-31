import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getToken, type Snapshot } from "./api";
import { incomingTips, type Tip } from "./chain";
import { WheelPanel, Stats } from "./Dashboard";
import { accentStyle, BrandMark, Icon } from "./graphics";
import {
  exactAmount,
  shareUrl,
  shortAddress,
  units,
  validRecipient,
  type Settings,
} from "./settings";
import { CopyButton, PageHeading, useNotice } from "./ui";

interface TipAlert {
  id: string;
  label: string;
  amount: string;
  demo: boolean;
}
export function Stage({
  snap,
  now,
  settings,
  overlay,
}: {
  snap?: Snapshot;
  now: number;
  settings: Settings;
  overlay: boolean;
}) {
  const [alerts, setAlerts] = useState<TipAlert[]>([]);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(settings.sound);
  const audio = useRef<AudioContext | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const baseline = useRef<{ key: string; seen: Set<string>; ready: boolean }>({
    key: "",
    seen: new Set(),
    ready: false,
  });
  const stage = useRef<HTMLDivElement>(null);
  const notify = useNotice();
  const token = getToken(snap);
  const feed = useQuery({
    queryKey: ["tips", token?.address, settings.streamer],
    queryFn: () => incomingTips(token!.address, settings.streamer as Address),
    enabled: !!token && validRecipient(settings.streamer) && !settings.demo,
    refetchInterval: 12000,
    retry: 1,
  });
  const alert = useCallback(
    (tip: TipAlert) => {
      setAlerts((current) => [...current.slice(-2), tip]);
      timers.current.push(
        setTimeout(
          () =>
            setAlerts((current) =>
              current.filter((item) => item.id !== tip.id),
            ),
          6500,
        ),
      );
      if (sound) {
        try {
          audio.current ??= new AudioContext();
          const ctx = audio.current;
          void ctx.resume().catch(() => {});
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 720;
          gain.gain.setValueAtTime(0.07, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          oscillator.connect(gain).connect(ctx.destination);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.25);
        } catch {
          /* Browser audio permissions may require a gesture. The visual alert still works. */
        }
      }
    },
    [sound],
  );
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      void audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    const key = `${token?.address}:${settings.streamer}`.toLowerCase();
    if (baseline.current.key !== key)
      baseline.current = { key, seen: new Set(), ready: false };
    if (!feed.data || !token) return;
    const state = baseline.current;
    let minimum = 0n;
    try {
      minimum = exactAmount(settings.minTip, token.decimals);
    } catch {
      return;
    }
    for (const tip of [...feed.data].reverse()) {
      const id = `${tip.tx}:${tip.index}`;
      if (state.seen.has(id)) continue;
      state.seen.add(id);
      if (state.ready && tip.amount >= minimum)
        alert({
          id,
          label: shortAddress(tip.from),
          amount: units(tip.amount, token.decimals, 4),
          demo: false,
        });
    }
    state.ready = true;
    while (state.seen.size > 500)
      state.seen.delete(state.seen.values().next().value!);
  }, [
    feed.data,
    token?.address,
    token?.decimals,
    settings.streamer,
    settings.minTip,
    alert,
  ]);
  useEffect(() => {
    if (!settings.demo || paused) return;
    let id = 0;
    const interval = setInterval(() => {
      id++;
      alert({
        id: `demo-${Date.now()}`,
        label: "Demo tip",
        amount: ["5", "10", "25"][id % 3],
        demo: true,
      });
    }, 6500);
    return () => clearInterval(interval);
  }, [settings.demo, paused, alert]);
  const canvas = (
    <div
      ref={stage}
      className={`stage-canvas ${overlay ? "broadcast" : ""}`}
      style={accentStyle(settings.accent)}
    >
      {!overlay && (
        <div className="stage-scene-label">
          <BrandMark size={22} />
          <span>SqueekStage</span>
          <span className="data-label">OBS preview · 1920 × 1080</span>
        </div>
      )}
      <div className="stage-widget">
        <WheelPanel snap={snap} now={now} overlay />
        {overlay && <Stats snap={snap} />}
      </div>
      {!overlay && (
        <div className="camera-space">
          <Icon name="monitor" size={32} />
          <span>Your camera goes here</span>
          <span className="data-label">Transparent background in OBS</span>
        </div>
      )}
      {settings.demo && (
        <div className="demo-tag">
          Demo tips {paused ? "paused" : "enabled"}
        </div>
      )}
      <div className="tip-alert-stack" role="status" aria-label="Tip alerts">
        {alerts.map((item) => (
          <div className="tip-alert" key={item.id}>
            <span className="alert-heart">
              <Icon name="heart" size={24} />
            </span>
            <div>
              <strong>+{item.amount} SQK</strong>
              <span>
                {item.label}
                {item.demo ? " · Preview only" : " sent a tip"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  if (overlay) return <div className="obs-output">{canvas}</div>;
  return (
    <>
      <PageHeading
        title="Give your wheel a stage."
        description="Preview your overlay, test an alert, then add it to OBS."
      >
        <CopyButton
          value={shareUrl({ ...settings, sound }, "overlay")}
          label="Copy OBS URL"
        />
      </PageHeading>
      <div className="stage-toolbar">
        <button
          className="button button-primary"
          onClick={() =>
            alert({
              id: `test-${Date.now()}`,
              label: "Test tip",
              amount: "12.34",
              demo: true,
            })
          }
        >
          <Icon name="heart" />
          Test alert
        </button>
        <button
          className="button button-outline"
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
        >
          <Icon name={sound ? "volume" : "muted"} />
          {sound ? "Sound on" : "Sound off"}
        </button>
        {settings.demo && (
          <button
            className="button button-outline"
            onClick={() => setPaused(!paused)}
          >
            {paused ? "Resume demo" : "Pause demo"}
          </button>
        )}
        <button
          className="icon-button fullscreen-button"
          aria-label="Open stage fullscreen"
          onClick={async () => {
            try {
              if (!stage.current?.requestFullscreen)
                throw new Error("Unavailable");
              await stage.current.requestFullscreen();
            } catch {
              notify({
                text: "Fullscreen is unavailable in this browser. Open the overlay link for a larger preview.",
                error: true,
              });
            }
          }}
        >
          <Icon name="expand" />
        </button>
        <a className="text-button" href="#/setup">
          Overlay settings
          <Icon name="settings" />
        </a>
      </div>
      {canvas}
      <div className="stage-bottom">
        <p className="muted">
          {settings.demo
            ? "Demo tips are simulated. Wheel readings still come from Squeekchain."
            : settings.streamer
              ? "New SQK transfers to your streamer wallet trigger alerts. The first scan loads recent history quietly."
              : "Add your streamer wallet in Setup to receive on-chain tip alerts."}
        </p>
        <a className="text-button" href="#/tip">
          Open tip page
          <Icon name="arrow" size={16} />
        </a>
      </div>
      {feed.isError && (
        <div className="inline-notice" role="status">
          The tip feed could not refresh.{" "}
          <button className="text-button" onClick={() => void feed.refetch()}>
            Retry tips
          </button>
        </div>
      )}
      <label className="field-label" htmlFor="stage-overlay-link">
        Overlay URL
      </label>
      <textarea
        id="stage-overlay-link"
        className="link-output mono"
        readOnly
        rows={2}
        value={shareUrl({ ...settings, sound }, "overlay")}
        spellCheck={false}
      />
      <Stats snap={snap} />
    </>
  );
}
