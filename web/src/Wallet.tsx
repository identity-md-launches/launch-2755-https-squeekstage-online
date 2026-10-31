import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia, walletError } from "./chain";
import { shortAddress } from "./settings";
import { Icon } from "./graphics";

const WalletContext = createContext<() => void>(() => {});
export const useOpenWallet = () => useContext(WalletContext);
export const OPEN_IN = [
  {
    id: "metamask",
    name: "MetaMask",
    href: (url: string) =>
      `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, "")}`,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    href: (url: string) =>
      `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: "rabby",
    name: "Rabby",
    href: (url: string) =>
      `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${encodeURIComponent(url)}`,
  },
  {
    id: "phantom",
    name: "Phantom",
    href: (url: string) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
  },
];
export function WalletProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending, variables } = useConnect();
  const { disconnect } = useDisconnect();
  const [note, setNote] = useState("");
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !connectors.some((c) => c.type === "injected" && c.id !== "injected");
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = connectors
    .filter((c) => !(c.id === "injected" && (named || mobile)))
    .sort(
      (a, b) => Number(b.type === "injected") - Number(a.type === "injected"),
    );
  function open() {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setNote("");
    dialog.current?.showModal();
  }
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const targets = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length > 0);
    const first = targets[0],
      last = targets.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  useEffect(() => {
    if (isConnected) dialog.current?.close();
  }, [isConnected]);
  return (
    <WalletContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        className="wallet-dialog"
        onKeyDown={trapFocus}
        onClose={() => trigger.current?.focus()}
        aria-labelledby="wallet-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="sheet-head">
          <h2 id="wallet-title">
            {isConnected ? "Your wallet" : "Connect a wallet"}
          </h2>
          <button
            className="icon-button"
            aria-label="Close wallet dialog"
            onClick={() => dialog.current?.close()}
          >
            <Icon name="close" />
          </button>
        </div>
        {isConnected && address ? (
          <>
            <p className="muted">
              Connected on{" "}
              {chainId === sepolia.id ? "Sepolia" : "another network"}.
            </p>
            <p className="address-text mono">{address}</p>
            <button
              className="button button-outline full-width"
              onClick={() => {
                disconnect();
                dialog.current?.close();
              }}
            >
              Disconnect
            </button>
          </>
        ) : (
          <>
            <p className="muted sheet-description">
              Choose how to connect. Tips use SQK on Sepolia.
            </p>
            <div className="wallet-rows">
              {mobile &&
                OPEN_IN.map((wallet) => (
                  <a
                    className="wallet-row"
                    key={wallet.id}
                    href={wallet.href(location.href)}
                  >
                    <img
                      src={`./wallets/${wallet.id}.svg`}
                      width="28"
                      height="28"
                      alt=""
                    />
                    <span>Open in {wallet.name}</span>
                    <Icon name="external" size={16} />
                  </a>
                ))}
              {listed.map((connector) => (
                <button
                  key={connector.uid}
                  className="wallet-row"
                  disabled={isPending}
                  aria-busy={isPending && variables?.connector === connector}
                  onClick={async () => {
                    setNote("");
                    try {
                      await connectAsync({ connector });
                      dialog.current?.close();
                    } catch (error) {
                      setNote(walletError(error));
                    }
                  }}
                >
                  {connector.icon ? (
                    <img src={connector.icon} width="28" height="28" alt="" />
                  ) : connector.id === "coinbaseWalletSDK" ? (
                    <img
                      src="./wallets/coinbase.svg"
                      width="28"
                      height="28"
                      alt=""
                    />
                  ) : (
                    <span className="generic-wallet">
                      <Icon name="wallet" size={24} />
                    </span>
                  )}
                  <span>
                    {connector.id === "injected"
                      ? "Browser wallet"
                      : connector.id === "coinbaseWalletSDK" && mobile
                        ? "Coinbase Smart Wallet"
                        : connector.name}
                    {isPending && variables?.connector === connector
                      ? " · Opening…"
                      : ""}
                  </span>
                  {isPending && variables?.connector === connector ? (
                    <span className="spinner" />
                  ) : (
                    <Icon name="chevron" size={16} />
                  )}
                </button>
              ))}
            </div>
            <p className="wallet-note" role="status">
              {note || "Your wallet asks for permission before connecting."}
            </p>
          </>
        )}
      </dialog>
    </WalletContext.Provider>
  );
}

export function WalletControl() {
  const open = useOpenWallet();
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const [switchError, setSwitchError] = useState("");
  async function switchNetwork() {
    setSwitchError("");
    try {
      await switchChainAsync({ chainId: sepolia.id });
    } catch (error) {
      setSwitchError(walletError(error));
    }
  }
  return (
    <div className="wallet-control">
      {isConnected && address ? (
        <>
          {chainId !== sepolia.id ? (
            <>
              <button
                className="button button-outline"
                onClick={switchNetwork}
                disabled={switching}
              >
                {switching ? "Switching…" : "Switch to Sepolia"}
              </button>
              <button
                className="icon-button"
                aria-label="Wallet options"
                onClick={open}
              >
                <Icon name="chevron" size={16} />
              </button>
            </>
          ) : (
            <button
              className="button button-outline connected-wallet"
              onClick={open}
              title={address}
            >
              <Icon name="wallet" />
              <span>{shortAddress(address)}</span>
            </button>
          )}
          {switchError && (
            <div className="wallet-network-error" role="alert">
              {switchError}
              <button
                className="text-button"
                onClick={() => setSwitchError("")}
              >
                Dismiss
              </button>
            </div>
          )}
        </>
      ) : (
        <button className="button button-outline connect-button" onClick={open}>
          <Icon name="wallet" size={16} />
          Connect
        </button>
      )}
    </div>
  );
}
