import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/toast';
import { AuthScreen } from '@/routes/AuthScreen';
import { Join } from '@/routes/Join';
import { Onboarding } from '@/routes/Onboarding';
import { Account } from '@/routes/Account';
import { WeddingLayout } from '@/routes/WeddingLayout';
import { Home, RequireSession } from '@/routes/Guards';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthScreen />} />
            <Route path="/join" element={<Join />} />
            <Route path="/onboarding" element={<RequireSession><Onboarding /></RequireSession>} />
            <Route path="/account" element={<RequireSession><Account /></RequireSession>} />
            <Route path="/w/:weddingId/*" element={<RequireSession><WeddingLayout /></RequireSession>} />
            <Route path="/" element={<Home />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
    <Analytics />
  </StrictMode>,
);
