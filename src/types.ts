export interface KratongParts {
  base: number;
  flower: number;
  candle: number;
  color: number;
}

export interface Kratong {
  id: string;
  uid: string;
  name: string;
  dept?: string;
  wish: string;
  parts: KratongParts;
  createdAt: number;
  hidden?: boolean;
}

export type ReactionType = 'heart' | 'flower';

export interface EventConfig {
  eventName: string;
  logo: string;
  open: boolean;
  cooldownSec: number;
  fireworksAt: number;
}

export const DEFAULT_CONFIG: EventConfig = {
  eventName: '',
  logo: '',
  open: false,
  cooldownSec: 180,
  fireworksAt: 0,
};

export const LIMITS = { name: 30, dept: 30, wish: 120 } as const;
