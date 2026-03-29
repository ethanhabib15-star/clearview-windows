import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconHome,
  IconLayers,
  IconMail,
  IconPhone,
  IconRuler,
  IconSend,
  IconShield,
  IconSparkles,
  IconStore,
  IconUserCheck,
  IconWindow,
  IconZap,
} from "../components/Icons.jsx";
import { siteImages } from "../siteImages.js";
import "../App.css";

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#area", label: "Service area" },
  { href: "#gallery", label: "Gallery" },
  { href: "#commercial", label: "Commercial" },
  { href: "#residential", label: "Residential" },
  { href: "#about", label: "About" },
];

const SERVICES = [
  { Icon: IconLayers, label: "New construction" },
  { Icon: IconWindow, label: "Replacement windows" },
  { Icon: IconZap, label: "Energy-efficient upgrades" },
  { Icon: IconRuler, label: "Custom sizes & shapes" },
  { Icon: IconStore, label: "Commercial storefront" },
];

const COMMERCIAL_POINTS = [
  "Storefront & curtain wall coordination",
  "Bulk projects & phased rollouts",
  "Code-compliant egress & safety glass",
  "Minimal disruption to tenants & customers",
  "Tulsa metro timelines—we know local AHJs and weather windows",
];

const RESIDENTIAL_POINTS = [
  "Single & double-hung, casement, sliders",
  "Bay, bow, and picture windows",
  "Low-E & noise-reducing options",
  "Warranty-friendly installation",
  "Installs tuned for Oklahoma wind, hail season, and summer heat",
];

const ABOUT = [
  {
    Icon: IconRuler,
    title: "Exact fits",
    text: "Careful measuring and ordering reduce callbacks and air gaps that cost you on heating and cooling.",
  },
  {
    Icon: IconCalendar,
    title: "Clear timelines",
    text: "You get a written scope and schedule—no mystery dates or surprise add-ons.",
  },
  {
    Icon: IconShield,
    title: "Respect for your space",
    text: "We treat Tulsa-area job sites like our own: covered walks, daily cleanup, and crews who know Broken Arrow, Coweta, and Green Country neighborhoods.",
  },
];

function CheckList({ items }) {
  return (
    <ul className="check-list">
      {items.map((text) => (
        <li key={text}>
          <span className="check-list-icon" aria-hidden>
            <IconCheck size={20} className="icon-accent" />
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionRule({ children }) {
  return (
    <h2 className="section-rule">
      <span className="section-rule-line" aria-hidden />
      <span className="section-rule-label">{children}</span>
      <span className="section-rule-line" aria-hidden />
    </h2>
  );
}

function Header() {
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
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} onClick={closeMenu}>
              {label}
            </a>
          ))}
          <a href="#contact" className="nav-cta" onClick={closeMenu}>
            <IconSparkles size={18} className="nav-cta-icon" aria-hidden />
            Get a quote
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
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
        <p className="footer-symbols" aria-hidden>
          <span className="symbol-dot" />
          <span className="symbol-dot" />
          <span className="symbol-dot" />
        </p>
      </div>
    </footer>
  );
}

function ContactForm() {
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
      type: String(fd.get("type") || ""),
      message: String(fd.get("message") || "").trim(),
    };
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data.error || "Could not send message.");
      }
      setSubmitted(true);
      form.reset();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Could not send. Start the app with npm run dev (API + Vite)."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      {submitError ? (
        <p className="form-error full" role="alert">
          {submitError}
        </p>
      ) : null}
      <label>
        <span className="label-row">
          <IconUserCheck size={16} className="label-icon" aria-hidden />
          Name
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
          Phone
        </span>
        <input type="tel" name="phone" autoComplete="tel" />
      </label>
      <label>
        <span className="label-row">
          <IconBuilding size={16} className="label-icon" aria-hidden />
          Project type
        </span>
        <select name="type" defaultValue="">
          <option value="">Select…</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="both">Both / unsure</option>
        </select>
      </label>
      <label className="full">
        <span className="label-row">Message</span>
        <textarea
          name="message"
          rows={4}
          placeholder="Neighborhood (Tulsa, Broken Arrow, Coweta…), window count, timeline…"
        />
      </label>
      <button
        type="submit"
        className="btn btn-primary btn-with-icon"
        disabled={submitted || isSubmitting}
      >
        {submitted ? (
          <>
            <IconCheck size={20} aria-hidden />
            Message received
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
      <p className="form-note">
        Submissions are saved for your team. View them in the{" "}
        <Link to="/admin">admin dashboard</Link> (protected).
      </p>
    </form>
  );
}

function SplitPanelImage({ image, label }) {
  return (
    <figure className="split-panel">
      <img
        className="split-panel-img"
        src={image.src}
        alt={image.alt}
        width={640}
        height={480}
        loading="lazy"
      />
      <figcaption className="split-panel-caption">
        <span className="panel-label">{label}</span>
      </figcaption>
    </figure>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-bg" aria-hidden />
          <div className="container hero-stack">
            <p className="hero-kicker">
              <IconShield size={14} className="hero-kicker-icon" aria-hidden />
              Licensed · Insured · Tulsa metro &amp; Green Country
            </p>
            <h1 className="hero-mega">
              <span className="hero-mega-line">ClearView</span>
              <span className="hero-mega-line hero-mega-line--dim">Windows</span>
            </h1>
            <figure className="hero-figure hero-figure--center">
              <img
                className="hero-img"
                src={siteImages.hero.src}
                alt={siteImages.hero.alt}
                width={720}
                height={540}
                fetchPriority="high"
              />
              <div className="hero-figure-badge" aria-hidden>
                <IconWindow size={22} />
              </div>
            </figure>
            <p className="hero-tagline-serif">
              Modern installs for storefronts, new builds, and homes across Green
              Country.
            </p>
            <p className="lead hero-lead">
              From Midtown and Brookside to Broken Arrow and Coweta—we measure,
              order, and install so your property looks sharp, seals tight, and
              handles Oklahoma weather.
            </p>
            <div className="hero-actions">
              <a href="#contact" className="btn btn-primary btn-with-icon">
                <IconSparkles size={18} aria-hidden />
                Request a free estimate
              </a>
              <a href="tel:+19185550100" className="btn btn-ghost btn-with-icon">
                <IconPhone size={18} aria-hidden />
                Call (918) 555-0100
              </a>
            </div>
          </div>
        </section>

        <section id="services" className="section services-intro">
          <div className="container">
            <SectionRule>What we do</SectionRule>
            <p className="section-lead">
              Full-service window installation for northeast Oklahoma: tear-out,
              flashing, insulation details, and finish trim—so you are not
              juggling multiple crews on your Tulsa-area project.
            </p>
            <ul className="service-grid">
              {SERVICES.map(({ Icon, label }) => (
                <li key={label} className="service-card">
                  <span className="service-icon-wrap" aria-hidden>
                    <Icon size={22} />
                  </span>
                  <span className="service-label">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="area" className="section service-area-band">
          <div className="container">
            <SectionRule>Where we work</SectionRule>
            <p className="section-lead service-area-lead">
              Based in Green Country and on the road every week across the Tulsa
              metro. If you are in or near these communities, we would love to
              quote your job.
            </p>
            <ul className="service-area-pills" aria-label="Primary service communities">
              <li>Tulsa</li>
              <li>Broken Arrow</li>
              <li>Coweta</li>
              <li>Bixby &amp; Jenks</li>
              <li>Owasso &amp; Claremore</li>
              <li>Surrounding northeast Oklahoma</li>
            </ul>
          </div>
        </section>

        <section id="gallery" className="section gallery-section">
          <div className="container">
            <SectionRule>Recent work</SectionRule>
            <p className="section-lead gallery-lead">
              A few installs around Tulsa and Broken Arrow—styles, sizes, and
              settings vary by project.
            </p>
            <div className="gallery-grid">
              {siteImages.gallery.map((item) => (
                <figure key={item.src} className="gallery-card">
                  <img
                    src={item.src}
                    alt={item.alt}
                    width={400}
                    height={280}
                    loading="lazy"
                  />
                  <figcaption className="gallery-caption">{item.alt}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="section statement-band">
          <div className="container">
            <h2 className="statement-serif">
              Every opening measured twice—so{" "}
              <span className="statement-em">your install</span> fits the first
              time, Oklahoma weather or not.
            </h2>
          </div>
        </section>

        <section id="commercial" className="section split commercial">
          <div className="container split-inner">
            <div className="split-copy">
              <div className="split-title-row">
                <span className="split-title-icon" aria-hidden>
                  <IconBuilding size={28} />
                </span>
                <h2>Commercial</h2>
              </div>
              <p>
                Offices downtown, retail along the Broken Arrow corridor,
                Coweta industrial parks, and multifamily across the metro—we work
                around your schedule, coordinate with your GC or property
                manager, and keep the site safe and tidy.
              </p>
              <CheckList items={COMMERCIAL_POINTS} />
            </div>
            <SplitPanelImage image={siteImages.commercial} label="Commercial" />
          </div>
        </section>

        <section id="residential" className="section split residential">
          <div className="container split-inner reverse">
            <div className="split-copy">
              <div className="split-title-row">
                <span className="split-title-icon" aria-hidden>
                  <IconHome size={28} />
                </span>
                <h2>Residential</h2>
              </div>
              <p>
                Whether you are in a historic Tulsa bungalow, a new Broken Arrow
                build, or a Coweta acreage, we protect floors and trim, haul away
                old units, and leave clean sightlines.
              </p>
              <CheckList items={RESIDENTIAL_POINTS} />
            </div>
            <SplitPanelImage image={siteImages.residential} label="Residential" />
          </div>
        </section>

        <section id="about" className="section about">
          <div className="container">
            <SectionRule>Why choose us</SectionRule>
            <p className="section-lead about-lead">
              Property owners across Tulsa County trust us for scope clarity,
              clean job sites, and installs built for local wind and heat.
            </p>
            <div className="grid-3">
              {ABOUT.map(({ Icon, title, text }) => (
                <article key={title} className="card">
                  <div className="card-icon" aria-hidden>
                    <Icon size={26} />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="section contact">
          <div className="container contact-inner">
            <div className="contact-copy">
              <SectionRule>Get a quote</SectionRule>
              <p>
                Tell us about your Tulsa, Broken Arrow, or Coweta project—we will
                follow up to schedule a site visit or review plans anywhere in
                northeast Oklahoma.
              </p>
              <div className="contact-block">
                <span className="contact-block-icon" aria-hidden>
                  <IconPhone size={22} />
                </span>
                <div>
                  <strong>Phone</strong>
                  <a href="tel:+19185550100">(918) 555-0100</a>
                </div>
              </div>
              <div className="contact-block">
                <span className="contact-block-icon" aria-hidden>
                  <IconMail size={22} />
                </span>
                <div>
                  <strong>Email</strong>
                  <a href="mailto:hello@ryzhkovclearviewwindows.com">
                    hello@ryzhkovclearviewwindows.com
                  </a>
                </div>
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
