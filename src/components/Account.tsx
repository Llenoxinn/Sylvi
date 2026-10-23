import { useEffect, useId, useRef, useState } from 'react';
import { CircleCheck, LoaderCircle, LogOut, UserRound } from 'lucide-react';
import { accountsEnabled, sendSignInLink, signInWithGoogle, signOut } from '../lib/cloud';
import { useStore } from '../state/store';
import { Dialog } from './ui';

/** Top-bar account button. Hidden when accounts aren't configured. */
export function AccountButton() {
  const account = useStore(s => s.account);
  const openPanel = useStore(s => s.openPanel);
  if (!accountsEnabled) return null;

  return (
    <button type="button" className="btn btn--sm account-btn" onClick={() => openPanel('settings')}>
      {account ? (
        <>
          <span className="avatar" aria-hidden="true">
            {account.email[0]?.toUpperCase()}
          </span>
          <span className="account-email">{account.email}</span>
        </>
      ) : (
        <>
          <UserRound size={15} />
          Sign in
        </>
      )}
    </button>
  );
}

export function AccountForm() {
  const account = useStore(s => s.account);
  const syncing = useStore(s => s.syncing);
  const syncError = useStore(s => s.syncError);
  const busy = useStore(s => s.busy);
  const custom = useStore(s => s.customPackages.filter(p => !p.deletedAt).length);
  const [method, setMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const id = useId();

  if (account) {
    return (
      <div className="account-card">
        <span className="avatar" aria-hidden="true">
          {account.email[0]?.toUpperCase()}
        </span>
        <div className="account-text">
          <p>{account.email}</p>
          <p className="hint" aria-live="polite">
            {syncing ? (
              <>
                <LoaderCircle size={13} className="spin" /> Syncing packages…
              </>
            ) : syncError ? 'Changes haven’t synced.' : (
              <>
                <CircleCheck size={13} /> {custom} custom package{custom === 1 ? '' : 's'} synced
              </>
            )}
          </p>
          {syncError ? (
            <>
              <p className="hint hint--danger">{syncError}</p>
              <button type="button" className="btn btn--sm" onClick={() => void useStore.getState().syncAccount()}>Retry sync</button>
            </>
          ) : null}
        </div>
        <button type="button" className="btn btn--sm btn--ghost" disabled={busy !== null} onClick={() => void signOut().catch(() => useStore.getState().toast('Sign-out failed. You are still signed in. Try again.', 'error'))}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    );
  }

  if (state === 'sent') {
    return (
      <p className="hint">
        Check {email} for a sign-in link and open it on this computer. Your packages and settings will sync once you’re in.
      </p>
    );
  }

  const switchTo = (next: 'google' | 'email') => {
    setMethod(next);
    setState('idle');
  };

  const continueWithGoogle = async () => {
    // Google sends the shop back to a fresh page, and photos on the sheet live only in memory.
    if (useStore.getState().people.length && !confirm('Signing in reloads Sylvi, so the photos on the sheet will be cleared. Continue?')) return;
    setState('sending');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in couldn’t start.');
      setState('error');
    }
  };

  const errorHint =
    state === 'error' ? (
      <p id={`${id}-error`} className="hint hint--danger">
        {error} {method === 'email' ? 'Check the address and try again.' : 'Try again, or use email instead.'}
      </p>
    ) : null;

  if (method === 'google') {
    return (
      <div className="account-form">
        <p className="hint">Sign in to use your shop’s packages and settings across computers. Guest packages stay in this browser. Customer photos stay on each computer.</p>
        <button type="button" className="btn btn--block google-btn" disabled={state === 'sending'} onClick={() => void continueWithGoogle()}>
          {state === 'sending' ? <LoaderCircle size={16} className="spin" /> : <GoogleMark />}
          Continue with Google
        </button>
        {errorHint}
        <button type="button" className="btn btn--sm btn--ghost account-switch" onClick={() => switchTo('email')}>
          Use email instead
        </button>
      </div>
    );
  }

  return (
    <form
      className="account-form"
      onSubmit={async e => {
        e.preventDefault();
        setState('sending');
        try {
          await sendSignInLink(email.trim());
          setState('sent');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'The link couldn’t be sent.');
          setState('error');
        }
      }}
    >
      <p className="hint">We’ll email you a link to sign in. No password needed.</p>
      <label className="visually-hidden" htmlFor={id}>
        Email address
      </label>
      <div className="row">
        <input
          id={id}
          className="input"
          type="email"
          required
          autoComplete="email"
          placeholder="shop@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          aria-describedby={state === 'error' ? `${id}-error` : undefined}
        />
        <button type="submit" className="btn btn--primary" disabled={state === 'sending'}>
          {state === 'sending' ? <LoaderCircle size={15} className="spin" /> : null}
          Email me a link
        </button>
      </div>
      {errorHint}
      <button type="button" className="btn btn--sm btn--ghost account-switch" onClick={() => switchTo('google')}>
        Use Google instead
      </button>
    </form>
  );
}

/**
 * Asks a signed-in shop for its details. "Later" hides it until Sylvi is next
 * opened; it stops appearing once the shop has a name.
 */
export function ShopSetup() {
  const needed = useStore(s => s.account !== null && !s.syncing && s.panel === null && !s.settings.shopName.trim());
  const update = useStore(s => s.updateSettings);
  const [later, setLater] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const open = needed && !later;

  // Runs after the dialog's own effect has opened it, so the name field gets focus instead of the close button.
  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      title="Set up your shop"
      onClose={() => setLater(true)}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => setLater(true)}>
            Later
          </button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={!name.trim()}>
            Save
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="account-form"
        onSubmit={e => {
          e.preventDefault();
          if (name.trim()) update({ shopName: name.trim(), shopPhone: phone.trim(), shopCity: city.trim() });
        }}
      >
        <p className="hint">Your shop name appears in the top bar on every computer you sign in on. You can change these anytime in Settings.</p>
        <div className="field">
          <label className="field-label" htmlFor={`${formId}-name`}>
            Shop name
          </label>
          <input
            ref={nameRef}
            id={`${formId}-name`}
            className="input"
            required
            maxLength={60}
            autoComplete="organization"
            placeholder="e.g. JM Printing & Photocopy"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${formId}-phone`}>
            Mobile number <span>Optional</span>
          </label>
          <input
            id={`${formId}-phone`}
            className="input"
            type="tel"
            maxLength={20}
            autoComplete="tel"
            placeholder="0917 123 4567"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${formId}-city`}>
            City or town <span>Optional</span>
          </label>
          <input
            id={`${formId}-city`}
            className="input"
            maxLength={60}
            autoComplete="address-level2"
            placeholder="e.g. Quezon City"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
}

/** Google's "G", in the colours its sign-in guidelines require. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
