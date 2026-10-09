import { useState } from "react";
export default function TradeJournal({ note, onSave, disabled }: { note: string; onSave: (note: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(note);
  const [saved, setSaved] = useState(false);
  return <form className="qw-journal" onSubmit={e => { e.preventDefault(); onSave(draft); setSaved(true); }}>
    <label htmlFor="trade-note">Trading journal <small>Your note is separate from the immutable execution receipt.</small></label>
    <textarea id="trade-note" maxLength={2000} rows={4} value={draft} disabled={disabled} onChange={e => { setDraft(e.target.value); setSaved(false); }} placeholder="What worked? What would you do differently?" />
    <div><button type="submit" className="qw-small-action" disabled={disabled}>Save note</button><span role="status">{saved ? "Note updated · see workspace save status" : `${draft.length}/2000`}</span></div>
  </form>;
}
