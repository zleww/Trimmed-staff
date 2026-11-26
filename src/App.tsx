import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import { ContactInbox } from './pages/ContactInbox'
import { DashboardPage } from './pages/DashboardPage'
import { RequestsPage } from './pages/RequestsPage'
import { SignInPage } from './SignInPage'
import { StaffHome, StaffLayout } from './StaffLayout'

// Staff app routes. StaffLayout checks the role; the database checks again on every call.
export default function App() {
  return (
    <AuthProvider profileTheme={false}>
      <BrowserRouter>
        <Routes>
          <Route path="signin" element={<SignInPage />} />
          <Route element={<StaffLayout />}>
            <Route index element={<StaffHome owner={<DashboardPage />} />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="messages" element={<ContactInbox />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
