import { useState } from "react";
import { Copy, Lightbulb, Loader2, ShieldCheck } from "lucide-react";
import { fetch402, Invoice } from "@getalby/lightning-tools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWalletStore, useTransactionStore } from "@/stores";
import { WALLET_PERSONAS } from "@/types";

const PROXY_BASE_URL = "https://402-proxy.albylabs.com/x402";
const DEFAULT_PROTECTED_URL = "https://example.com";
const DEFAULT_PRICE_SATS = 1;

export function X402FetchScenario() {
  const { areAllWalletsConnected } = useWalletStore();
  const allConnected = areAllWalletsConnected(["alice", "bob"]);

  const [protectedUrl, setProtectedUrl] = useState(DEFAULT_PROTECTED_URL);
  const [priceSats, setPriceSats] = useState(DEFAULT_PRICE_SATS);

  if (!allConnected) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AlicePanel
        protectedUrl={protectedUrl}
        priceSats={priceSats}
        onProtectedUrlChange={setProtectedUrl}
        onPriceSatsChange={setPriceSats}
      />
      <BobPanel protectedUrl={protectedUrl} priceSats={priceSats} />
    </div>
  );
}

interface AlicePanelProps {
  protectedUrl: string;
  priceSats: number;
  onProtectedUrlChange: (url: string) => void;
  onPriceSatsChange: (sats: number) => void;
}

function AlicePanel({
  protectedUrl,
  priceSats,
  onProtectedUrlChange,
  onPriceSatsChange,
}: AlicePanelProps) {
  const { getWallet } = useWalletStore();
  const aliceWallet = getWallet("alice");
  const [copied, setCopied] = useState(false);

  const endpointUrl = aliceWallet?.connectionString
    ? `${PROXY_BASE_URL}?url=${encodeURIComponent(protectedUrl)}&nwc_url=${encodeURIComponent(aliceWallet.connectionString)}&amount=${priceSats}`
    : null;

  const handleCopy = () => {
    if (!endpointUrl) return;
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{WALLET_PERSONAS.alice.emoji}</span>
          <span>Alice: Protected Resource</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The 402 proxy uses Alice's NWC connection to create a Lightning
          invoice when Bob fetches the resource. The invoice is bound to Bob's
          exact request.
        </p>

        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Protected URL
            </label>
            <Input
              value={protectedUrl}
              onChange={(e) => onProtectedUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="font-mono text-xs h-8"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground mr-2">
              Price (sats)
            </label>
            <Input
              type="number"
              min={1}
              value={priceSats}
              onChange={(e) =>
                onPriceSatsChange(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="font-mono text-xs h-8 w-28"
            />
          </div>
        </div>

        {endpointUrl ? (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              402 Endpoint URL
            </label>
            <div className="relative rounded-lg bg-muted p-3 pr-10">
              <p className="break-all font-mono text-xs leading-relaxed">
                {endpointUrl}
              </p>
              <button
                onClick={handleCopy}
                className="absolute right-2 top-2 rounded p-1 hover:bg-background"
                title="Copy URL"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Copied to clipboard
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
            Alice's wallet is not connected.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface BobPanelProps {
  protectedUrl: string;
  priceSats: number;
}

function BobPanel({ protectedUrl, priceSats }: BobPanelProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [responseBody, setResponseBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { getNWCClient, getWallet, setWalletBalance } = useWalletStore();
  const {
    addTransaction,
    updateTransaction,
    addFlowStep,
    updateFlowStep,
    addBalanceSnapshot,
  } = useTransactionStore();

  const aliceWallet = getWallet("alice");

  const endpointUrl = aliceWallet?.connectionString
    ? `${PROXY_BASE_URL}?url=${encodeURIComponent(protectedUrl)}&nwc_url=${encodeURIComponent(aliceWallet.connectionString)}&amount=${priceSats}`
    : null;

  const handleFetch = async () => {
    if (!endpointUrl) return;

    const bobClient = getNWCClient("bob");
    if (!bobClient) return;

    setIsFetching(true);
    setError(null);
    setResponseBody(null);

    const txId = addTransaction({
      type: "payment_sent",
      status: "pending",
      fromWallet: "bob",
      toWallet: "alice",
      amount: priceSats,
      description: `x402 fetch: ${protectedUrl}`,
      snippetIds: ["fetch-with-l402"],
    });

    const step1Id = addFlowStep({
      fromWallet: "bob",
      toWallet: "alice",
      label: "GET /resource",
      direction: "left",
      status: "pending",
      snippetIds: ["fetch-with-l402"],
    });

    let step4Id = "";

    try {
      const wallet = {
        payInvoice: async (args: { invoice: string }) => {
          const invoiceObj = new Invoice({ pr: args.invoice });
          const amountSats = invoiceObj.satoshi ?? priceSats;

          updateTransaction(txId, { amount: amountSats });

          updateFlowStep(step1Id, {
            label: "GET /resource",
            status: "success",
          });

          addFlowStep({
            fromWallet: "alice",
            toWallet: "bob",
            label: `HTTP 402 + PAYMENT-REQUIRED (${amountSats} sats)`,
            direction: "right",
            status: "success",
          });

          const step3Id = addFlowStep({
            fromWallet: "bob",
            toWallet: "alice",
            label: `Pay ${amountSats} sat invoice...`,
            direction: "left",
            status: "pending",
          });

          const result = await bobClient.payInvoice({ invoice: args.invoice });

          updateFlowStep(step3Id, {
            label: `Invoice paid (${amountSats} sats)`,
            status: "success",
          });

          step4Id = addFlowStep({
            fromWallet: "bob",
            toWallet: "alice",
            label: "GET /resource + PAYMENT-SIGNATURE: preimage",
            direction: "left",
            status: "pending",
          });

          return { preimage: result.preimage };
        },
      };

      const response = await fetch402(endpointUrl, {}, { wallet });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      setResponseBody(body);

      if (step4Id) {
        updateFlowStep(step4Id, {
          label: "GET /resource + PAYMENT-SIGNATURE: preimage",
          status: "success",
        });
      }

      addFlowStep({
        fromWallet: "alice",
        toWallet: "bob",
        label: "HTTP 200 OK — resource delivered",
        direction: "right",
        status: "success",
      });

      updateTransaction(txId, {
        status: "success",
        description: `x402 fetch succeeded: ${protectedUrl}`,
      });

      // Refresh balances
      const bobBalance = await bobClient.getBalance();
      const bobBalanceSats = Math.floor(bobBalance.balance / 1000);
      setWalletBalance("bob", bobBalanceSats);
      addBalanceSnapshot({ walletId: "bob", balance: bobBalanceSats });

      const aliceClient = getNWCClient("alice");
      if (aliceClient) {
        const aliceBalance = await aliceClient.getBalance();
        const aliceBalanceSats = Math.floor(aliceBalance.balance / 1000);
        setWalletBalance("alice", aliceBalanceSats);
        addBalanceSnapshot({ walletId: "alice", balance: aliceBalanceSats });
      }
    } catch (err) {
      console.error("x402 fetch failed:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);

      updateTransaction(txId, {
        status: "error",
        description: `x402 fetch failed: ${errorMessage}`,
      });

      if (step4Id) {
        updateFlowStep(step4Id, {
          label: `Payment failed: ${errorMessage}`,
          status: "error",
        });
      } else {
        updateFlowStep(step1Id, {
          label: `Request failed: ${errorMessage}`,
          status: "error",
        });
      }
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{WALLET_PERSONAS.bob.emoji}</span>
          <span>Bob: Fetch Protected Resource</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Bob calls <code className="text-xs">fetch402</code> which detects the{" "}
          <code className="text-xs">PAYMENT-REQUIRED</code> header, checks
          the invoice is bound to this request, pays it, and retries with the
          preimage as proof of payment.
        </p>

        <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
          <Lightbulb className="size-3.5 shrink-0 text-yellow-500/70" />
          Open your browser devtools network tab to inspect the 402 request flow.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {responseBody !== null && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              Response received
            </label>
            <div className="rounded-lg bg-muted p-3">
              <pre className="text-xs whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                {responseBody.length > 1000
                  ? responseBody.slice(0, 1000) + "\n…(truncated)"
                  : responseBody}
              </pre>
            </div>
          </div>
        )}

        <Button
          onClick={handleFetch}
          disabled={isFetching || !endpointUrl}
          className="w-full"
        >
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Fetch Resource
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
