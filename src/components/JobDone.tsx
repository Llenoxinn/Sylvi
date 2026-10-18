import { HugeiconsIcon } from '@hugeicons/react';
import { FavouriteIcon } from '@hugeicons/core-free-icons';
import { X } from 'lucide-react';
import SlingButton from './reactbits/SlingButton/SlingButton';
import { useStore } from '../state/store';

/**
 * Shown after a download or print: like how the job turned out, then move on
 * to the next customer. The like is kept on the job in Recent jobs.
 */
export default function JobDone() {
  const jobId = useStore(s => s.doneJobId);
  const job = useStore(s => s.recent.find(j => j.id === s.doneJobId) ?? null);
  const likeJob = useStore(s => s.likeJob);
  const dismiss = useStore(s => s.dismissDone);
  const clearAll = useStore(s => s.clearAll);

  if (!jobId || !job) return null;
  const liked = !!job.liked;

  return (
    <section className={`job-done${liked ? ' job-done--liked' : ''}`} aria-label="Job finished">
      <SlingButton
        onSend={() => void likeJob(job.id)}
        ariaLabel={liked ? `Liked ${job.title}` : `Like ${job.title}`}
        size={44}
        strokeWidth={2.5}
        armAt={36}
        maxPull={110}
        flight={72}
        particles={12}
        spread={70}
        padColor={liked ? 'var(--accent)' : 'var(--surface)'}
        iconColor={liked ? 'var(--accent-ink)' : 'var(--accent)'}
        accentColor="var(--accent)"
        wellColor="var(--surface-3)"
        bandColor="var(--line-strong)"
      >
        <HugeiconsIcon icon={FavouriteIcon} size={20} strokeWidth={2} />
      </SlingButton>

      <div className="job-done-text" aria-live="polite">
        <p className="job-done-title">{liked ? 'Liked' : 'Job done'}</p>
        <p className="hint">
          {liked ? 'The heart is saved on this job in Recent jobs.' : 'Happy with it? Tap the heart, or pull it back and let go.'}
        </p>
      </div>

      <button type="button" className="btn btn--sm" onClick={clearAll}>
        Next customer
      </button>
      <button type="button" className="btn btn--sm btn--ghost btn--icon" onClick={dismiss} aria-label="Close">
        <X size={15} />
      </button>
    </section>
  );
}
