/** US ABA routing number: 9 digits with checksum (mod 10). */
export function isValidUsRoutingNumber(routing) {
  const s = String(routing ?? "").replace(/\s/g, "");
  if (!/^\d{9}$/.test(s)) return false;
  const d = s.split("").map(Number);
  const checksum =
    3 * (d[0] + d[3] + d[6]) +
    7 * (d[1] + d[4] + d[7]) +
    1 * (d[2] + d[5] + d[8]);
  return checksum % 10 === 0;
}

/** Typical US account numbers: digits only, reasonable length. */
export function isValidAccountNumber(account) {
  const s = String(account ?? "").replace(/\s/g, "");
  if (!/^\d+$/.test(s)) return false;
  return s.length >= 4 && s.length <= 17;
}

export function sanitizePayoutPayload(body) {
  const accountHolderName = String(body?.accountHolderName ?? "")
    .trim()
    .slice(0, 200);
  const bankName = String(body?.bankName ?? "").trim().slice(0, 200);
  const routingNumber = String(body?.routingNumber ?? "").replace(/\s/g, "");
  const accountNumber = String(body?.accountNumber ?? "").replace(/\s/g, "");
  return { accountHolderName, bankName, routingNumber, accountNumber };
}
