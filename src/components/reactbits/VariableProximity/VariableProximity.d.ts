import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes, RefObject } from 'react';

export interface VariableProximityProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  label: string;
  fromFontVariationSettings?: string;
  toFontVariationSettings?: string;
  containerRef?: RefObject<HTMLElement | null>;
  radius?: number;
  falloff?: 'linear' | 'exponential' | 'gaussian';
  smoothing?: number;
  fromColor?: string;
  toColor?: string;
  scale?: number;
  lift?: number;
  idleWave?: boolean;
  fontSize?: number | string;
}

declare const VariableProximity: ForwardRefExoticComponent<VariableProximityProps & RefAttributes<HTMLSpanElement>>;
export default VariableProximity;
