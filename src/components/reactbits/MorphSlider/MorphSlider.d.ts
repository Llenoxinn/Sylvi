import type { FC, HTMLAttributes } from 'react';

export interface MorphSliderItem {
  image: string;
  caption?: string;
}

export interface MorphSliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items?: MorphSliderItem[];
  startIndex?: number;
  transition?: 'melt' | 'ripple' | 'shear' | 'swirl';
  duration?: number;
  ease?: string;
  intensity?: number;
  scale?: number;
  aberration?: number;
  drift?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
  radius?: number;
  overlayColor?: string;
  showCaptions?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
  className?: string;
  /** Sylvi addition: accessible name for the slide area. */
  ariaLabel?: string;
  /** Sylvi addition: called with the index of the slide being shown. */
  onIndexChange?: (index: number) => void;
}

declare const MorphSlider: FC<MorphSliderProps>;
export default MorphSlider;
