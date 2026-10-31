import { useRef, useState, type FormEvent } from "react";
import { useAccount } from "wagmi";
import { Icon } from "./graphics";
import { CopyButton, PageHeading, Panel, useNotice } from "./ui";
import {
  DEFAULT_SETTINGS,
  exactAmount,
  shareUrl,
  validRecipient,
  type Settings,
} from "./settings";

export function Setup({
  settings,
  save,
}: {
  settings: Settings;
  save: (value: Settings) => boolean;
}) {
  const [draft, setDraft] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { address } = useAccount();
  const [saved, setSaved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const notify = useNotice();
  const patch = (value: Partial<Settings>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, ...value }));
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (draft.streamer.trim() && !validRecipient(draft.streamer.trim()))
      nextErrors.streamer =
        "Enter a valid recipient wallet address, or leave it empty to preview.";
    try {
      exactAmount(draft.minTip, 18);
    } catch {
      nextErrors.minTip =
        "Enter a nonnegative SQK amount with up to 18 decimal places.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      form.current
        ?.querySelector<HTMLInputElement>(`#${Object.keys(nextErrors)[0]}`)
        ?.focus();
      return;
    }
    const next = { ...draft, streamer: draft.streamer.trim() };
    const persisted = save(next);
    setDraft(next);
    setSaved(true);
    notify({
      text: persisted
        ? "Settings saved in this browser. Your links are ready."
        : "Settings applied for this visit. Browser storage is unavailable; keep your overlay link.",
      error: !persisted,
    });
  }
  const overlayLink = shareUrl(settings, "overlay");
  const tipLink = shareUrl(settings, "tip");
  return (
    <>
      <PageHeading
        title="Make the stage yours."
        description="Set your recipient, customize the overlay, and bring it into OBS."
      />
      <div className="two-column setup-layout">
        <Panel title="Streamer setup" icon="settings">
          <form
            ref={form}
            className="panel-content"
            onSubmit={submit}
            noValidate
          >
            <div className="field">
              <label htmlFor="streamer">Streamer wallet</label>
              <input
                id="streamer"
                name="streamer"
                className="mono"
                type="text"
                value={draft.streamer}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="0x…"
                onChange={(event) => patch({ streamer: event.target.value })}
                aria-invalid={!!errors.streamer}
                aria-describedby={
                  errors.streamer ? "streamer-error" : "streamer-help"
                }
              />
              <p id="streamer-help" className="field-help">
                The wallet that receives tips. Leave empty to preview without
                tips.
              </p>
              {errors.streamer && (
                <p id="streamer-error" className="field-error" role="alert">
                  {errors.streamer}
                </p>
              )}
              {address && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => patch({ streamer: address })}
                >
                  Use my connected wallet
                </button>
              )}
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="accent">Overlay accent</label>
                <div className="color-input">
                  <input
                    id="accent"
                    type="color"
                    value={draft.accent}
                    onChange={(event) => patch({ accent: event.target.value })}
                  />
                  <span className="mono">{draft.accent}</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="minTip">Alert threshold (SQK)</label>
                <input
                  id="minTip"
                  name="minTip"
                  inputMode="decimal"
                  type="text"
                  value={draft.minTip}
                  onChange={(event) => patch({ minTip: event.target.value })}
                  aria-invalid={!!errors.minTip}
                  aria-describedby={
                    errors.minTip ? "threshold-error" : "threshold-help"
                  }
                />
              </div>
            </div>
            <p id="threshold-help" className="field-help">
              Tips below this amount stay in the feed without an alert.
            </p>
            {errors.minTip && (
              <p id="threshold-error" className="field-error" role="alert">
                {errors.minTip}
              </p>
            )}
            <div className="setting-toggles">
              <label className="toggle-row">
                <span>
                  <strong>Alert sound</strong>
                  <span className="field-help">
                    Play a short sound for new tip alerts.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.sound}
                  onChange={(event) => patch({ sound: event.target.checked })}
                />
              </label>
              <label className="toggle-row">
                <span>
                  <strong>Demo tip feed</strong>
                  <span className="field-help">
                    Simulated tips for previewing your overlay.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.demo}
                  onChange={(event) => patch({ demo: event.target.checked })}
                />
              </label>
            </div>
            <button className="button button-primary full-width" type="submit">
              <Icon name={saved ? "check" : "settings"} />
              {saved ? "Settings saved" : "Save settings"}
            </button>
            <button
              className="text-button reset-settings"
              type="button"
              onClick={() => {
                setDraft(DEFAULT_SETTINGS);
                setErrors({});
                setSaved(false);
                notify({
                  text: "Defaults restored in the form. Save settings to apply them.",
                });
              }}
            >
              Restore defaults
            </button>
            <p className="field-help">
              Saved in this browser. Shared links carry the settings to OBS or
              another device.
            </p>
          </form>
        </Panel>
        <div className="panel-stack">
          <Panel title="Your OBS overlay" icon="monitor">
            <div className="panel-content">
              <p className="muted">
                Save your settings, then add this link as a Browser source.
              </p>
              <label htmlFor="overlay-link" className="field-label">
                Overlay URL
              </label>
              <textarea
                id="overlay-link"
                className="link-output mono"
                readOnly
                rows={3}
                value={overlayLink}
                spellCheck={false}
              />
              <div className="link-actions">
                <CopyButton value={overlayLink} label="Copy for OBS" />
                <a
                  className="text-button"
                  href={overlayLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open overlay
                  <Icon name="external" size={14} />
                </a>
              </div>
              <ol className="steps">
                <li>
                  <span>1</span>
                  <p>
                    In OBS, choose <strong>Sources → + → Browser</strong>.
                  </p>
                </li>
                <li>
                  <span>2</span>
                  <p>
                    Paste the link. Set the size to <strong>1920 × 1080</strong>
                    .
                  </p>
                </li>
                <li>
                  <span>3</span>
                  <p>
                    Keep the default custom CSS. Enable{" "}
                    <strong>Shutdown source when not visible</strong>.
                  </p>
                </li>
              </ol>
              <p className="field-help">
                OBS may mute browser audio until you enable it in the source.
                Use Test alert on the Stage page to preview.
              </p>
            </div>
          </Panel>
          <Panel title="A tip link for your chat" icon="heart">
            <div className="panel-content">
              <label htmlFor="tip-link" className="field-label">
                Tip page URL
              </label>
              <textarea
                id="tip-link"
                className="link-output mono"
                readOnly
                rows={3}
                value={tipLink}
                spellCheck={false}
              />
              <CopyButton value={tipLink} label="Copy for chat" />
              {!settings.streamer && (
                <p className="field-help">
                  Save a streamer wallet to include the recipient in this link.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
