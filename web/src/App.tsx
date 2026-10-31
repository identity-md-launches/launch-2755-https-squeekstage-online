import { useEffect, useRef, useState } from "react";
import { useSnapshot, API_BASE, getToken, type Snapshot } from "./api";
import { Dashboard } from "./Dashboard";
import { Stage } from "./Stage";
import { Setup } from "./Setup";
import { TipPage } from "./Tip";
import { BrandMark, Icon } from "./graphics";
import { EXPLORER, RPC_URLS } from "./chain";
import { WalletControl } from "./Wallet";
import { loadSettings, persistSettings, type Settings } from "./settings";
import { NoticeContext, PageHeading, Panel, useClock, type Notice } from "./ui";

const routeTitles: Record<string, string> = {
  "/": "Small paws. Real blocks.",
  "/stage": "Stage",
  "/tip": "Send a tip",
  "/setup": "Streamer setup",
  "/about": "About & data",
};
function getRoute() {
  return location.hash.startsWith("#/")
    ? location.hash.slice(1).split("?")[0].replace(/\/$/, "") || "/"
    : "/";
}
export function App() {
  const [route, setRoute] = useState(getRoute);
  const [settings, setSettings] = useState(loadSettings);
  const [notice, setNotice] = useState<Notice | null>(null);
  const main = useRef<HTMLElement>(null);
  const now = useClock();
  const snapshot = useSnapshot();
  const overlay =
    route === "/stage" && new URLSearchParams(location.search).has("obs");
  useEffect(() => {
    const onRoute = () => {
      const next = getRoute();
      setRoute(next);
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
    };
    addEventListener("hashchange", onRoute);
    return () => removeEventListener("hashchange", onRoute);
  }, []);
  useEffect(() => {
    document.title = `SqueekStage · ${routeTitles[route] ?? "Page not found"}`;
    document.documentElement.classList.toggle("obs", overlay);
  }, [route, overlay]);
  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const save = (next: Settings) => {
    setSettings(next);
    return persistSettings(next);
  };
  const refresh = () => {
    void snapshot.refetch();
  };
  return (
    <NoticeContext.Provider value={setNotice}>
      {!overlay && (
        <>
          <a
            className="skip-link"
            href="#main-content"
            onClick={(event) => {
              event.preventDefault();
              main.current?.focus();
              main.current?.scrollIntoView();
            }}
          >
            Skip to content
          </a>
          <header className="site-header">
            <div className="header-inner">
              <a className="brand" href="#/" aria-label="SqueekStage home">
                <BrandMark />
                <span>
                  Squeek<span>Stage</span>
                </span>
              </a>
              <nav className="primary-nav" aria-label="Primary">
                {[
                  ["/", "Overview"],
                  ["/stage", "Stage"],
                  ["/tip", "Tip"],
                  ["/setup", "Setup"],
                ].map(([path, label]) => (
                  <a
                    key={path}
                    href={`#${path}`}
                    aria-current={route === path ? "page" : undefined}
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <div className="header-utilities">
                <span className="network-label">
                  <span className="eth-diamond" />
                  Sepolia
                </span>
                <WalletControl />
              </div>
            </div>
          </header>
        </>
      )}
      <main
        id="main-content"
        ref={main}
        tabIndex={-1}
        className={overlay ? "overlay-main" : "site-main"}
      >
        {route === "/" ? (
          <Dashboard snap={snapshot.data} now={now} refresh={refresh} />
        ) : route === "/stage" ? (
          <Stage
            snap={snapshot.data}
            now={now}
            settings={settings}
            overlay={overlay}
          />
        ) : route === "/setup" ? (
          <Setup settings={settings} save={save} />
        ) : route === "/tip" ? (
          <TipPage snap={snapshot.data} settings={settings} refresh={refresh} />
        ) : route === "/about" ? (
          <About snap={snapshot.data} />
        ) : (
          <>
            <PageHeading
              title="A little off stage."
              description="This page does not exist. Your wheel is still waiting."
            />
            <a className="button button-primary" href="#/">
              Back to overview
              <Icon name="arrow" />
            </a>
          </>
        )}
      </main>
      {!overlay && (
        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <a href="#/" className="brand">
                <BrandMark size={20} />
                <span>SqueekStage</span>
              </a>
              <span className="muted">One hamster. Every block.</span>
            </div>
            <div className="footer-links">
              <span className="muted">Built for Squeekchain</span>
              <a href="#/about">About & data</a>
              <a href={EXPLORER} target="_blank" rel="noreferrer">
                Sepolia explorer
                <Icon name="external" size={14} />
              </a>
            </div>
          </div>
        </footer>
      )}
      <div className="notice-region" role="status" aria-live="polite">
        {notice && (
          <div className={`toast ${notice.error ? "toast-error" : ""}`}>
            <Icon name={notice.error ? "info" : "check"} />
            <span>{notice.text}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>
    </NoticeContext.Provider>
  );
}
function About({ snap }: { snap?: Snapshot }) {
  const token = getToken(snap);
  return (
    <>
      <PageHeading
        title="One hamster. Every block."
        description="A broadcast companion for the Squeekchain wheel and the people watching it."
      />
      <div className="two-column about-layout">
        <Panel title="A stage for the wheel" icon="wheel">
          <div className="panel-content prose">
            <p>
              Squeekchain is a hamster-powered proof-of-work toychain. A real
              wheel produces work, work settles into blocks, and blocks pay SQK.
            </p>
            <p>
              SqueekStage brings that loop to your stream with live readings, a
              transparent OBS overlay, and direct viewer tips.
            </p>
            <h3>Tips stay between you</h3>
            <p>
              A tip is a plain ERC-20 transfer from a viewer’s wallet to the
              streamer’s wallet on Sepolia. There are no approvals, proxy
              contracts, or custodial accounts.
            </p>
            <p>
              SQK is a test token. You need a little Sepolia ETH for gas. Wallet
              addresses and transfers are public.
            </p>
            <a
              className="text-link"
              href="https://squeekchain.com"
              target="_blank"
              rel="noreferrer"
            >
              Explore Squeekchain
              <Icon name="external" size={14} />
            </a>
          </div>
        </Panel>
        <Panel title="Public data, open to check" icon="activity">
          <div className="panel-content">
            <p className="muted">
              Readings refresh every 7 seconds. If a source fails, the last
              available values stay visible and are marked stale.
            </p>
            <dl className="data-sources">
              {[
                ["/v1/core", "Blocks and rounds"],
                ["/v1/economy/state", "SQK token and staking"],
                [
                  "/v1/measurement/stats?range=7d",
                  "Distance and accepted work",
                ],
                ["/v1/events?category=all&limit=10", "Settlements and rewards"],
                ["/v1/status", "Wheel freshness"],
              ].map(([path, label]) => (
                <div key={path}>
                  <dt>{label}</dt>
                  <dd>
                    <a
                      className="text-link mono"
                      href={`${API_BASE}${path}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {path}
                      <Icon name="external" size={12} />
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
            <h3>Sepolia · 11155111</h3>
            {token ? (
              <>
                <p className="field-help">
                  SQK token reported by the Squeekchain API:
                </p>
                <a
                  className="address-text mono text-link"
                  href={`${EXPLORER}/token/${token.address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {token.address}
                </a>
              </>
            ) : (
              <p className="field-help">
                Token details appear when the Squeekchain API is available.
              </p>
            )}
            <details className="read-details">
              <summary>Tip feed limits and RPC sources</summary>
              <p className="field-help">
                The feed scans the last 6,000 Sepolia blocks, keeps up to 100
                incoming SQK transfers, and refreshes every 12 seconds on Stage
                or 15 seconds on Tip. Rankings cover that window only. New
                alerts begin after the initial scan.
              </p>
              {RPC_URLS.map((url) => (
                <a
                  className="text-link rpc-link"
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {url}
                </a>
              ))}
              <p className="field-help">
                Demo tips are simulated and labeled. Browser audio may require a
                click; enable source audio in OBS.
              </p>
            </details>
          </div>
        </Panel>
      </div>
    </>
  );
}
