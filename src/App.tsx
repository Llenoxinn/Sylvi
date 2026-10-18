import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CircleCheck, CircleX, Download, History, ImagePlus, Info, LayoutGrid, Printer, Settings, X } from 'lucide-react';
import { onSession } from './lib/cloud';
import { imageFilesFrom } from './lib/image/load';
import { AccountButton } from './components/Account';
import { CropEditor } from './components/CropEditor';
import { Inspector } from './components/Inspector';
import { PackagePicker } from './components/PackagePicker';
import { PackagesPanel, type PackagesIntent } from './components/PackagesPanel';
import { RecentPanel } from './components/RecentPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SheetStage } from './components/SheetStage';
import { Logo } from './components/ui';
import TechText from './components/reactbits/TechText/TechText';
import Dock from './components/reactbits/Dock/Dock';
import { useStore } from './state/store';
import { useExport } from './state/useExport';

// Only needed after a job, so the physics library loads then.
const JobDone = lazy(() => import('./components/JobDone'));

const glyph = (Icon: typeof ImagePlus) => <Icon size="1em" strokeWidth={1.8} />;

export default function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [packagesIntent, setPackagesIntent] = useState<PackagesIntent>({ mode: 'list' });
  const panel = useStore(s => s.panel);
  const recentCount = useStore(s => s.recent.length);
  const doneJobId = useStore(s => s.doneJobId);
  const shopName = useStore(s => s.settings.shopName);
  const theme = useStore(s => s.settings.theme);
  const addPhotos = useStore(s => s.addPhotos);
  const openPanel = useStore(s => s.openPanel);
  const { download, print, canExport } = useExport();
  const compact = useSyncExternalStore(subscribeCompact, isCompact, () => false);
  const accent = useAccentColor(theme);

  const browse = () => fileInput.current?.click();
  const openPackages = (intent: PackagesIntent) => {
    setPackagesIntent(intent);
    openPanel('packages');
  };

  useApplyTheme(theme);

  // Recent jobs: load, then sweep expired ones every minute.
  useEffect(() => {
    const refresh = () => void useStore.getState().refreshRecent();
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => onSession(session => void useStore.getState().setAccount(session?.user.email ?? null)), []);

  // Paste from Messenger or any app, anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = imageFilesFrom(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      void addPhotos(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addPhotos]);

  // Drop files anywhere.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = imageFilesFrom(e.dataTransfer);
      if (files.length) void addPhotos(files);
      else useStore.getState().toast('Only photos can be added. Drop a JPG, PNG or WebP file.', 'error');
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [addPhotos]);

  // Ctrl+P prints the sheet (not the app); Ctrl+S downloads; Ctrl+O browses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'p') {
        e.preventDefault();
        if (canExport) print();
      } else if (key === 's') {
        e.preventDefault();
        if (canExport) download();
      } else if (key === 'o') {
        e.preventDefault();
        browse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dockItems = [
    { icon: glyph(ImagePlus), label: 'Add photos (Ctrl+O)', onClick: browse },
    { icon: glyph(History), label: 'Recent jobs', badge: recentCount || undefined, active: panel === 'recent', onClick: () => openPanel('recent') },
    { icon: glyph(LayoutGrid), label: 'Packages', active: panel === 'packages', onClick: () => openPackages({ mode: 'list' }) },
    { icon: glyph(Settings), label: 'Settings', active: panel === 'settings', onClick: () => openPanel('settings') },
    { separator: true },
    { icon: glyph(Printer), label: canExport ? 'Print (Ctrl+P)' : 'Print: add a photo first', onClick: print },
    { icon: glyph(Download), label: canExport ? 'Download (Ctrl+S)' : 'Download: add a photo first', onClick: download }
  ];

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">
          <Logo />
          <TechText
            className="wordmark-text"
            text="Sylvi"
            fontWeight={720}
            fontSize={22}
            letterSpacing={-0.02}
            align="left"
            accentColor={accent}
            reveal="letter"
            reach={60}
            dashLength={2}
            dashGap={1.5}
            strokeWidth={1}
            specks={6}
            labels={false}
            guides={false}
            sweep={false}
            intro="type"
            introDuration={1.1}
          />
        </span>
        {shopName ? <span className="topbar-shop">{shopName}</span> : null}
        <span className="topbar-spacer" />
        <AccountButton />
      </header>

      <main className="workspace">
        <PackagePicker onEdit={id => openPackages({ mode: 'edit', id })} onCreate={() => openPackages({ mode: 'new' })} />
        <div className="stage-shell">
          <SheetStage onBrowse={browse} />
          {doneJobId ? (
            <Suspense fallback={null}>
              <JobDone />
            </Suspense>
          ) : null}
          <Dock
            items={dockItems}
            theme="dark"
            baseItemSize={compact ? 38 : 44}
            magnification={compact ? 48 : 62}
            panelHeight={compact ? 50 : 60}
            gap={8}
            distance={160}
            accentColor="var(--accent)"
            badgeColor="var(--accent)"
            style={{ '--dock-panel': 'rgba(14, 26, 22, 0.72)', '--dock-tile': 'linear-gradient(180deg, #2f3f39 0%, #1f2b27 100%)' }}
          />
        </div>
        <Inspector />
      </main>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) void addPhotos(files);
        }}
      />

      <RecentPanel />
      <PackagesPanel intent={packagesIntent} onIntent={setPackagesIntent} />
      <SettingsPanel />
      <CropEditor />
      <Toasts />

      <div className={`drop-overlay${dragging ? ' drop-overlay--on' : ''}`} aria-hidden={!dragging}>
        <div className="drop-target">
          <ImagePlus size={28} strokeWidth={1.6} />
          <p>Drop to add photos</p>
        </div>
      </div>
    </div>
  );
}

const COMPACT = '(max-width: 600px)';
const isCompact = () => window.matchMedia(COMPACT).matches;
const subscribeCompact = (cb: () => void) => {
  const query = window.matchMedia(COMPACT);
  query.addEventListener('change', cb);
  return () => query.removeEventListener('change', cb);
};

function Toasts() {
  const toasts = useStore(s => s.toasts);
  const dismiss = useStore(s => s.dismissToast);
  const icons = { info: Info, success: CircleCheck, error: CircleX };
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map(t => {
        const Icon = icons[t.tone];
        return (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <Icon size={16} aria-hidden="true" />
            <p>{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The resolved accent colour. Canvas-drawn components can't read CSS
 * variables, so this re-reads --accent whenever the theme changes.
 */
function useAccentColor(theme: 'system' | 'light' | 'dark') {
  const read = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c2185b';
  const [accent, setAccent] = useState(read);
  useEffect(() => {
    const update = () => requestAnimationFrame(() => setAccent(read()));
    update();
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', update);
    return () => scheme.removeEventListener('change', update);
  }, [theme]);
  return accent;
}

/** Sets data-theme without letting every color transition fire at once. */
function useApplyTheme(theme: 'system' | 'light' | 'dark') {
  useEffect(() => {
    const root = document.documentElement;
    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.append(style);
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    void getComputedStyle(root).opacity; // flush styles before restoring transitions
    requestAnimationFrame(() => style.remove());
  }, [theme]);
}
