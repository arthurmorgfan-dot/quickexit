"use client";
import { useEffect } from "react";
import Brand from "../ui/Brand";
export default function Footer() {
  useEffect(() => {
    const openLinkedNotice = () => {
      const notice = document.getElementById(window.location.hash.slice(1));
      if (notice instanceof HTMLDetailsElement) notice.open = true;
    };
    openLinkedNotice();
    window.addEventListener("hashchange", openLinkedNotice);
    return () => window.removeEventListener("hashchange", openLinkedNotice);
  }, []);
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
            QuickExit is not open for account registration or sign-in. Explore
            the interactive product preview above; no authentication, deposits,
            trades, or withdrawals are available.
          </p>
        </details>
        <details id="privacy">
          <summary>Prototype privacy notice</summary>
          <p>
            This prototype has no account forms or analytics added by QuickExit.
            Preview selections stay in your browser memory and reset on reload.
            No trade or payment information is submitted. Hosting providers may
            process standard request logs. A full privacy policy will be
            provided before a live service launches.
          </p>
        </details>
        <details id="terms">
          <summary>Prototype terms</summary>
          <p>
            This interface is for product demonstration only. It does not offer
            financial advice or an operational trading service. All prices and
            profits shown are mock data. There is no guarantee of future
            availability or returns. Live services would require separate terms
            and disclosures.
          </p>
        </details>
      </div>
    </footer>
  );
}
