import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminInvoicesPage from "./pages/AdminInvoicesPage.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import AdminMessagesPage from "./pages/AdminMessagesPage.jsx";

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="messages" replace />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="invoices" element={<AdminInvoicesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
