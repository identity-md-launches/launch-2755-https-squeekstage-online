import { createConfig, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";
import {
  createPublicClient,
  fallback,
  erc20Abi,
  parseAbiItem,
  type Address,
  type Hash,
} from "viem";

export { sepolia, erc20Abi };
export const RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://1rpc.io/sepolia",
] as const;
export const EXPLORER = "https://sepolia.etherscan.io";
export const config = createConfig({
  chains: [sepolia],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "SqueekStage",
      appLogoUrl: new URL("./favicon.svg", location.href).href,
      preference: "all",
    }),
  ],
  transports: { [sepolia.id]: http(RPC_URLS[0]) },
});
export const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback(
    RPC_URLS.map((url) => http(url, { timeout: 8000, retryCount: 0 })),
    { retryCount: 1 },
  ),
});
export interface Tip {
  from: Address;
  amount: bigint;
  block: bigint;
  tx: Hash;
  index: number;
}
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
export async function incomingTips(token: Address, recipient: Address) {
  const head = await publicClient.getBlockNumber();
  const result: Tip[] = [];
  let upper = head;
  for (let i = 0; i < 3 && upper >= 0n; i++) {
    const lower = upper > 1999n ? upper - 1999n : 0n;
    const logs = await publicClient.getLogs({
      address: token,
      event: transferEvent,
      args: { to: recipient },
      fromBlock: lower,
      toBlock: upper,
    });
    for (const log of logs) {
      if (
        log.removed ||
        !log.args.from ||
        log.args.value == null ||
        log.blockNumber == null ||
        log.transactionHash == null
      )
        continue;
      result.push({
        from: log.args.from,
        amount: log.args.value,
        block: log.blockNumber,
        tx: log.transactionHash,
        index: log.logIndex ?? 0,
      });
    }
    if (!lower) break;
    upper = lower - 1n;
  }
  return result
    .sort((a, b) =>
      a.block === b.block ? b.index - a.index : a.block > b.block ? -1 : 1,
    )
    .slice(0, 100);
}
export function walletError(error: unknown) {
  const value = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: { code?: number };
  };
  if (
    value.code === 4001 ||
    value.cause?.code === 4001 ||
    /reject|denied/i.test(value.message ?? "")
  )
    return "You declined the wallet request. You can try again.";
  return (
    value.shortMessage ??
    "The wallet request could not finish. Check your wallet and try again."
  );
}
