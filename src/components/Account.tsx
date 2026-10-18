import { useId, useState } from 'react';
import { CircleCheck, LoaderCircle, LogOut, UserRound } from 'lucide-react';
import { accountsEnabled, sendSignInLink, signOut } from '../lib/cloud';
import { useStore } from '../state/store';

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
  const custom = useStore(s => s.customPackages.length);
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
            ) : (
              <>
                <CircleCheck size={13} /> {custom} custom package{custom === 1 ? '' : 's'} synced
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => void signOut()}>
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
      <p className="hint">Sign in to keep your custom packages and settings on every computer in your shop. Customer photos stay on each computer.</p>
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
      {state === 'error' ? (
        <p id={`${id}-error`} className="hint hint--danger">
          {error} Check the address and try again.
        </p>
      ) : null}
    </form>
  );
}
