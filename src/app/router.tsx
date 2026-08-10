import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app-shell.tsx'
import { AuthGate } from '@/components/auth-gate.tsx'
import { EntryPage } from '@/pages/EntryPage.tsx'
import { HistoryPage } from '@/pages/HistoryPage.tsx'
import {
  ConnectedBudgetPage,
  ConnectedEnergyPage,
  ConnectedInvestmentPage,
  ConnectedSettingsPage,
  ConnectedSettlementPage,
} from '@/pages/connected-pages.tsx'

export function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AuthGate><AppShell /></AuthGate>}>
          <Route index element={<Navigate replace to="/entry" />} />
          <Route path="/entry" element={<EntryPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/budget" element={<ConnectedBudgetPage />} />
          <Route path="/settlement" element={<ConnectedSettlementPage />} />
          <Route path="/investment" element={<ConnectedInvestmentPage />} />
          <Route path="/energy" element={<ConnectedEnergyPage />} />
          <Route path="/settings" element={<ConnectedSettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
