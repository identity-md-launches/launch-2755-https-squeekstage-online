import { useRef, useState, type FormEvent } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getAddress, type Address, type Hash } from "viem";
import { getToken, type Snapshot } from "./api";
import {
  EXPLORER,
  erc20Abi,
  incomingTips,
  publicClient,
  sepolia,
  walletError,
} from "./chain";
import {
  exactAmount,
  formatInt,
  shortAddress,
  units,
  validRecipient,
  type Settings,
} from "./settings";
import { Icon } from "./graphics";
import { EmptyState, PageHeading, Panel } from "./ui";
import { useOpenWallet } from "./Wallet";

type TxState = {
  phase: "idle" | "wallet" | "pending" | "success" | "failed" | "unknown";
  message: string;
  hash?: Hash;
};
export function TipPage({
  snap,
  settings,
  refresh,
}: {
  snap?: Snapshot;
  settings: Settings;
  refresh: () => void;
}) {
  const [recipient, setRecipient] = useState(settings.streamer);
  const [amount, setAmount] = useState("5");
  const [review, setReview] = useState<{
    to: Address;
    token: Address;
    decimals: number;
    amount: bigint;
    display: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tx, setTx] = useState<TxState>({ phase: "idle", message: "" });
  const { address, chainId, isConnected } = useAccount();
  const openWallet = useOpenWallet();
  const { writeContractAsync } = useWriteContract();
  const recipientInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const token = getToken(snap);
  const valid = validRecipient(recipient.trim());
  const wrongChain = isConnected && chainId !== sepolia.id;
  const economyFresh = !!token && !snap?.failed.includes("economy");
  const busy = tx.phase === "wallet" || tx.phase === "pending";
  const balance = useQuery({
    queryKey: ["balance", token?.address, address],
    queryFn: () =>
      publicClient.readContract({
        address: token!.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address!],
      }),
    enabled: !!token && !!address && !wrongChain,
    refetchInterval: 15000,
    retry: 1,
  });
  const feed = useQuery({
    queryKey: ["tips", token?.address, recipient.trim()],
    queryFn: () => incomingTips(token!.address, getAddress(recipient.trim())),
    enabled: !!token && valid,
    refetchInterval: 15000,
    retry: 1,
  });
  const leaders = new Map<string, { total: bigint; count: number }>();
  for (const tip of feed.data ?? []) {
    const from = tip.from.toLowerCase();
    const current = leaders.get(from) ?? { total: 0n, count: 0 };
    leaders.set(from, {
      total: current.total + tip.amount,
      count: current.count + 1,
    });
  }
  const ranked = [...leaders]
    .sort((a, b) =>
      a[1].total === b[1].total
        ? b[1].count - a[1].count
        : a[1].total > b[1].total
          ? -1
          : 1,
    )
    .slice(0, 5);
  function reviewTip(event: FormEvent) {
    event.preventDefault();
    if (busy || tx.phase === "unknown") return;
    const nextErrors: Record<string, string> = {};
    if (!valid)
      nextErrors.recipient =
        "Enter the streamer’s full wallet address. Check it with them before sending.";
    let parsed = 0n;
    try {
      parsed = exactAmount(amount.trim(), token?.decimals ?? 18);
      if (parsed <= 0n) throw new Error("zero");
    } catch (error) {
      nextErrors.amount =
        error instanceof Error && error.message !== "zero"
          ? error.message
          : "Enter an amount greater than zero.";
    }
    if (balance.data != null && parsed > balance.data)
      nextErrors.amount = "This amount is higher than your SQK balance.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      (nextErrors.recipient ? recipientInput : amountInput).current?.focus();
      return;
    }
    if (!isConnected) {
      openWallet();
      return;
    }
    if (wrongChain || !economyFresh) return;
    setTx({ phase: "idle", message: "" });
    setReview({
      to: getAddress(recipient.trim()),
      token: token!.address,
      decimals: token!.decimals,
      amount: parsed,
      display: amount.trim(),
    });
  }
  async function send() {
    if (!review || !token || !address || wrongChain || !economyFresh || busy)
      return;
    if (review.token !== token.address || review.decimals !== token.decimals) {
      setReview(null);
      setTx({
        phase: "failed",
        message: "Token details changed. Review your tip again before sending.",
      });
      return;
    }
    const confirmed = review;
    let hash: Hash | undefined;
    try {
      setTx({
        phase: "wallet",
        message: "Confirm this SQK transfer in your wallet.",
      });
      const available = await publicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      if (available < confirmed.amount) {
        setTx({
          phase: "failed",
          message:
            "Your SQK balance is too low for this tip. Choose a smaller amount.",
        });
        return;
      }
      hash = await writeContractAsync({
        address: token.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [confirmed.to, confirmed.amount],
        chainId: sepolia.id,
      });
      setTx({
        phase: "pending",
        message: "Tip submitted. Waiting for a Sepolia confirmation.",
        hash,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 90000,
        confirmations: 1,
      });
      if (receipt.status === "reverted")
        setTx({
          phase: "failed",
          message:
            "The transfer reverted on Sepolia. No SQK was transferred; gas may have been spent.",
          hash,
        });
      else {
        setTx({
          phase: "success",
          message: `${confirmed.display} SQK confirmed on Sepolia. Thank you for supporting the stream.`,
          hash,
        });
        setReview(null);
        void balance.refetch();
        void feed.refetch();
      }
    } catch (error) {
      setTx({
        phase: hash ? "unknown" : "failed",
        message: hash
          ? "Confirmation is taking longer than expected. Check the transaction before sending again."
          : walletError(error),
        hash,
      });
    }
  }
  async function checkPending() {
    if (!tx.hash || !review || busy) return;
    const hash = tx.hash;
    setTx({
      phase: "pending",
      message: "Checking the Sepolia transaction…",
      hash,
    });
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 30000,
        confirmations: 1,
      });
      if (receipt.status === "reverted") {
        setTx({
          phase: "failed",
          message:
            "The transfer reverted on Sepolia. No SQK was transferred; gas may have been spent.",
          hash,
        });
      } else {
        setTx({
          phase: "success",
          message: `${review.display} SQK confirmed on Sepolia. Thank you for supporting the stream.`,
          hash,
        });
        setReview(null);
        void balance.refetch();
        void feed.refetch();
      }
    } catch {
      setTx({
        phase: "unknown",
        message:
          "Confirmation is still unavailable. Check the explorer before sending again.",
        hash,
      });
    }
  }
  return (
    <>
      <PageHeading
        title="A little tip. A big squeek."
        description="Send SQK directly to your streamer on Sepolia."
      />
      <div className="two-column tip-layout">
        <Panel
          title="Send a tip"
          icon="heart"
          className="tip-form-panel"
          aside={
            <span className="network-label">
              <span className="eth-diamond" />
              Sepolia testnet
            </span>
          }
        >
          <form className="panel-content" onSubmit={reviewTip} noValidate>
            <fieldset disabled={busy || tx.phase === "unknown"}>
              <div className="field">
                <label htmlFor="recipient">Streamer wallet</label>
                <input
                  ref={recipientInput}
                  id="recipient"
                  name="recipient"
                  type="text"
                  className="mono"
                  value={recipient}
                  placeholder="0x…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-invalid={!!errors.recipient}
                  aria-describedby={
                    errors.recipient ? "recipient-error" : "recipient-help"
                  }
                  onChange={(event) => {
                    setRecipient(event.target.value);
                    setReview(null);
                  }}
                />
                <p id="recipient-help" className="field-help">
                  Check the complete recipient address before sending.
                </p>
                {errors.recipient && (
                  <p id="recipient-error" className="field-error" role="alert">
                    {errors.recipient}
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="amount">Tip amount</label>
                <div
                  className="amount-presets"
                  role="group"
                  aria-label="Choose a tip amount"
                >
                  {["1", "5", "10", "25", "100"].map((preset) => (
                    <button
                      key={preset}
                      className="amount-button"
                      type="button"
                      aria-pressed={amount === preset}
                      onClick={() => {
                        setAmount(preset);
                        setReview(null);
                      }}
                    >
                      {preset}
                      <span>SQK</span>
                    </button>
                  ))}
                </div>
                <div className="amount-input">
                  <input
                    ref={amountInput}
                    id="amount"
                    name="amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    autoComplete="off"
                    aria-invalid={!!errors.amount}
                    aria-describedby={
                      errors.amount ? "amount-error" : "amount-help"
                    }
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setReview(null);
                    }}
                  />
                  <span>SQK</span>
                </div>
                <p id="amount-help" className="field-help">
                  Choose an amount above, or enter your own.
                </p>
                {errors.amount && (
                  <p id="amount-error" className="field-error" role="alert">
                    {errors.amount}
                  </p>
                )}
              </div>
            </fieldset>
            <div className="tip-balance">
              <span>
                <Icon name="wallet" size={16} />
                {!isConnected
                  ? "Your SQK balance"
                  : balance.isPending
                    ? "Reading your balance…"
                    : balance.isError
                      ? "Balance unavailable"
                      : "Available balance"}
              </span>
              <strong>
                {!isConnected || wrongChain
                  ? "–"
                  : balance.data != null
                    ? `${units(balance.data, token?.decimals, 4)} SQK`
                    : "–"}
              </strong>
            </div>
            {balance.isError && isConnected && (
              <p className="field-error">
                Could not read your SQK balance.{" "}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void balance.refetch()}
                >
                  Retry balance
                </button>
              </p>
            )}
            {wrongChain && (
              <p className="inline-notice">
                Switch to Sepolia using the wallet control above to send SQK.
              </p>
            )}
            {!economyFresh && (
              <p className="inline-notice">
                {!snap
                  ? "Loading the SQK token from Squeekchain…"
                  : "Token details are unavailable or stale. Sending is paused."}{" "}
                <button type="button" className="text-button" onClick={refresh}>
                  Retry data
                </button>
              </p>
            )}
            {review ? (
              <div className="transfer-review">
                <h3>Review your tip</h3>
                <p>
                  <strong>{review.display} SQK</strong> on Sepolia to:
                </p>
                <p className="address-text mono">{review.to}</p>
                <p className="field-help">
                  SQK contract:{" "}
                  <a
                    className="address-text mono text-link"
                    href={`${EXPLORER}/token/${review.token}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {review.token}
                  </a>
                </p>
                <p className="field-help">
                  An ERC-20 transfer from your wallet. Your wallet will also
                  show a Sepolia ETH gas fee. Transfers cannot be undone.
                </p>
                <button
                  type="button"
                  className="button button-primary full-width"
                  disabled={
                    busy ||
                    wrongChain ||
                    !economyFresh ||
                    tx.phase === "unknown"
                  }
                  onClick={() => void send()}
                >
                  <Icon name="heart" />
                  {tx.phase === "wallet"
                    ? "Confirm in wallet…"
                    : tx.phase === "pending"
                      ? "Waiting for confirmation…"
                      : "Send tip"}
                </button>
                {!busy && tx.phase !== "unknown" && (
                  <button
                    type="button"
                    className="text-button edit-tip"
                    onClick={() => setReview(null)}
                  >
                    Edit tip
                  </button>
                )}
              </div>
            ) : (
              <button
                type="submit"
                className="button button-primary full-width"
                disabled={wrongChain || (isConnected && !economyFresh)}
              >
                <Icon name={isConnected ? "heart" : "wallet"} />
                {isConnected ? "Review tip" : "Continue to wallet"}
              </button>
            )}
            <div
              className={`transaction-status ${tx.phase}`}
              role={tx.phase === "failed" ? "alert" : "status"}
            >
              {tx.message && (
                <>
                  <p>{tx.message}</p>
                  {tx.hash && (
                    <a
                      className="text-link"
                      href={`${EXPLORER}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction on Sepolia
                      <Icon name="external" size={14} />
                    </a>
                  )}
                  {tx.phase === "unknown" && (
                    <button
                      type="button"
                      className="button button-outline full-width"
                      onClick={() => void checkPending()}
                    >
                      Check confirmation
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="field-help tip-disclosure">
              Tips go straight to the recipient. No approvals or custody. SQK is
              a Sepolia test token.
            </p>
          </form>
          <div className="tip-faucet">
            <span>Need test SQK?</span>
            <a
              className="text-link"
              href="https://squeekchain.com/genesis"
              target="_blank"
              rel="noreferrer"
            >
              Visit Squeekchain
              <Icon name="external" size={14} />
            </a>
          </div>
        </Panel>
        <div className="panel-stack">
          <Panel
            title="Recent tips"
            icon="activity"
            aside={
              <button
                className="icon-button"
                aria-label="Refresh recent tips"
                disabled={!valid || !token || feed.isFetching}
                onClick={() => void feed.refetch()}
              >
                <Icon name="refresh" size={16} />
              </button>
            }
          >
            {!valid ? (
              <EmptyState icon="heart" title="Choose your streamer">
                Enter a streamer wallet to see their recent SQK tips.
              </EmptyState>
            ) : feed.isPending ? (
              <EmptyState title="Reading Sepolia…">
                Looking for incoming SQK transfers.
              </EmptyState>
            ) : feed.isError ? (
              <EmptyState title="Tips could not load">
                Try refreshing the tip feed.
              </EmptyState>
            ) : !feed.data?.length ? (
              <EmptyState icon="heart" title="The first squeek is yours">
                No tips found in the last 6,000 Sepolia blocks.
              </EmptyState>
            ) : (
              <ul className="recent-tips">
                {feed.data.slice(0, 8).map((tip) => (
                  <li key={`${tip.tx}:${tip.index}`}>
                    <span className="event-icon reward">
                      <Icon name="heart" />
                    </span>
                    <div>
                      <a
                        className="mono text-link"
                        href={`${EXPLORER}/address/${tip.from}`}
                        title={tip.from}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortAddress(tip.from)}
                      </a>
                      <a
                        href={`${EXPLORER}/tx/${tip.tx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="data-label"
                      >
                        Block {formatInt(String(tip.block))}
                        <Icon name="external" size={12} />
                      </a>
                    </div>
                    <strong>
                      +{units(tip.amount, token?.decimals, 4)}
                      <small>SQK</small>
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel
            title="Top tippers"
            icon="coins"
            aside={<span className="data-label">Recent window</span>}
          >
            {!ranked.length ? (
              <p className="panel-content muted">
                Top tippers appear here once recent transfers are available.
              </p>
            ) : (
              <ol className="leaderboard">
                {ranked.map(([from, value], index) => (
                  <li key={from}>
                    <span className="rank">{index + 1}</span>
                    <a
                      className="mono text-link"
                      href={`${EXPLORER}/address/${from}`}
                      title={from}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddress(from)}
                    </a>
                    <strong>
                      {units(value.total, token?.decimals, 4)} SQK
                    </strong>
                  </li>
                ))}
              </ol>
            )}
            <p className="panel-foot">
              Based on up to 100 incoming transfers in the last 6,000 blocks.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
