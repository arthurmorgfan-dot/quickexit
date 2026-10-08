import Brand from "../ui/Brand";
export default function Footer() {
  return (
    <footer className="footer container">
      <div className="footer-top">
        <div>
          <Brand />
          <p>Trade it. Profit. Send it home.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#security">Security</a>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© 2026 QuickExit</span>
        <p>
          Product concept / prototype. Crypto involves financial risk. Capital
          is at risk; profits are not guaranteed.
        </p>
        <span className="footer-signoff">A clearer way out. ↗</span>
      </div>
      <div className="legal-notes">
        <details id="availability">
          <summary>Service availability</summary>
          <p>
            QuickExit offers a simulated paper-trading preview with a
            registration-free demo. Beta accounts can save paper state across
            devices when enabled. No real deposits, trading execution, or
            withdrawals are available.
          </p>
        </details>
        <details id="privacy">
          <summary>Prototype privacy notice</summary>
          <p>
            Optional beta accounts use Supabase for email/password
            authentication and account-scoped paper state. Passwords are handled
            by Supabase Auth. No analytics are added by QuickExit. Landing-page
            preview selections stay in browser memory and reset on reload.
            Workspace paper-trading data is saved on this device until you reset
            the demo or clear browser storage. Signed-in paper state is also
            saved in your account; account caches remain on the device after
            sign-out until browser storage is cleared. No real banking details,
            payment information, or exchange keys are collected. Hosting
            providers may process standard request logs. A full privacy policy
            will be provided before a live service launches.
          </p>
        </details>
        <details id="terms">
          <summary>Prototype terms</summary>
          <p>
            This interface is for product demonstration only. It does not offer
            financial advice or an operational trading service. All trading
            results and funds are simulated. The workspace may display read-only
            public market prices. There is no guarantee of future availability
            or returns. Live services would require separate terms and
            disclosures.
          </p>
        </details>
      </div>
    </footer>
  );
}
