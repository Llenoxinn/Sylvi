import { useMemo } from 'react';
import { gapFor } from '../lib/layout/guides';
import { buildPackItems, type PersonPackage } from '../lib/layout/items';
import { pack, type PackResult } from '../lib/layout/pack';
import { resolvePaper } from '../lib/papers';
import type { Settings } from '../lib/storage/settings';
import { findPackage, useStore } from './store';

/** Placeholder id used to preview a package before any photo is added. */
export const SAMPLE_PERSON = '__sample__';

export function computeLayout(people: PersonPackage[], settings: Settings): PackResult {
  const paper = resolvePaper(settings.paper);
  const items = buildPackItems(people, paper.widthMm * paper.heightMm);
  return pack(items, {
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    marginMm: settings.paper.marginMm,
    gapMm: gapFor(settings.cutStyle),
    orientation: settings.paper.orientation
  });
}

/** The current sheets. With no photos yet, lays out the default package with placeholders. */
export function useLayout(): PackResult & { sample: boolean } {
  const people = useStore(s => s.people);
  const settings = useStore(s => s.settings);
  const custom = useStore(s => s.customPackages);
  // Only the package choices affect the layout, not crops or adjustments.
  const signature = people.map(p => `${p.id}:${p.packageId}`).join('|');

  return useMemo(() => {
    const sample = people.length === 0;
    const entries: PersonPackage[] = sample
      ? [{ personId: SAMPLE_PERSON, pkg: findPackage(custom, settings.defaultPackageId) }]
      : people.map(p => ({ personId: p.id, pkg: findPackage(custom, p.packageId) }));
    return { ...computeLayout(entries, settings), sample };
  }, [signature, settings.paper, settings.cutStyle, settings.defaultPackageId, custom]);
}
