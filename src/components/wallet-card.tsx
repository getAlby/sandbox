import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  Wallet,
  Unplug,
  Rocket,
  Zap,
  Plug,
  Lightbulb,
  X,
  ExternalLink,
  MoreVertical,
  Copy,
  CreditCard,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { NWCClient } from "@getalby/sdk/nwc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Wallet as WalletType } from "@/types";
import { useWalletStore, useTransactionStore } from "@/stores";
import { useFiatValue } from "@/hooks/use-fiat";
import { createTestWallet, topUpWallet } from "@/lib/faucet";

interface WalletCardProps {
  wallet: WalletType;
}

export function WalletCard({ wallet }: WalletCardProps) {
  const [connectionInput, setConnectionInput] = useState("");
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const reconnectAttempted = useRef(false);
  const {
    setWalletConnection,
    setWalletStatus,
    disconnectWallet,
    setWalletBalance,
    setNWCClient,
    getNWCClient,
  } = useWalletStore();
  const { addBalanceSnapshot } = useTransactionStore();

  const connectWithNWC = async (connectionSecret: string) => {
    for (let attempt = 0; ; attempt++) {
      try {
        // Create NWC client
        const client = new NWCClient({
          nostrWalletConnectUrl: connectionSecret,
        });

        // Store the client
        setNWCClient(wallet.id, client);

        // Get balance (returns millisats, convert to sats)
        const { balance: balanceMillisats } = await client.getBalance();
        const balanceSats = Math.floor(balanceMillisats / 1000);

        // Extract lightning address from connection string
        const lightningAddress = client.lud16 || null;

        // Update wallet state
        setWalletConnection(
          wallet.id,
          connectionSecret,
          lightningAddress ?? undefined,
        );
        setWalletBalance(wallet.id, balanceSats);

        // Record initial balance for visualizations
        addBalanceSnapshot({ walletId: wallet.id, balance: balanceSats });

        setConnectionInput("");
        break;
      } catch (error) {
        console.error("Failed to connect wallet:", error);
        if (attempt < 3) {
          continue;
        }
        throw error;
      }
    }
  };

  // Auto-reconnect wallets that have a stored connection string but no active client
  useEffect(() => {
    if (
      wallet.connectionString &&
      wallet.status === "disconnected" &&
      !getNWCClient(wallet.id) &&
      !reconnectAttempted.current
    ) {
      reconnectAttempted.current = true;
      setWalletStatus(wallet.id, "connecting");
      connectWithNWC(wallet.connectionString).catch(() => {
        setWalletStatus(wallet.id, "error", "Failed to reconnect wallet");
      });
    }
  }, [wallet.id, wallet.connectionString, wallet.status]);

  const handleConnect = async (connectionString: string) => {
    if (!connectionString.trim()) return;

    setWalletStatus(wallet.id, "connecting");

    try {
      await connectWithNWC(connectionString.trim());
    } catch {
      setWalletStatus(wallet.id, "error", "Failed to connect wallet");
    }
  };

  const handleCreateTestWallet = async () => {
    setIsCreatingWallet(true);
    setWalletStatus(wallet.id, "connecting");

    try {
      const connectionSecret = await createTestWallet();
      await connectWithNWC(connectionSecret);
    } catch (error) {
      console.error("Failed to create test wallet:", error);
      setWalletStatus(wallet.id, "error", "Failed to create test wallet");
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const handleTopUp = async () => {
    const username = wallet.lightningAddress?.split("@")[0];
    if (!username) return;

    try {
      await topUpWallet(username);

      // Refresh balance from the NWC client
      const client = getNWCClient(wallet.id);
      if (client) {
        const { balance: balanceMillisats } = await client.getBalance();
        const balanceSats = Math.floor(balanceMillisats / 1000);
        setWalletBalance(wallet.id, balanceSats);
        addBalanceSnapshot({ walletId: wallet.id, balance: balanceSats });
      }
    } catch (error) {
      console.error("Failed to top up wallet:", error);
    }
  };

  const handleDisconnect = () => {
    if (
      !confirm(
        "Are you sure you wish to disconnect this wallet? the connection will be wiped from local storage. Make sure to copy the connection secret first if you still need it.",
      )
    ) {
      return;
    }
    disconnectWallet(wallet.id);
  };

  const isConnecting = wallet.status === "connecting";
  const isConnected = wallet.status === "connected";
  const hasConnection = !!wallet.connectionString;
  const hasError = wallet.status === "error";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl">{wallet.emoji}</span>
            <span>{wallet.name}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={wallet.status} />
            {isConnected && (
              <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 -mr-4 -ml-1"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Wallet options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      if (wallet.connectionString) {
                        navigator.clipboard.writeText(wallet.connectionString);
                      }
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Connection Secret
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowQRDialog(true)}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Show QR Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleTopUp}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Top Up Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDisconnect}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect Wallet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>
                      Connect {wallet.name}'s Wallet
                    </DialogTitle>
                  </DialogHeader>
                  {wallet.connectionString && (
                    <div className="rounded-lg bg-white p-3 w-full">
                      <QRCodeSVG
                        value={wallet.connectionString}
                        size={undefined}
                        style={{ width: "100%", height: "auto" }}
                        level="M"
                      />
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {isConnected ? (
          <ConnectedState wallet={wallet} />
        ) : (
          <DisconnectedState
            wallet={wallet}
            hasConnection={hasConnection}
            connectionInput={connectionInput}
            isCreatingWallet={isCreatingWallet}
            isConnecting={isConnecting}
            hasError={hasError}
            onConnectionInputChange={setConnectionInput}
            onConnect={() =>
              handleConnect(wallet.connectionString || connectionInput)
            }
            onRemove={handleDisconnect}
            onCreateTestWallet={handleCreateTestWallet}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: WalletType["status"] }) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="default" className="bg-green-500">
          Connected
        </Badge>
      );
    case "connecting":
      return <Badge variant="secondary">Connecting...</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">Disconnected</Badge>;
  }
}

interface ConnectedStateProps {
  wallet: WalletType;
}

function ConnectedState({ wallet }: ConnectedStateProps) {
  const fiatValue = useFiatValue(wallet.balance ?? 0);
  const [nwcInfoOpen, setNwcInfoOpen] = useState(false);

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Wallet className="h-4 w-4" />
          <span>NWC</span>
          <Popover open={nwcInfoOpen} onOpenChange={setNwcInfoOpen}>
            <PopoverTrigger asChild>
              <button
                className="inline-flex items-center justify-center rounded-full bg-yellow-500/20 p-1 text-yellow-600 hover:bg-yellow-500/30 dark:text-yellow-400 dark:hover:bg-yellow-500/40 transition-colors"
                aria-label="Learn about NWC"
              >
                <Lightbulb className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Nostr Wallet Connect</h4>
                  <button
                    onClick={() => setNwcInfoOpen(false)}
                    className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-muted-foreground">
                  Nostr Wallet Connect (NWC) is an open protocol to connect
                  lightning wallets to apps
                </p>
                <a
                  href="https://nwc.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  Learn more at nwc.dev
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="text-2xl font-bold">
          {wallet.balance?.toLocaleString() ?? "—"} sats
        </div>
        <div className="text-sm text-muted-foreground">{fiatValue}</div>
        {wallet.lightningAddress && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            <span className="truncate">{wallet.lightningAddress}</span>
          </div>
        )}
      </div>
    </>
  );
}

interface DisconnectedStateProps {
  wallet: WalletType;
  connectionInput: string;
  isCreatingWallet: boolean;
  isConnecting: boolean;
  hasError: boolean;
  hasConnection: boolean;
  onConnectionInputChange: (value: string) => void;
  onConnect: () => void;
  onRemove: () => void;
  onCreateTestWallet: () => void;
}

function DisconnectedState({
  wallet,
  connectionInput,
  isCreatingWallet,
  isConnecting,
  hasError,
  hasConnection,
  onConnectionInputChange,
  onConnect,
  onRemove,
  onCreateTestWallet,
}: DisconnectedStateProps) {
  return (
    <>
      <div className="text-2xl font-bold text-muted-foreground">— sats</div>

      {hasError && wallet.error && (
        <p className="text-sm text-destructive">{wallet.error}</p>
      )}

      <p className="text-sm text-muted-foreground">
        Connect {wallet.name}'s wallet to try this scenario
      </p>

      {!hasConnection && (
        <>
          <Button
            onClick={onCreateTestWallet}
            disabled={isConnecting || isCreatingWallet}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : isCreatingWallet ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Create Test Wallet
              </>
            )}
          </Button>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Or paste connection secret:
            </p>
            <Input
              placeholder="nostr+walletconnect://..."
              value={connectionInput}
              onChange={(e) => onConnectionInputChange(e.target.value)}
              disabled={isConnecting}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onConnect}
              disabled={!connectionInput.trim() || isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </>
      )}
      {hasConnection && (
        <>
          <Button
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plug className="mr-2 h-4 w-4" />
                Reconnect
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRemove}
            className="w-full"
          >
            <Unplug className="mr-2 h-4 w-4" />
            Remove
          </Button>
        </>
      )}
    </>
  );
}
