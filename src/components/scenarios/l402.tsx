import { useState } from "react";
import { Loader2, Lock, Unlock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWalletStore, useTransactionStore } from "@/stores";
import { WALLET_PERSONAS } from "@/types";

const SERVER_URL = "https://alby-l402-proxy-server.vercel.app/";
const CONFIG_URL = "https://alby-l402-proxy-server.vercel.app/api/configure";


export function L402Scenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AlicePanel />
      <BobPanel />
    </div>
  );
}

function BobPanel() {
  const [isFetching, setIsFetching] = useState(false);
  const [data, setData] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [paymentRequired, setPaymentRequired] = useState<{ url: string, pct: string, offerId: string, offerDetails: Record<string, string | number>, fullResponse: Record<string, unknown> } | null>(null);

  const { getWallet, getNWCClient, setWalletBalance } = useWalletStore();
  const { addTransaction, updateTransaction, addFlowStep, updateFlowStep, addBalanceSnapshot } = useTransactionStore();

  const handleFetchInitial = async () => {
    setIsFetching(true);
    setData(null);
    setPaymentRequired(null);
    setStatusText("Initiating GET request to Alice's server...");

    const aliceWallet = getWallet("alice");

    try {
      if (!aliceWallet?.connectionString) {
        setStatusText("Error: Alice must connect her wallet in the navbar to serve L402 invoices.");
        setIsFetching(false);
        return;
      }

      setStatusText("fetching bitcoin price...");

      const keyResp = await fetch("https://alby-l402-proxy-server.vercel.app/api/config-key");
      const { publicKey } = await keyResp.json();

      const pemHeader = "-----BEGIN PUBLIC KEY-----";
      const pemFooter = "-----END PUBLIC KEY-----";
      const pemContents = publicKey.substring(
        publicKey.indexOf(pemHeader) + pemHeader.length,
        publicKey.indexOf(pemFooter)
      ).replace(/\s+/g, '');
      
      const binaryDerString = window.atob(pemContents);
      const binaryDer = new Uint8Array(binaryDerString.length);
      for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
      }
      
      const cryptoKey = await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        {
          name: "RSA-OAEP",
          hash: "SHA-256"
        },
        true,
        ["encrypt"]
      );
      
      const encodedNwcUrl = new TextEncoder().encode(aliceWallet.connectionString);
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        cryptoKey,
        encodedNwcUrl
      );
      
      const encryptedBase64 = window.btoa(
        String.fromCharCode(...new Uint8Array(encryptedBuffer))
      );

      await fetch(CONFIG_URL, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ encryptedNwcUrl: encryptedBase64 })
      });
      const initialFlowId = addFlowStep({
        fromWallet: "bob",
        toWallet: "alice",
        label: "GET /",
        direction: "right",
        status: "pending",
        snippetIds: [],
      });

      let response;
      try {
        response = await fetch(SERVER_URL);
      } catch {
        setStatusText("Error reaching remote server. Make sure the deployed backend is active.");
        updateFlowStep(initialFlowId, { status: "error", label: "Connection Refused" });
        setIsFetching(false);
        return;
      }

      const bodyResp = await response.json();

      if (response.status === 402) {
        setStatusText("Server responded with 402 Payment Required!");
        
        const offers = bodyResp.offers;
        const offer = offers?.[0];

        if (!offer || !bodyResp.payment_context_token || !bodyResp.payment_request_url) {
          throw new Error("L402 Response missing valid offers or payment context token");
        }

        updateFlowStep(initialFlowId, {
          label: "402 Payment Required",
          direction: "left",
          status: "success",
        });
        
        setPaymentRequired({ 
          url: bodyResp.payment_request_url, 
          pct: bodyResp.payment_context_token,
          offerId: offer.id,
          offerDetails: offer,
          fullResponse: bodyResp
        });
      } else if (response.ok) {
        updateFlowStep(initialFlowId, {
          label: "200 OK",
          direction: "left",
          status: "success",
        });
        setData(JSON.stringify(bodyResp, null, 2));
        setStatusText("Data fetched successfully.");
      } else {
        throw new Error(bodyResp.error || "Unexpected server error");
      }

    } catch (error) {
      console.error("L402 flow failed:", error);
      setStatusText(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const handlePayAndFetch = async () => {
    if (!paymentRequired) return;

    const bobClient = getNWCClient("bob");

    if (!bobClient) {
      setStatusText("Please connect Bob's wallet using the navbar to pay the L402 invoice!");
      return;
    }

    setIsFetching(true);
    setStatusText(`Requesting specific payment details...`);

    try {
      const paymentReqResponse = await fetch(paymentRequired.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offer_id: paymentRequired.offerId,
          payment_method: 'lightning',
          payment_context_token: paymentRequired.pct
        })
      });
      
      const paymentReqData = await paymentReqResponse.json();
      
      if (!paymentReqData.payment_request?.lightning_invoice) {
         throw new Error("Failed to receive valid lightning invoice from server.");
      }
      
      const invoiceToPay = paymentReqData.payment_request.lightning_invoice;
      const updatedPct = paymentReqData.payment_context_token;

      setStatusText(`Paying 402 invoice to access resource...`);

      const paymentTxId = addTransaction({
        type: "payment_sent",
        status: "pending",
        fromWallet: "bob",
        toWallet: "alice",
        amount: undefined,
        description: `L402 Automated Payment for API`,
        snippetIds: ["pay-invoice"],
      });

      const paymentFlowId = addFlowStep({
        fromWallet: "bob",
        toWallet: "alice",
        label: `Paying invoice...`,
        direction: "right",
        status: "pending",
        snippetIds: ["pay-invoice"],
      });

      const paymentResult = await bobClient.payInvoice({ invoice: invoiceToPay });
      const preimage = paymentResult.preimage;

      updateTransaction(paymentTxId, {
        status: "success",
        description: `L402 Automated Payment complete. Preimage: ${preimage}`,
      });

      updateFlowStep(paymentFlowId, {
        label: "Payment confirmed",
        status: "success",
      });

      const aliceClient = getNWCClient("alice");
      
      const bobBalance = await bobClient.getBalance();
      const bobBalanceSats = Math.floor(bobBalance.balance / 1000);
      setWalletBalance("bob", bobBalanceSats);
      addBalanceSnapshot({ walletId: "bob", balance: bobBalanceSats });

      if (aliceClient) {
        const aliceBalance = await aliceClient.getBalance();
        const aliceBalanceSats = Math.floor(aliceBalance.balance / 1000);
        setWalletBalance("alice", aliceBalanceSats);
        addBalanceSnapshot({ walletId: "alice", balance: aliceBalanceSats });
      }

      setStatusText("Payment successful. Replying with L402 token...");
      const finalFlowId = addFlowStep({
        fromWallet: "bob",
        toWallet: "alice",
        label: "GET /api/bitcoin-price (with L402)",
        direction: "right",
        status: "pending",
        snippetIds: [],
      });

      const retryResponse = await fetch(SERVER_URL, {
        headers: {
          "Authorization": `L402 ${updatedPct}`
        }
      });

      const retryBody = await retryResponse.json();

      if (retryResponse.ok) {
        updateFlowStep(finalFlowId, {
          label: `200 OK`,
          direction: "left",
          status: "success",
        });

        setData(JSON.stringify(retryBody, null, 2));
        setStatusText("Data fetched successfully.");
        setPaymentRequired(null);
      } else {
        throw new Error(retryBody.error || "Failed to fetch data with L402 token");
      }
    } catch (error) {
      console.error("L402 payment flow failed:", error);
      setStatusText(`Payment Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{WALLET_PERSONAS.bob.emoji}</span>
          <span>Bob: Client Application</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Bob acting as a client application wants to fetch a premium resource from Alice's API.
          </p>
          {!paymentRequired ? (
            <Button
              onClick={handleFetchInitial}
              disabled={isFetching}
              className="w-full"
            >
              {isFetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Fetch Bitcoin Price
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 pt-2 text-orange-600 dark:text-orange-400">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span className="text-sm font-medium">L402 Payment Required!</span>
                </div>
                <pre className="text-xs p-2 bg-muted rounded border overflow-x-auto text-foreground">
                  {JSON.stringify(paymentRequired.fullResponse, null, 2)}
                </pre>
              </div>
              
              <Button
                onClick={handlePayAndFetch}
                disabled={isFetching}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Paying Invoice...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Connect Wallet & Pay {paymentRequired.offerDetails?.amount} sats
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {statusText && (
          <div className="text-sm font-mono p-2 bg-muted rounded border">
            {statusText}
          </div>
        )}

        {data && (
          <div className="space-y-2 pt-2 border-t text-green-600 dark:text-green-400">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Successfully fetched resource!</span>
            </div>
            <pre className="text-xs p-2 bg-muted rounded border overflow-x-auto text-foreground">
              {data}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlicePanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span>{WALLET_PERSONAS.alice.emoji}</span>
          <span>Alice: L402 Server</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 h-full">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">API Resource Config</label>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Endpoint: /api/bitcoin-price</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Fixed L402 Price (sats)</label>
          <Input
            type="number"
            value={10}
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground mt-1">
            This server backend is automatically configured using Alice's wallet to receive Lightning payments.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
