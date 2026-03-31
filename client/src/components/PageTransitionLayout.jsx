import { Outlet, useLocation } from "react-router-dom";

/**
 * Route wrapper: remounts on pathname change so CSS can run a short enter animation
 * (no extra dependencies — avoids missing framer-motion installs).
 */
export default function PageTransitionLayout() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-transition-root">
      <Outlet />
    </div>
  );
}
