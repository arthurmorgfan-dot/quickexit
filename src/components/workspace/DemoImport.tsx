import { useRef, useState } from "react";
import { euro } from "@/lib/demo-trading";
import type { DemoImportPreview } from "@/lib/account/import-preview";

/** Confirmation applies to the exact snapshot captured by the account store. */
export default function DemoImport({ preview, onChoose }: { preview: DemoImportPreview | null; onChoose: (useLocal: boolean) => Promise<void> }) {
  const [choice, setChoice] = useState<"import" | "fresh" | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const lock = useRef(false), cancel = useRef<HTMLButtonElement>(null);
  const confirm = async () => {
    if (!choice || lock.current) return;
    lock.current = true; setPending(true); setError("");
    try { await onChoose(choice === "import"); }
    catch { setError("The transfer could not be confirmed. Your local demo is kept. Retry when connected."); }
    finally { lock.current = false; setPending(false); }
  };
  const review = (value: "import" | "fresh") => {
    setChoice(value); setError("");
    requestAnimationFrame(() => cancel.current?.focus());
  };
  return <div className="qw-demo-import">
    <p>Your account is empty. Choose one portfolio; unrelated portfolios are never merged. Your local demo remains on this device.</p>
    {preview && <dl className="qw-import-preview">
      <div><dt>Virtual cash</dt><dd>{euro(preview.cash)}</dd></div>
      <div><dt>Simulated transfers recorded</dt><dd>{euro(preview.sent)}</dd></div>
      <div><dt>Selected asset / price mode</dt><dd>{preview.selectedAsset} / {preview.mode === "live" ? "Live" : "Demo"}</dd></div>
      <div><dt>Active position</dt><dd>{preview.active ? `${preview.active.asset} · ${euro(preview.active.amount)} invested · ${euro(preview.active.target)} net target · ${preview.active.protection === null ? "no protection" : euro(preview.active.protection) + " protection"} · auto-exit ${preview.active.autoExit ? "on" : "off"}` : "None"}</dd></div>
      <div><dt>Completed trades / fixed receipts / legacy records</dt><dd>{preview.completed} / {preview.receipts} / {preview.legacy}</dd></div>
      <div><dt>Journal notes / activity events</dt><dd>{preview.notes} / {preview.activity}</dd></div>
    </dl>}
    <p className="qw-micro">Import copies the captured paper portfolio, historical execution details, simulated balances and transfers, journal, activity, selected asset, and paper preferences. Illustrative examples stay marked as examples. Cached quotes are excluded; chart settings and introduction completion stay device-local. No real funds, bank details or other accounts transfer.</p>
    {choice ? <div className="qw-reset-confirmation" role="group" aria-label="Confirm account starting portfolio" onKeyDown={e => { if (e.key === "Escape" && !pending) setChoice(null); }}>
      <p>{choice === "import" ? "Copy this reviewed demo into your empty paper account? This is a one-time import. Your device demo stays intact; nothing is merged or deleted." : "Start a fresh €10,000 paper account without importing this demo? Your existing device portfolio, receipts and notes stay intact. Import will no longer be available after this choice is saved."}</p>
      <button type="button" className="qw-small-action" disabled={pending} onClick={() => void confirm()}>{pending ? "Saving your choice…" : choice === "import" ? "Confirm demo transfer" : "Confirm fresh account"}</button>
      <button ref={cancel} type="button" className="qw-text-button" disabled={pending} onClick={() => setChoice(null)}>Cancel</button>
    </div> : <div className="qw-beta-actions">
      <button type="button" className="qw-small-action" disabled={!preview} onClick={() => review("import")}>Review demo transfer</button>
      <button type="button" className="qw-text-button" onClick={() => review("fresh")}>Start fresh</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
