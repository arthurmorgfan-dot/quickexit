const questions = [
  [
    "What is QuickExit?",
    "QuickExit is a crypto trading product concept built around one amount, one profit target, and a clear exit. The goal is to automatically close a position at your target and make it easy to send the resulting money back to your bank.",
  ],
  [
    "Can I trade with QuickExit today?",
    "Not yet. This page is an interactive product prototype. The prices and profits are illustrative, and no accounts, payments, or live trades are available. You can explore the preview without signing up.",
  ],
  [
    "Is my profit target guaranteed?",
    "No. Crypto prices can fall as well as rise, and a target may never be reached. In a future live service, execution prices could differ from your target because of market movement, liquidity, slippage, or fees. You can lose money.",
  ],
  [
    "How would downside protection work?",
    "The concept lets you choose a loss threshold alongside your profit target. A future live implementation would aim to close a position when that threshold is reached. It would not guarantee a maximum loss or an exact execution price.",
  ],
  [
    "How would I send money back to my bank?",
    "After the position closes, the intended experience is to let you send eligible proceeds back to your bank through appropriate payment partners. Availability, fees, timing, and supported countries have not yet been established.",
  ],
];
export default function FAQ() {
  return (
    <section id="faq" className="section container faq-section">
      <div>
        <div className="eyebrow">A FEW THINGS, MADE CLEAR.</div>
        <h2>
          Good questions.
          <br />
          Straight answers.
        </h2>
        <p>Less mystery. More understanding.</p>
      </div>
      <div className="faq-list">
        {questions.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <span className="faq-plus" aria-hidden="true" />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
