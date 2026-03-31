import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminContactsPage from "./pages/AdminContactsPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import AdminInvoicesPage from "./pages/AdminInvoicesPage.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import AdminMessagesPage from "./pages/AdminMessagesPage.jsx";
import AdminPaymentsPage from "./pages/AdminPaymentsPage.jsx";

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
          <Route path="invoices" element={<AdminInvoicesPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
