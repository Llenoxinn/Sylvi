import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/schibsted-grotesk';
import './styles/tokens.css';
import './styles/transitions.css';
import './styles/base.css';
import './styles/workspace.css';
import App from './App';

registerSW({ immediate: true });

// Render the first frame synchronously: arriving from the landing page, the
// view transition snapshots this page on its first paint, which the script
// holds back (blocking="render" in app/index.html) until the UI is there.
const root = createRoot(document.getElementById('root')!);
flushSync(() =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
);
