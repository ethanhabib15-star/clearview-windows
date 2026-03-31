export function telHref(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  if (digits.length >= 10) return `tel:+${digits}`;
  return "#";
}

export function mailHref(email) {
  const e = String(email || "").trim();
  if (!e) return "#";
  return `mailto:${encodeURIComponent(e)}`;
}
