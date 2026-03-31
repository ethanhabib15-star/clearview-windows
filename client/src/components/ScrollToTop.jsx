import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll when the path changes (not hash-only), so each page starts at the top.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
