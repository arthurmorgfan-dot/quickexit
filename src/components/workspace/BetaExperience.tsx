import { useEffect, useState, type FormEvent } from "react";
import { completeIntroduction, introductionSeen, feedbackReport } from "@/lib/beta-experience";

export function Introduction({ always = false, compact = false, onMarkets }: { always?: boolean; compact?: boolean; onMarkets: () => void }) {
  const [visible, setVisible] = useState(false);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try { setVisible(always || !introductionSeen(window.localStorage)); }
      catch { setVisible(true); }
    }, 0);
    return () => clearTimeout(timer);
  }, [always]);
  const finish = (explore: boolean) => {
    let saved = false;
    try { saved = completeIntroduction(window.localStorage); } catch { /* Browser storage may be blocked. */ }
    setVisible(false);
    if (!saved) setWarning("Introduction dismissed for this visit. Browser storage is unavailable, so this preference cannot be saved.");
    if (explore) onMarkets();
  };
  return <>
    {(visible || always) && <section className={`qw-card qw-introduction${compact ? " qx-compact-intro" : ""}`} aria-labelledby="intro-title">
      <div className="qw-card-heading"><h2 id="intro-title">A small practice. A clearer plan.</h2><span className="qw-badge">OPTIONAL INTRO</span></div>
      <p>QuickExit lets you practise a trade from entry to exit. Live market prices and charts come from Coinbase; all balances, fees, trades and transfers are simulated.</p>
      <ol><li>Choose BTC, ETH or SOL in Markets.</li><li>Choose an investment and a net profit target in Trade. Review costs before confirming your paper trade.</li><li>Monitor your position or choose auto-exit. Review fixed receipts, performance and journal notes in Positions and Home.</li></ol>
      <p className="qw-micro">Demo price controls in Settings are deterministic, rather than live market prices. Your local portfolio stays in this browser.</p>
      <div className="qw-beta-actions"><button type="button" className="qw-small-action" onClick={() => finish(true)}>Explore Markets</button>{!always && <button type="button" className="qw-text-button" onClick={() => finish(false)}>Skip introduction</button>}</div>
    </section>}
    {warning && <p role="status">{warning}</p>}
  </>;
}

export function BetaFeedback() {
  const [kind, setKind] = useState("Bug"), [text, setText] = useState(""), [message, setMessage] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const report = feedbackReport(kind, text);
    if (!report) { setMessage("Describe the issue or suggestion in 10–2,000 characters."); return; }
    try {
      const url = URL.createObjectURL(new Blob([report], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = "quickexit-feedback.txt"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Report prepared for download. Send the file through your beta invitation’s feedback channel. Nothing has been submitted automatically.");
    } catch { setMessage("Download unavailable. Copy your description and send it through your beta invitation’s feedback channel."); }
  };
  return <section className="qw-card qw-beta-feedback" aria-labelledby="feedback-title">
    <h2 id="feedback-title">Help shape QuickExit</h2>
    <p>Report a bug or suggest an improvement. Describe what you expected, what happened, and how to repeat it. Leave out names, emails, passwords and financial details.</p>
    <form onSubmit={submit}>
      <label htmlFor="feedback-kind">Report type</label><select id="feedback-kind" value={kind} onChange={e => setKind(e.target.value)}><option>Bug</option><option>Suggestion</option></select>
      <label htmlFor="feedback-description">Your feedback</label><textarea id="feedback-description" value={text} maxLength={2000} onChange={e => { setText(e.target.value); setMessage(""); }} rows={5} aria-describedby="feedback-privacy" />
      <p id="feedback-privacy" className="qw-micro">Only the type and text you write go into the file. No portfolio or account information is attached. Feedback is not saved across refreshes.</p>
      <button type="submit" className="qw-small-action">Download feedback report</button>
      <p role="status">{message}</p>
    </form>
  </section>;
}

export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const timer = setTimeout(update, 0);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { clearTimeout(timer); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return offline ? <p className="qw-market-status" role="status">You’re offline. Your device copy remains available. Market prices may be stale; live paper trades require fresh quotes. Reconnect to resume market updates.</p> : null;
}
