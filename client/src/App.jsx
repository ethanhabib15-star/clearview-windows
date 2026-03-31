import { BrowserRouter, Route, Routes } from "react-router-dom";
import PageTransitionLayout from "./components/PageTransitionLayout.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<PageTransitionLayout />}>
          <Route index element={<HomePage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/success" element={<PaymentSuccessPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
