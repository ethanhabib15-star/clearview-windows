import { useEffect, useState } from "react";
import { FALLBACK_CONTACTS } from "../defaultContacts.js";

/**
 * @returns {{ contacts: typeof FALLBACK_CONTACTS, loading: boolean, error: string }}
 */
export function usePublicContacts() {
  const [contacts, setContacts] = useState(FALLBACK_CONTACTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/contacts")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load contact info.");
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data || typeof data !== "object") return;
        setContacts({
          businessName: String(data.businessName ?? FALLBACK_CONTACTS.businessName),
          phone: String(data.phone ?? FALLBACK_CONTACTS.phone),
          alternatePhone: String(data.alternatePhone ?? ""),
          email: String(data.email ?? FALLBACK_CONTACTS.email),
          address: String(data.address ?? FALLBACK_CONTACTS.address),
          updatedAt: String(data.updatedAt ?? ""),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Using default contact info until the server is available.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { contacts, loading, error };
}
