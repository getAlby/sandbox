import { useScenarioStore } from "@/stores";
import {
  SimplePaymentScenario,
  LookupInvoiceScenario,
  LightningAddressScenario,
  NotificationsScenario,
  SubscriptionPaymentsScenario,
  HoldInvoiceScenario,
  TransactionHistoryScenario,
  ProofOfPaymentScenario,
  DecodeBolt11InvoiceScenario,
  FiatConversionScenario,
  PaymentForwardingScenario,
  PaymentPrismsScenario,
  LnurlVerifyScenario,
  WrappedInvoicesScenario,
} from "./scenarios";
import {
  BitcoinConnectButtonScenario,
  ConnectWalletScenario,
  PayButtonScenario,
  PaymentModalScenario,
} from "./bitcoin-connect";
import { L402FetchScenario, X402FetchScenario, MPPFetchScenario } from "./402";

export function ScenarioPanel() {
  const { currentScenario } = useScenarioStore();

  switch (currentScenario.id) {
    case "simple-payment":
      return <SimplePaymentScenario />;
    case "lookup-invoice":
      return <LookupInvoiceScenario />;
    case "lightning-address":
      return <LightningAddressScenario />;
    case "notifications":
      return <NotificationsScenario />;
    case "subscription-payments":
      return <SubscriptionPaymentsScenario />;
    case "hold-invoice":
      return <HoldInvoiceScenario />;
    case "transaction-history":
      return <TransactionHistoryScenario />;
    case "proof-of-payment":
      return <ProofOfPaymentScenario />;
    case "decode-bolt11-invoice":
      return <DecodeBolt11InvoiceScenario />;
    case "fiat-conversion":
      return <FiatConversionScenario />;
    case "payment-forwarding":
      return <PaymentForwardingScenario />;
    case "payment-prisms":
      return <PaymentPrismsScenario />;
    case "lnurl-verify":
      return <LnurlVerifyScenario />;
    case "wrapped-invoices":
      return <WrappedInvoicesScenario />;
    case "bitcoin-connect-button":
      return <BitcoinConnectButtonScenario />;
    case "connect-wallet":
      return <ConnectWalletScenario />;
    case "pay-button":
      return <PayButtonScenario />;
    case "payment-modal":
      return <PaymentModalScenario />;
    case "l402-fetch":
      return <L402FetchScenario />;
    case "x402-fetch":
      return <X402FetchScenario />;
    case "mpp-fetch":
      return <MPPFetchScenario />;
    default:
      return null;
  }
}
