"use client";

import { useEffect } from "react";

/** Open disclosures before scrolling and give keyboard users an anchor destination. */
export default function AnchorNavigation() {
  useEffect(() => {
    const prepareTarget = (hash: string) => {
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return null;
      }
      const target = document.getElementById(id);
      if (!target) return null;
      if (target instanceof HTMLDetailsElement) target.open = true;
      const focusTarget =
        target instanceof HTMLDetailsElement
          ? target.querySelector("summary")
          : target;
      if (focusTarget instanceof HTMLElement) {
        if (
          !focusTarget.hasAttribute("tabindex") &&
          focusTarget.tagName !== "SUMMARY"
        ) {
          focusTarget.tabIndex = -1;
        }
        focusTarget.focus({ preventScroll: true });
      }
      return target;
    };
    const followHash = () => {
      const target = prepareTarget(window.location.hash);
      target?.scrollIntoView({ block: "start" });
    };
    const followLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== window.location.pathname ||
        destination.search !== window.location.search ||
        !destination.hash
      )
        return;
      // Runs before the browser's native anchor scroll, including repeated hash clicks.
      prepareTarget(destination.hash);
    };
    if (window.location.hash) followHash();
    document.addEventListener("click", followLink);
    window.addEventListener("hashchange", followHash);
    return () => {
      document.removeEventListener("click", followLink);
      window.removeEventListener("hashchange", followHash);
    };
  }, []);
  return null;
}
