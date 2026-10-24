import type { CSSProperties, FC, ReactElement, ReactNode } from 'react';

export interface CarouselItem {
  id?: string | number;
  image?: string;
  alt?: string;
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}

export interface CarouselProps {
  items?: (CarouselItem | string | ReactElement)[];
  baseWidth?: number | string;
  aspectRatio?: number;
  peek?: number;
  gap?: number;
  radius?: number;
  frame?: boolean;
  effect?: 'tilt' | 'slide' | 'scale' | 'fade' | 'cube';
  indicator?: 'dots' | 'bars' | 'counter' | 'none';
  arrows?: boolean;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  draggable?: boolean;
  round?: boolean;
  initialIndex?: number;
  theme?: 'dark' | 'light';
  onChange?: (index: number) => void;
  className?: string;
  style?: CSSProperties;
}

declare const Carousel: FC<CarouselProps>;
export default Carousel;
