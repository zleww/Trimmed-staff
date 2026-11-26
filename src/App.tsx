import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import { BranchesPage } from './pages/BranchesPage'
import { ClosePage } from './pages/ClosePage'
import { ChairPage } from './pages/ChairPage'
import { ContactInbox } from './pages/ContactInbox'
import { DashboardPage } from './pages/DashboardPage'
import { EarningsPage } from './pages/EarningsPage'
import { InventoryPage } from './pages/InventoryPage'
import { RequestsPage } from './pages/RequestsPage'
import { SecurityPage } from './pages/SecurityPage'
import { StaffPage } from './pages/StaffPage'
import { TodayPage } from './pages/TodayPage'
import { SignInPage } from './SignInPage'
import { BarberOnly, DeskOnly, OwnerOnly, StaffHome, StaffLayout } from './StaffLayout'

// Staff app routes. StaffLayout checks the role; the database checks again on every call.
export default function App() {
  return (
    <AuthProvider profileTheme={false}>
      <BrowserRouter>
        <Routes>
          <Route path="signin" element={<SignInPage />} />
          <Route element={<StaffLayout />}>
            <Route index element={<StaffHome owner={<DashboardPage />} />} />
            <Route path="today" element={<DeskOnly page={<TodayPage />} />} />
            <Route path="requests" element={<DeskOnly page={<RequestsPage />} />} />
            <Route path="close" element={<DeskOnly page={<ClosePage />} />} />
            <Route path="messages" element={<DeskOnly page={<ContactInbox />} />} />
            {/* barber pages */}
            <Route path="chair" element={<BarberOnly page={<ChairPage />} />} />
            <Route path="earnings" element={<BarberOnly page={<EarningsPage />} />} />
            <Route path="security" element={<SecurityPage />} />
            {/* owner pages: the database refuses everyone else anyway */}
            <Route path="branches" element={<OwnerOnly page={<BranchesPage />} />} />
            <Route path="staff" element={<OwnerOnly page={<StaffPage />} />} />
            <Route path="inventory" element={<OwnerOnly page={<InventoryPage />} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
