import { useEffect, useState } from 'react';
import { Heart, History, Trash2 } from 'lucide-react';
import { MAX_RECENT, type RecentJob } from '../lib/storage/recent';
import { RECENT_WINDOWS } from '../lib/storage/settings';
import { useStore } from '../state/store';
import { Dialog } from './ui';

export function RecentPanel() {
  const open = useStore(s => s.panel === 'recent');
  const recent = useStore(s => s.recent);
  const hours = useStore(s => s.settings.recentHours);
  const reopen = useStore(s => s.reopenJob);
  const forget = useStore(s => s.forgetJob);
  const close = () => useStore.getState().openPanel(null);
  const windowLabel = RECENT_WINDOWS.find(w => w.hours === hours)?.label ?? `${hours} hours`;

  return (
    <Dialog open={open} title="Recent jobs" onClose={close}>
      <p className="hint">
        The last {MAX_RECENT} jobs you downloaded or printed stay on this computer for {windowLabel}, then delete themselves. Customer photos are never
        uploaded.
      </p>
      {recent.length === 0 ? (
        <div className="empty-inline">
          <History size={20} strokeWidth={1.8} aria-hidden="true" />
          <p>Nothing yet. Download or print a sheet and it shows up here, ready to reprint.</p>
        </div>
      ) : (
        <ul className="recent-list">
          {recent.map(job => (
            <RecentRow
              key={job.id}
              job={job}
              onReopen={() => {
                if (useStore.getState().people.length && !confirm('Replace the photos on the current sheet with this job?')) return;
                void reopen(job);
              }}
              onForget={() => void forget(job.id)}
            />
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function RecentRow({ job, onReopen, onForget }: { job: RecentJob; onReopen: () => void; onForget: () => void }) {
  const [thumb, setThumb] = useState<string>();
  useEffect(() => {
    const url = URL.createObjectURL(job.thumbnail);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [job.thumbnail]);

  return (
    <li className="recent">
      {thumb ? <img className="recent-thumb" src={thumb} alt="" /> : <span className="recent-thumb" />}
      <div className="recent-text">
        <p className="recent-title">
          {job.title}
          {job.liked ? <Heart size={14} className="recent-liked" fill="currentColor" aria-label="Liked" /> : null}
        </p>
        <p className="hint">{job.summary}</p>
        <p className="recent-meta">
          {timeAgo(job.createdAt)}. Deletes itself {timeLeft(job.expiresAt)}.
        </p>
      </div>
      <div className="recent-actions">
        <button type="button" className="btn btn--sm" onClick={onReopen}>
          Reopen
        </button>
        <button type="button" className="btn btn--sm btn--ghost btn--icon" onClick={onForget} aria-label={`Delete ${job.title}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

function timeAgo(t: number): string {
  const minutes = Math.round((Date.now() - t) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(t).toLocaleDateString();
}

function timeLeft(t: number): string {
  const minutes = Math.max(1, Math.round((t - Date.now()) / 60_000));
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} h`;
  return `in ${Math.round(hours / 24)} days`;
}
