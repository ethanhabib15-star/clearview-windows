import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { IconWindow } from "./Icons.jsx";

/**
 * Compact header/footer for /payments and /payments/success.
 * Includes mobile menu — matches HomePage behavior (global .nav rules).
 * @param {{ variant?: "pay" | "success" }} props
 */
export function PaySiteHeader({ variant = "pay" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const onPayPage = variant === "pay";

  return (
    <header className="site-header pay-site-header">
      <div className="container header-inner">
        <Link to="/" className="logo" onClick={closeMenu}>
          <span className="logo-mark" aria-hidden>
            <IconWindow size={24} className="logo-icon" />
          </span>
          <span className="logo-text">
            Ryzhkov <span className="logo-accent">ClearView</span>
          </span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav
          className={`nav pay-header-nav${menuOpen ? " is-open" : ""}`}
          aria-label="Payment site"
        >
          <Link to="/" onClick={closeMenu}>
            Home
          </Link>
          <Link to="/contact" onClick={closeMenu}>
            Contact
          </Link>
          <Link
            to="/payments"
            className={onPayPage ? "pay-nav-current" : undefined}
            onClick={closeMenu}
            {...(onPayPage ? { "aria-current": "page" } : {})}
          >
            Pay online
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PaySiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer pay-site-footer">
      <div className="container pay-footer-inner">
        <p className="pay-footer-line">
          <span className="pay-footer-copy">
            © {year} Ryzhkov ClearView Windows
          </span>
          <span className="pay-footer-sep" aria-hidden>
            ·
          </span>
          <Link to="/">Home</Link>
          <span className="pay-footer-sep" aria-hidden>
            ·
          </span>
          <Link to="/contact">Contact</Link>
          <span className="pay-footer-sep" aria-hidden>
            ·
          </span>
          <Link to="/payments">Pay online</Link>
        </p>
      </div>
    </footer>
  );
}
