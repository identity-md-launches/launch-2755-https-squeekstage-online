import { useState } from "react";
import {
  getToken,
  liveState,
  EVENT_NAMES,
  type Snapshot,
  type StageEvent,
} from "./api";
import { Icon, Wheel, Hamster } from "./graphics";
import { PageHeading, Panel, EmptyState } from "./ui";
import { EXPLORER } from "./chain";
import { ago, distance, formatInt, units } from "./settings";

export function blockProgress(snap?: Snapshot): number | null {
  const denominator = Number(snap?.core?.configuration?.blockUnitsPerBlock);
  const numerator = snap?.core?.core?.blockProgress;
  return denominator > 0 &&
    numerator != null &&
    Number.isFinite(Number(numerator))
    ? Math.min(100, Math.max(0, (Number(numerator) / denominator) * 100))
    : null;
}
export function Status({ snap, now }: { snap?: Snapshot; now: number }) {
  const status = liveState(snap, now);
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      <span className="status-dot" />
      {status}
    </span>
  );
}
export function WheelPanel({
  snap,
  now,
  overlay = false,
}: {
  snap?: Snapshot;
  now: number;
  overlay?: boolean;
}) {
  const core = snap?.core?.core;
  const config = snap?.core?.configuration;
  const genesis = Number(config?.genesisTimestamp);
  const duration = Number(config?.roundDuration);
  const elapsed =
    genesis > 0 && duration > 0 ? Math.max(0, now / 1000 - genesis) : null;
  const currentRound =
    elapsed == null ? null : Math.floor(elapsed / duration) + 1;
  const remaining =
    elapsed == null ? null : duration - Math.floor(elapsed % duration);
  const roundProgress =
    elapsed == null ? null : ((elapsed % duration) / duration) * 100;
  const progress = blockProgress(snap);
  return (
    <Panel
      title="The wheel, right now"
      icon="wheel"
      className={overlay ? "broadcast-wheel" : "wheel-panel"}
      aside={<Status snap={snap} now={now} />}
    >
      <div className="wheel-body">
        <div className="block-readout">
          <span className="data-label">Squeekchain block</span>
          <strong className="block-number">
            {formatInt(core?.blockHeight)}
          </strong>
          <span className="powered">
            <span />
            Powered by little paws
          </span>
          <dl className="round-data">
            <div>
              <dt>Current round</dt>
              <dd>{formatInt(currentRound)}</dd>
            </div>
            <div>
              <dt>Settled through</dt>
              <dd>{formatInt(core?.settledThroughRound)}</dd>
            </div>
          </dl>
        </div>
        <Wheel progress={progress} />
      </div>
      <div className="progress-grid">
        <div className="progress-item">
          <div className="progress-label">
            <span>Block progress</span>
            <span>{progress == null ? "–" : `${progress.toFixed(2)}%`}</span>
          </div>
          <progress
            max="100"
            value={progress ?? undefined}
            aria-label="Block progress"
          />
        </div>
        <div className="progress-item">
          <div className="progress-label">
            <span>Round progress</span>
            <span>
              {remaining == null
                ? "–"
                : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} left`}
            </span>
          </div>
          <progress
            className="round-progress"
            max="100"
            value={roundProgress ?? undefined}
            aria-label="Round progress"
          />
        </div>
      </div>
      {!overlay && (
        <div className="panel-foot">
          <span>
            <span className="tiny-dot" />
            Public data · Refreshes every 7s
          </span>
          <span className="mono">11155111 / Sepolia</span>
        </div>
      )}
    </Panel>
  );
}
function eventDetails(event: StageEvent) {
  const p = event.payload;
  if (p?.settledThroughRound != null)
    return `Through round ${formatInt(p.settledThroughRound)}`;
  if (p?.throughRound != null)
    return `Through round ${formatInt(p.throughRound)}`;
  if (p?.amountBaseUnits)
    return `${units(p.amountBaseUnits, p.asset?.decimals ?? 18)} ${p.asset?.symbol ?? "SQK"}`;
  if (p?.blockHeight) return `Block ${formatInt(p.blockHeight)}`;
  return event.source?.blockNumber
    ? `Sepolia block ${formatInt(event.source.blockNumber)}`
    : "Squeekchain activity";
}
export function Activity({
  snap,
  refresh,
}: {
  snap?: Snapshot;
  refresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const events = Array.isArray(snap?.events?.events)
    ? snap.events.events.slice(0, 10)
    : [];
  return (
    <Panel
      title="On-chain activity"
      icon="activity"
      className="activity-panel"
      aside={<span className="data-label">Latest {events.length || "–"}</span>}
    >
      {snap?.failed.includes("events") && (
        <p className="inline-notice">
          Activity could not refresh.{" "}
          <button className="text-button" onClick={refresh}>
            Retry
          </button>
        </p>
      )}
      {!events.length ? (
        <EmptyState
          title={
            !snap
              ? "Reading activity…"
              : snap.failed.includes("events")
                ? "Activity unavailable"
                : "No recent events"
          }
        >
          {!snap
            ? "Fetching public Squeekchain events."
            : "New settlements and rewards will appear here."}
        </EmptyState>
      ) : (
        <ul className="activity-list">
          {events.slice(0, expanded ? 10 : 5).map((event, index) => {
            const kind =
              event.type === "system.settlement_completed"
                ? "settlement"
                : event.type === "system.mining_checkpointed"
                  ? "checkpoint"
                  : "reward";
            const hash = event.source?.transactionHash;
            const content = (
              <>
                <span className={`event-icon ${kind}`}>
                  <Icon
                    name={
                      kind === "settlement"
                        ? "cube"
                        : kind === "checkpoint"
                          ? "activity"
                          : "coins"
                    }
                  />
                </span>
                <span className="event-copy">
                  <strong>
                    {EVENT_NAMES[event.type] ??
                      event.type.replace(/[._]/g, " ")}
                  </strong>
                  <span>{eventDetails(event)}</span>
                </span>
                <span className="event-time">
                  <time dateTime={event.occurredAt}>
                    {ago(event.occurredAt)}
                  </time>
                  {hash && <Icon name="external" size={12} />}
                </span>
              </>
            );
            return (
              <li key={event.id ?? index}>
                {hash && /^0x[0-9a-f]{64}$/i.test(hash) ? (
                  <a
                    href={`${EXPLORER}/tx/${hash}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${EVENT_NAMES[event.type] ?? "Squeekchain event"}, view transaction on Sepolia Etherscan`}
                  >
                    {content}
                  </a>
                ) : (
                  <div className="activity-row">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {events.length > 5 && (
        <button
          className="activity-more"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer events" : `Show all ${events.length} events`}
          <Icon name="arrow" size={16} />
        </button>
      )}
    </Panel>
  );
}
export function Stats({ snap }: { snap?: Snapshot }) {
  const life = snap?.stats?.lifetime;
  const dist = distance(life?.observedDistanceMm);
  const token = getToken(snap);
  const items = [
    {
      label: "Wheel distance",
      value: dist.value,
      unit: dist.unit,
      detail: "Lifetime distance",
    },
    {
      label: "Accepted work",
      value: formatInt(life?.acceptedWorkUnits),
      detail: "Verified work units",
    },
    {
      label: "Settlements",
      value: formatInt(life?.settlementCount),
      detail: "On-chain batches",
    },
    {
      label: "Active days",
      value: formatInt(life?.activeDayCount),
      detail: "Days with activity",
    },
    {
      label: "Total staked",
      value: units(
        snap?.economy?.staking?.totalStakedBaseUnits,
        token?.decimals,
      ),
      unit: "SQK",
      detail: "Across Squeekchain",
    },
  ];
  return (
    <dl className="stat-strip">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <span className="stat-value">
              {item.value}
              {item.unit && <small>{item.unit}</small>}
            </span>
            <span className="data-label">{item.detail}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Dashboard({
  snap,
  now,
  refresh,
}: {
  snap?: Snapshot;
  now: number;
  refresh: () => void;
}) {
  return (
    <>
      <PageHeading
        title={
          <>
            Small paws. <span className="headline-accent">Real blocks.</span>
          </>
        }
        description="A live stream companion for the Squeekchain hamster wheel."
      >
        <a className="button button-outline" href="#/stage">
          <Icon name="monitor" />
          Open stage
        </a>
        <a className="button button-primary" href="#/tip">
          <Icon name="heart" />
          Send a tip
          <Icon name="external" size={14} />
        </a>
      </PageHeading>
      {snap && snap.failed.length > 0 && (
        <div className="inline-notice" role="status">
          {snap.core
            ? "Some readings are stale. Last available values are shown."
            : "Squeekchain data is unavailable. You can still set up your overlay."}
          <button className="text-button" onClick={refresh}>
            Retry data
          </button>
        </div>
      )}
      <div className="dashboard-grid">
        <WheelPanel snap={snap} now={now} />
        <Activity snap={snap} refresh={refresh} />
      </div>
      <Stats snap={snap} />
      <section className="setup-banner">
        <div className="banner-art">
          <Hamster />
        </div>
        <div>
          <h2>A little wheel. A bigger stage.</h2>
          <p className="muted">
            Bring the live numbers into OBS. Your camera takes center stage.
          </p>
        </div>
        <a className="button button-outline" href="#/setup">
          Set up your stream
          <Icon name="arrow" />
        </a>
      </section>
    </>
  );
}
