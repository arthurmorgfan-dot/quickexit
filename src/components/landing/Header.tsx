"use client";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import Brand from "../ui/Brand";
import Button from "../ui/Button";
const links = [
  ["Product", "product"],
  ["How it works", "how-it-works"],
  ["Security", "security"],
  ["FAQ", "faq"],
];
export default function Header() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return (
    <header className="header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map(([label, id]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="signin" href="#availability">
            Sign in <span className="sr-only">availability information</span>
          </a>
          <Button>Get Started</Button>
        </div>
        <button
          className="menu-button"
          ref={menuButton}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          className="mobile-nav container"
          aria-label="Mobile navigation"
        >
          {links.map(([label, id]) => (
            <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <a href="#availability" onClick={() => setOpen(false)}>
            Sign in availability
          </a>
          <a
            className="mobile-start"
            href="#product"
            onClick={() => setOpen(false)}
          >
            Get Started ↗
          </a>
        </nav>
      )}
    </header>
  );
}
