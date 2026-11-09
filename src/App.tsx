import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateToast } from './components/UpdateToast';
import { Dashboard } from './features/dashboard/Dashboard';
import { CareerProfilePage } from './features/career-profile/CareerProfile';
import { ResumeStudio } from './features/resume-studio/ResumeStudio';
import { PortfolioStudio } from './features/portfolio/PortfolioStudio';
import { WebsiteStudio } from './features/website/WebsiteStudio';
import { CoverLetterStudio } from './features/cover-letter/CoverLetterStudio';
import { AssetStudio } from './features/assets/AssetStudio';
import { useStore } from './state/store';

// PDF Studio pulls in pdf.js / pdf-lib — load it only when the route is visited.
const PdfStudio = lazy(() => import('./features/pdf-studio/PdfStudio').then((m) => ({ default: m.PdfStudio })));

export function App() {
  const { ready } = useStore();
  const location = useLocation();
  return (
    <AppShell>
      {!ready ? (
        <div className="content" style={{ paddingTop: 60, textAlign: 'center' }}>
          <p className="muted">Loading your workspace…</p>
        </div>
      ) : (
        // Key by path so an error on one screen clears when navigating away.
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<CareerProfilePage />} />
            <Route path="/resume/:id" element={<ResumeStudio />} />
            <Route path="/portfolio" element={<PortfolioStudio />} />
            <Route path="/website/:id" element={<WebsiteStudio />} />
            <Route path="/cover-letter/:id" element={<CoverLetterStudio />} />
            <Route path="/assets" element={<AssetStudio />} />
            <Route path="/pdf" element={<Suspense fallback={<div className="content" style={{ paddingTop: 60, textAlign: 'center' }}><p className="muted">Loading PDF Studio…</p></div>}><PdfStudio /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      )}
      <UpdateToast />
    </AppShell>
  );
}
