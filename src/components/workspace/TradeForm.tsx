import TradeConfirmation from "./TradeConfirmation";
import {
  openPaper,
  valuePaper,
  priceForNetProfit,
  percentageTarget,
} from "@/lib/paper-execution";
import { useRef, useState, type Dispatch, type FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  ASSETS,
  euro,
  signedEuro,
  priceEuro,
  type Asset,
  type DemoAction,
} from "@/lib/demo-trading";
import { ActionButton, ChoiceField, Switch } from "./Controls";
import MobileDisclosure from "./MobileDisclosure";
export default function TradeForm({
  asset,
  dispatch,
  disabled = false,
  price,
  live = false,
  notice = "",
}: {
  asset: Asset;
  disabled?: boolean;
  price?: number;
  live?: boolean;
  notice?: string;
  dispatch: Dispatch<DemoAction>;
}) {
  const requestId = useRef<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const [amount, setAmount] = useState("€100"),
    [amountCustom, setAmountCustom] = useState("100");
  const [target, setTarget] = useState("+€5"),
    [targetCustom, setTargetCustom] = useState("5"),
    [targetUnit, setTargetUnit] = useState("EUR");
  const [protection, setProtection] = useState("None"),
    [protectionCustom, setProtectionCustom] = useState("2"),
    [auto, setAuto] = useState(true),
    [error, setError] = useState("");
  const read = (selection: string, custom: string) =>
    Number(selection === "Custom" ? custom : selection.replace(/[^0-9.]/g, ""));
  const amountValue = read(amount, amountCustom),
    amountCents = Math.round(amountValue * 100);
  const percent =
    target.includes("%") || (target === "Custom" && targetUnit === "%");
  const targetValue = read(target, targetCustom),
    targetCents = Math.round(
      percent ? percentageTarget(amountCents, targetValue) : targetValue * 100,
    );
  const protectionCents =
    protection === "None"
      ? null
      : Math.round(read(protection, protectionCustom) * 100);
  const validAmount =
    Number.isFinite(amountValue) &&
    amountCents >= 100 &&
    amountCents <= 1000000;
  const validTarget =
    Number.isFinite(targetValue) &&
    targetValue > 0 &&
    targetValue <= (percent ? 100 : 10000) &&
    targetCents >= 1;
  const validProtection =
    protectionCents === null ||
    (Number.isFinite(protectionCents) &&
      protectionCents >= 1 &&
      protectionCents < amountCents);
  const preview =
    validAmount && validTarget
      ? openPaper(amountCents, price ?? ASSETS[asset].price, 1, "preview")
      : null;
  const estimate = preview ? valuePaper(amountCents, preview) : null;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validAmount || !validTarget || !validProtection) {
      setError(
        !validAmount
          ? "Choose an amount between €1 and €10,000."
          : !validTarget
            ? "Choose a positive target of at least €0.01 (up to 100% or €10,000)."
            : "Protection must be at least €0.01 and less than your investment.",
      );
      return;
    }
    setError("");
    setReviewing(true);
  };
  const confirm = () => {
    if (disabled) return;
    requestId.current ??= crypto.randomUUID();
    dispatch({
      type: "BUY",
      requestId: requestId.current,
      asset,
      amount: amountCents,
      target: targetCents,
      protection: protectionCents,
      autoExit: auto,
      expectedQuote: price ?? ASSETS[asset].price,
      expectedMarketMode: live ? "live" : "demo",
    });
  };
  if (reviewing)
    return (
      <TradeConfirmation
        asset={asset}
        amount={amountCents}
        target={targetCents}
        targetLabel={
          percent
            ? `${targetValue}% net · ${signedEuro(targetCents)}`
            : signedEuro(targetCents)
        }
        protection={protectionCents}
        autoExit={auto}
        price={price ?? ASSETS[asset].price}
        disabled={disabled}
        live={live}
        notice={notice.startsWith("Market quote changed.") ? notice : ""}
        onConfirm={confirm}
        onBack={() => {
          setReviewing(false);
          requestAnimationFrame(() =>
            form.current
              ?.querySelector<HTMLButtonElement>('[type="submit"]')
              ?.focus(),
          );
        }}
      />
    );
  return (
    <form
      ref={form}
      className="qw-card qw-trade-form"
      onSubmit={submit}
      aria-labelledby="trade-form-title"
    >
      <div className="qw-card-heading">
        <h2 id="trade-form-title">Make your move.</h2>
        <span className="qw-overline">ONE TRADE</span>
      </div>
      <p className="qw-form-intro">A clear amount. A clear way out.</p>
      <ChoiceField
        label="Amount"
        hint="Simulated funds"
        options={["€50", "€100", "€250", "€500", "Custom"]}
        value={amount}
        onChange={setAmount}
        custom={amountCustom}
        onCustomChange={setAmountCustom}
        inputId="trade-amount"
      />
      <ChoiceField
        label="Profit target"
        hint="After simulated costs"
        options={["+€1", "+€2", "+€5", "+1%", "+2%", "Custom"]}
        value={target}
        onChange={setTarget}
        custom={targetCustom}
        onCustomChange={setTargetCustom}
        inputId="trade-target"
        unit={percent ? "%" : "€"}
      />
      {target === "Custom" && (
        <div className="qw-unit-picker" aria-label="Custom target unit">
          {["EUR", "%"].map((unit) => (
            <button
              type="button"
              key={unit}
              aria-pressed={targetUnit === unit}
              className={targetUnit === unit ? "is-selected" : ""}
              onClick={() => setTargetUnit(unit)}
            >
              {unit === "EUR" ? "Euros" : "Percentage"}
            </button>
          ))}
        </div>
      )}
      <div className="qw-target-explainer">
        <ArrowRight size={14} />
        {validAmount && validTarget ? (
          <>
            Exit at <strong>{signedEuro(targetCents)}</strong> net profit
            {percent && (
              <span>
                ({targetValue}% net return on {euro(amountCents)})
              </span>
            )}
          </>
        ) : (
          "Choose your amount and target"
        )}
      </div>
      {preview && estimate && (
        <p className="qw-micro">
          Estimated net target market price:{" "}
          {priceEuro(priceForNetProfit(amountCents, preview, targetCents))}.
          Entry and exit costs apply.
        </p>
      )}
      {estimate &&
        protectionCents !== null &&
        estimate.netProfit <= -protectionCents && (
          <p className="qw-micro" role="status">
            Estimated opening costs already meet this protection level. This
            paper trade would close immediately. Choose a wider protection level
            to monitor it.
          </p>
        )}
      <MobileDisclosure
        label="Downside protection"
        hint={
          protection === "None"
            ? "Optional · currently off"
            : protection === "Custom"
              ? `Custom · −${euro(protectionCents ?? 0)}`
              : `Selected ${protection}`
        }
        className="qw-protection-disclosure"
      >
        <div className="qw-protection">
          <ChoiceField
            label="Protection"
            hint="Optional"
            options={["None", "−€1", "−€2", "−€5", "Custom"]}
            value={protection}
            onChange={setProtection}
            custom={protectionCustom}
            onCustomChange={setProtectionCustom}
            inputId="trade-protection"
          />
          <p>
            <ShieldCheck size={12} /> A downside exit. Not a guaranteed loss
            limit.
          </p>
        </div>
      </MobileDisclosure>
      <Switch
        label="Auto-exit when profit target is reached"
        checked={auto}
        onChange={setAuto}
        description={
          auto
            ? "Your target closes the simulated position for you."
            : "You choose when to sell. Protection still applies."
        }
      />
      <div className="qw-trade-summary">
        <span>
          You invest<strong>{validAmount ? euro(amountCents) : "—"}</strong>
        </span>
        <span>
          You aim to bring home
          <strong>
            {validAmount && validTarget ? euro(amountCents + targetCents) : "—"}
          </strong>
        </span>
      </div>
      {error && (
        <p className="qw-error" role="alert">
          {error}
        </p>
      )}
      <ActionButton type="submit" disabled={disabled}>
        {auto ? "Buy & Auto-Exit" : "Buy & Monitor"}
      </ActionButton>
      <p className="qw-micro">
        Demo trade only. No deposit or real money needed.
      </p>
    </form>
  );
}
