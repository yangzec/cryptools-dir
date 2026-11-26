import { z } from 'zod';

export interface Role {
  id: string;
  name: string;
  title: string;
  description: string | null;
  status: string;
}

export interface Permission {
  id: string;
  code: string;
  title: string;
}

export const PAGE_SIZE = 20;

export const roleSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
});
export type RoleForm = z.infer<typeof roleSchema>;
export const emptyForm: RoleForm = { name: '', title: '', description: '' };
