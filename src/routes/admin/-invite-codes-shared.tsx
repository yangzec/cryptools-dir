import { z } from 'zod';

export type Tab = 'all' | 'available' | 'used';
export const TABS: Tab[] = ['all', 'available', 'used'];

export interface InviteCodeRow {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  trialDays: number;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const PAGE_SIZE = 20;

export const inviteCodeSchema = z.object({
  count: z.coerce.number().min(1),
  maxUses: z.coerce.number().min(1),
  trialDays: z.coerce.number().min(1),
  note: z.string(),
  expiresAt: z.string(),
});
export type InviteCodeForm = z.input<typeof inviteCodeSchema>;
export const emptyForm: InviteCodeForm = {
  count: '1',
  maxUses: '1',
  trialDays: '15',
  note: '',
  expiresAt: '',
};
