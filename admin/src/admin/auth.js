export const ADMIN_STORAGE_KEY = "ryzhkov_clearview_admin_key";

export function adminAuthHeaders(k) {
  return {
    Authorization: `Bearer ${k}`,
    "X-Admin-Key": k,
  };
}

export function getStoredAdminKey() {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(ADMIN_STORAGE_KEY)?.trim() ?? "";
}

export function setStoredAdminKey(k) {
  sessionStorage.setItem(ADMIN_STORAGE_KEY, k);
}

export function clearStoredAdminKey() {
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
}
