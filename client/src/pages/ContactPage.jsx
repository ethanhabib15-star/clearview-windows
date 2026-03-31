import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconAndroid,
  IconBuilding,
  IconCheck,
  IconIos,
  IconMail,
  IconPhone,
  IconSend,
  IconSparkles,
  IconUserCheck,
  IconWindow,
} from "../components/Icons.jsx";
import { usePublicContacts } from "../hooks/usePublicContacts.js";
import { mailHref, telHref } from "../utils/contactLinks.js";
import "../App.css";
import "./ContactPage.css";

const NAV_LINKS = [
  { to: "/#services", label: "Services" },
  { to: "/#area", label: "Service area" },
  { to: "/#gallery", label: "Gallery" },
  { to: "/#commercial", label: "Commercial" },
  { to: "/#residential", label: "Residential" },
  { to: "/#about", label: "About" },
];

const SUBJECT_OPTIONS = [
  { value: "general", label: "General inquiry" },
  { value: "quote", label: "Request a quote" },
  { value: "support", label: "Technical / support" },
  { value: "partnership", label: "Partnership / commercial" },
  { value: "feedback", label: "Feedback" },
];

function SectionRule({ children }) {
  return (
    <h2 className="section-rule">
      <span className="section-rule-line" aria-hidden />
      <span className="section-rule-label">{children}</span>
      <span className="section-rule-line" aria-hidden />
    </h2>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header className="site-header">
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
        <nav className={`nav${menuOpen ? " is-open" : ""}`} aria-label="Main">
          {NAV_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} onClick={closeMenu}>
              {label}
            </Link>
          ))}
          <Link to="/contact" onClick={closeMenu} aria-current="page">
            Contact
          </Link>
          <Link to="/payments" onClick={closeMenu}>
            Pay online
          </Link>
          <Link to="/contact" className="nav-cta" onClick={closeMenu}>
            <IconSparkles size={18} className="nav-cta-icon" aria-hidden />
            Request a quote
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p className="footer-mega" aria-hidden>
          ClearView
        </p>
        <div className="footer-brand-row">
          <span className="footer-icon" aria-hidden>
            <IconWindow size={22} />
          </span>
          <p className="footer-brand">
            Ryzhkov <span className="accent">ClearView Windows</span>
          </p>
        </div>
        <p className="footer-meta">
          Tulsa · Broken Arrow · Coweta · Northeast Oklahoma · © {year}
        </p>
        <p className="footer-area">
          Commercial & residential window installation across Green Country
        </p>
        <p className="footer-links">
          <Link to="/contact">Contact</Link>
          {" · "}
          <Link to="/">Home</Link>
          {" · "}
          <Link to="/payments">Pay online</Link>
        </p>
        <p className="footer-symbols" aria-hidden>
          <span className="symbol-dot" />
          <span className="symbol-dot" />
          <span className="symbol-dot" />
        </p>
      </div>
    </footer>
  );
}

function IconMapPin({ size, className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function ContactPage() {
  const { contacts, loading, error } = usePublicContacts();
  const vcardUrl = "/api/contacts/vcard";

  return (
    <>
      <SiteHeader />
      <main>
        <section className="contact-page-hero">
          <div className="container">
            <SectionRule>Contact</SectionRule>
            <h1>Reach ClearView Windows</h1>
            <p>
              Call, email, or send a message—we respond to Tulsa metro and
              northeast Oklahoma inquiries as soon as we can.
            </p>
          </div>
        </section>

        <div className="container contact-page-grid">
          <aside className="contact-info-card" aria-label="Business contact">
            <h2>Business details</h2>
            <p className="contact-info-name">
              {loading ? "…" : contacts.businessName}
            </p>

            {error ? (
              <p className="contact-page-banner contact-page-banner--info" role="status">
                {error}
              </p>
            ) : null}

            <div className="contact-detail">
              <span className="contact-detail-icon">
                <IconPhone size={22} />
              </span>
              <div className="contact-detail-body">
                <strong>Phone</strong>
                <a href={telHref(contacts.phone)}>{contacts.phone || "—"}</a>
              </div>
            </div>

            {contacts.alternatePhone ? (
              <div className="contact-detail">
                <span className="contact-detail-icon">
                  <IconPhone size={22} />
                </span>
                <div className="contact-detail-body">
                  <strong>Alternate phone</strong>
                  <a href={telHref(contacts.alternatePhone)}>
                    {contacts.alternatePhone}
                  </a>
                </div>
              </div>
            ) : null}

            <div className="contact-detail">
              <span className="contact-detail-icon">
                <IconMail size={22} />
              </span>
              <div className="contact-detail-body">
                <strong>Email</strong>
                <a href={mailHref(contacts.email)}>{contacts.email || "—"}</a>
              </div>
            </div>

            {contacts.address ? (
              <div className="contact-detail">
                <span className="contact-detail-icon">
                  <IconMapPin size={22} />
                </span>
                <div className="contact-detail-body">
                  <strong>Address</strong>
                  <p className="contact-address">{contacts.address}</p>
                </div>
              </div>
            ) : null}

            <div className="contact-save-row">
              <h3>Save our contact</h3>
              <p className="contact-save-hint">
                One tap opens your contacts app—no typing. Both buttons download
                the same vCard; pick the label that matches your phone.
              </p>
              <div className="contact-save-buttons">
                <a
                  className="btn-save-contact btn-save-contact--ios"
                  href={vcardUrl}
                  download
                  rel="noopener"
                >
                  <IconIos size={22} className="save-icon" aria-hidden />
                  Save to iPhone
                </a>
                <a
                  className="btn-save-contact btn-save-contact--android"
                  href={vcardUrl}
                  download
                  rel="noopener"
                >
                  <IconAndroid size={22} className="save-icon" aria-hidden />
                  Save to Android
                </a>
              </div>
            </div>
          </aside>

          <div className="contact-form-panel">
            <h2>Send a message</h2>
            <ContactPageForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ContactPageForm() {
  const [subject, setSubject] = useState("general");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    setIsSubmitting(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      subject: String(fd.get("subject") || "general"),
      message: String(fd.get("message") || "").trim(),
      website: String(fd.get("website") || ""),
      serviceType: String(fd.get("serviceType") || ""),
      projectDetails: String(fd.get("projectDetails") || "").trim(),
      budgetRange: String(fd.get("budgetRange") || "").trim(),
    };
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 429) {
        throw new Error(data.error || "Too many requests. Try again later.");
      }
      if (!r.ok) {
        throw new Error(data.error || "Could not send message.");
      }
      setSubmitted(true);
      form.reset();
      setSubject("general");
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Could not send. Ensure the API is running."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const showQuoteExtras = subject === "quote";

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label className="contact-form-hp" aria-hidden="true">
        <span>Company website</span>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {submitError ? (
        <p className="form-error full" role="alert">
          {submitError}
        </p>
      ) : null}

      <label>
        <span className="label-row">
          <IconUserCheck size={16} className="label-icon" aria-hidden />
          Full name
        </span>
        <input type="text" name="name" required autoComplete="name" />
      </label>
      <label>
        <span className="label-row">
          <IconMail size={16} className="label-icon" aria-hidden />
          Email
        </span>
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <label>
        <span className="label-row">
          <IconPhone size={16} className="label-icon" aria-hidden />
          Phone <span className="form-optional">(optional)</span>
        </span>
        <input type="tel" name="phone" autoComplete="tel" />
      </label>
      <label>
        <span className="label-row">
          <IconBuilding size={16} className="label-icon" aria-hidden />
          Subject
        </span>
        <select
          name="subject"
          value={subject}
          onChange={(ev) => setSubject(ev.target.value)}
          required
        >
          {SUBJECT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {showQuoteExtras ? (
        <div className="quote-extra">
          <label>
            <span className="label-row">Service type</span>
            <select name="serviceType" defaultValue="">
              <option value="">Select…</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="repair">Repair / service</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="full">
            <span className="label-row">Project details</span>
            <textarea
              name="projectDetails"
              rows={3}
              placeholder="Timeline, location, scope, window count…"
            />
          </label>
          <label>
            <span className="label-row">
              Budget range <span className="form-optional">(optional)</span>
            </span>
            <input
              type="text"
              name="budgetRange"
              placeholder="e.g. $5k–$15k"
              maxLength={120}
            />
          </label>
        </div>
      ) : null}

      <label className="full">
        <span className="label-row">Message</span>
        <textarea
          name="message"
          rows={5}
          required
          placeholder="How can we help?"
        />
      </label>

      <div className="contact-page-actions">
        <button
          type="submit"
          className="btn btn-primary btn-with-icon"
          disabled={submitted || isSubmitting}
        >
          {submitted ? (
            <>
              <IconCheck size={20} aria-hidden />
              Message sent
            </>
          ) : isSubmitting ? (
            <>Sending…</>
          ) : (
            <>
              <IconSend size={20} aria-hidden />
              Send message
            </>
          )}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-with-icon"
          onClick={() => {
            setSubject("quote");
            requestAnimationFrame(() => {
              document.querySelector(".quote-extra select")?.focus();
            });
          }}
        >
          <IconSparkles size={18} aria-hidden />
          Request a quote
        </button>
      </div>

      <p className="form-note">
        Submissions are stored securely and appear in the{" "}
        <a href="/admin/">admin Messages</a> inbox.
      </p>
    </form>
  );
}
