export const ADMIN_STORAGE_KEY = "ryzhkov_clearview_admin_access_token";

export function adminAuthHeaders(token) {
  const t = String(token || "").trim();
  if (!t) return {};
  return {
    Authorization: `Bearer ${t}`,
  };
}

export function getStoredAdminKey() {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(ADMIN_STORAGE_KEY)?.trim() ?? "";
}

export function setStoredAdminKey(token) {
  sessionStorage.setItem(ADMIN_STORAGE_KEY, String(token || "").trim());
}

export function clearStoredAdminKey() {
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
}
