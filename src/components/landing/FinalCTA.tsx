import Button from "../ui/Button";
export default function FinalCTA() {
  return (
    <section className="final-cta container">
      <div className="eyebrow">
        <span className="status-dot" /> ENTER WITH A PLAN. LEAVE WITH A PURPOSE.
      </div>
      <h2>
        Trading doesn’t need
        <br />
        to feel complicated.
      </h2>
      <Button href="/app">Get Started</Button>
      <p>Start with the preview. See a simpler way to trade.</p>
    </section>
  );
}
