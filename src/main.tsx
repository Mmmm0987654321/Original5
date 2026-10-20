import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './lib/appKitConfig.ts';
import { WebSocketProvider } from './providers/WebSocketProvider.tsx';
import App from './App.tsx';
import ErrorBoundary from './components/common/ErrorBoundary.tsx';
import { LanguageProvider } from './lib/LanguageContext.tsx';
import { TrustShieldProvider } from './lib/TrustShieldManager.tsx';
import './index.css';
import { applyPreferencesToDOM, THEME_PROFILES } from './components/trading/TradingPreferencesModal.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Apply the real saved palette before React's first render. The App effects
// still synchronize later changes; they must never be responsible for the
// first visible paint (which previously flashed the legacy green palette).
if (typeof window !== 'undefined') {
  let themeId = 'mono-dark';
  let fontSize = 100;
  let headersFont = 'Inter';
  let numbersFont = 'JetBrains Mono';
  try {
    const saved = localStorage.getItem('pref_theme_id');
    // Migrate the old first-run Cosmic Slate default ONCE to Mono Black.
    // Do not overwrite any other saved theme chosen by a returning user.
    const migrationKey = 'hidedex_legacy_green_theme_migrated_v1';
    const needsMigration = localStorage.getItem(migrationKey) !== '1';
    if (needsMigration && saved === 'cosmic-slate') {
      themeId = 'mono-dark';
      localStorage.setItem('pref_theme_id', themeId);
    } else if (saved && THEME_PROFILES.some(profile => profile.id === saved)) {
      themeId = saved;
    } else {
      // Unknown legacy IDs must not fall back to the old green default.
      localStorage.setItem('pref_theme_id', themeId);
    }
    localStorage.setItem(migrationKey, '1');
    localStorage.setItem('anon_theme',
      themeId === 'light' || themeId === 'mono-light' ? 'light' : 'dark');

    const savedPercent = localStorage.getItem('pref_font_size_percent');
    const legacySize = localStorage.getItem('pref_font_size');
    const parsedSize = savedPercent
      ? parseInt(savedPercent, 10)
      : legacySize === 'small' ? 85 : legacySize === 'large' ? 115
      : legacySize === 'xlarge' ? 130 : 100;
    fontSize = Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 100;
    headersFont = localStorage.getItem('pref_headers_font') || headersFont;
    numbersFont = localStorage.getItem('pref_numbers_font') || numbersFont;
  } catch {
    // Storage may be unavailable in restricted browsers; default to Mono Black.
  }
  applyPreferencesToDOM(themeId, fontSize, headersFont, numbersFont);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>
            <LanguageProvider>
              <TrustShieldProvider>
                <App />
              </TrustShieldProvider>
            </LanguageProvider>
          </WebSocketProvider>
        </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
