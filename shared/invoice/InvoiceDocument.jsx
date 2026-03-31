import "./InvoiceTemplate.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function computeInvoiceTotals(inv) {
  if (!inv?.lineItems?.length) return { subtotal: 0, tax: 0, total: 0 };
  const subtotal = inv.lineItems.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0),
    0
  );
  const tax = (subtotal * (Number(inv.taxPercent) || 0)) / 100;
  return { subtotal, tax, total: subtotal + tax };
}

function formatInvoiceDateLong(iso) {
  if (!iso || String(iso).length < 8) return "—";
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).toUpperCase();
  return d
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

const TPL_MIN_ROWS = 5;

function formatInvoiceStatus(inv) {
  if (inv?.paymentStatus === "paid") return "PAID";
  if (inv?.paymentStatus === "pending") return "PENDING";
  return "UNPAID";
}

/**
 * Single source for invoice layout — used in admin preview and client payment page.
 */
export default function InvoiceDocument({ invoice }) {
  if (!invoice) return null;
  const { subtotal, tax, total } = computeInvoiceTotals(invoice);
  const lines = invoice.lineItems ?? [];
  const padRows = Math.max(0, TPL_MIN_ROWS - lines.length);
  const companyName = invoice.fromName || "Ryzhkov ClearView Windows";
  const payLines = [
    invoice.paymentBank,
    invoice.paymentAccount,
    invoice.paymentPhone,
  ].filter(Boolean);
  const payBlock =
    payLines.length > 0
      ? payLines.join("\n")
      : "Add payment details in the editor (bank, account, phone).";

  return (
    <div className="invoice-doc invoice-doc--template">
      <header className="invoice-tpl-hero">
        <div className="invoice-tpl-hero-left">
          <h1 className="invoice-tpl-title">INVOICE</h1>
          <div className="invoice-tpl-meta invoice-tpl-mono">
            <div>INVOICE NUMBER: #{invoice.number || "—"}</div>
            <div>DATE: {formatInvoiceDateLong(invoice.issueDate)}</div>
            <div>
              DUE DATE:{" "}
              {invoice.dueDate
                ? formatInvoiceDateLong(invoice.dueDate)
                : "—"}
            </div>
            <div>STATUS: {formatInvoiceStatus(invoice)}</div>
          </div>
        </div>
        <div className="invoice-tpl-hero-right">
          <div className="invoice-tpl-company">{companyName.toUpperCase()}</div>
          <div className="invoice-tpl-company-detail invoice-tpl-mono">
            {(invoice.fromAddress || "Tulsa metro · Northeast Oklahoma")
              .split("\n")
              .join(" · ")}
          </div>
          <div className="invoice-tpl-company-detail invoice-tpl-mono">
            {invoice.fromPhone || "(918) 555-0100"}
          </div>
          {invoice.fromEmail ? (
            <div className="invoice-tpl-company-detail invoice-tpl-mono">
              {invoice.fromEmail}
            </div>
          ) : null}
        </div>
      </header>

      <div className="invoice-tpl-bill-grid">
        <div className="invoice-tpl-bill-col">
          <h3 className="invoice-tpl-section-label">Bill To:</h3>
          <div className="invoice-tpl-mono invoice-tpl-bill-body">
            {[
              invoice.clientName || "Client name",
              invoice.clientAddress,
              invoice.clientEmail,
            ]
              .filter(Boolean)
              .join("\n") || "—"}
          </div>
        </div>
        <div className="invoice-tpl-bill-col">
          <h3 className="invoice-tpl-section-label">Payment Method</h3>
          <div className="invoice-tpl-mono invoice-tpl-bill-body">{payBlock}</div>
        </div>
      </div>

      <table className="invoice-tpl-table">
        <thead>
          <tr>
            <th>DESCRIPTION</th>
            <th>QTY</th>
            <th>PRICE</th>
            <th>SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((row) => {
            const qty = Number(row.quantity) || 0;
            const rate = Number(row.rate) || 0;
            const line = qty * rate;
            return (
              <tr key={row.id}>
                <td>{row.description || "—"}</td>
                <td className="invoice-tpl-qty">{qty}</td>
                <td className="invoice-tpl-num">{money.format(rate)}</td>
                <td className="invoice-tpl-num">{money.format(line)}</td>
              </tr>
            );
          })}
          {Array.from({ length: padRows }, (_, i) => (
            <tr key={`pad-${i}`} className="invoice-tpl-row-empty">
              <td colSpan={4} aria-hidden />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="invoice-tpl-tfoot-spacer">
            <td colSpan={4} />
          </tr>
          <tr className="invoice-tpl-tfoot-row">
            <td colSpan={2} />
            <td className="invoice-tpl-tfoot-label invoice-tpl-mono">SUBTOTAL</td>
            <td className="invoice-tpl-num invoice-tpl-mono">
              {money.format(subtotal)}
            </td>
          </tr>
          <tr className="invoice-tpl-tfoot-row">
            <td colSpan={2} />
            <td className="invoice-tpl-tfoot-label invoice-tpl-mono">
              TAX ({Number(invoice.taxPercent) || 0}%)
            </td>
            <td className="invoice-tpl-num invoice-tpl-mono">{money.format(tax)}</td>
          </tr>
          <tr className="invoice-tpl-tfoot-row invoice-tpl-grand">
            <td colSpan={2} />
            <td className="invoice-tpl-tfoot-label invoice-tpl-mono">GRAND TOTAL</td>
            <td className="invoice-tpl-num invoice-tpl-mono">{money.format(total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="invoice-tpl-footer-grid">
        <div className="invoice-tpl-terms">
          <h4 className="invoice-tpl-section-label">Term &amp; Condition</h4>
          <p className="invoice-tpl-mono invoice-tpl-terms-text">
            {invoice.notes?.trim() ||
              "Payment is due by the due date shown above. Please include the invoice number with your payment. Thank you for your business."}
          </p>
        </div>
        <div className="invoice-tpl-contact">
          <p className="invoice-tpl-mono invoice-tpl-contact-line">
            FOR ANY QUESTIONS, PLEASE CONTACT{" "}
            {invoice.fromEmail || "HELLO@EXAMPLE.COM"} OR{" "}
            {invoice.fromPhone || "+1-918-555-0100"}.
          </p>
          <p className="invoice-tpl-signatory">{companyName}</p>
        </div>
        <div className="invoice-tpl-signature">
          {invoice.signatureDataUrl ? (
            <img
              src={invoice.signatureDataUrl}
              alt="Electronic signature"
              className="invoice-tpl-signature-img"
            />
          ) : (
            <div className="invoice-tpl-signature-line" />
          )}
          {invoice.signedAt ? (
            <p className="invoice-tpl-signed-meta invoice-tpl-mono">
              Signed electronically ·{" "}
              {new Date(invoice.signedAt).toLocaleString()}
            </p>
          ) : (
            <p className="invoice-tpl-signed-meta invoice-tpl-mono muted">
              Authorized signature
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
