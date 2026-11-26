import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import { BranchesPage } from './pages/BranchesPage'
import { ClosePage } from './pages/ClosePage'
import { ContactInbox } from './pages/ContactInbox'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { RequestsPage } from './pages/RequestsPage'
import { SecurityPage } from './pages/SecurityPage'
import { StaffPage } from './pages/StaffPage'
import { TodayPage } from './pages/TodayPage'
import { SignInPage } from './SignInPage'
import { OwnerOnly, StaffHome, StaffLayout } from './StaffLayout'

// Staff app routes. StaffLayout checks the role; the database checks again on every call.
export default function App() {
  return (
    <AuthProvider profileTheme={false}>
      <BrowserRouter>
        <Routes>
          <Route path="signin" element={<SignInPage />} />
          <Route element={<StaffLayout />}>
            <Route index element={<StaffHome owner={<DashboardPage />} />} />
            <Route path="today" element={<TodayPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="close" element={<ClosePage />} />
            <Route path="security" element={<SecurityPage />} />
            {/* owner pages: the database refuses everyone else anyway */}
            <Route path="branches" element={<OwnerOnly page={<BranchesPage />} />} />
            <Route path="staff" element={<OwnerOnly page={<StaffPage />} />} />
            <Route path="inventory" element={<OwnerOnly page={<InventoryPage />} />} />
            <Route path="messages" element={<ContactInbox />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
