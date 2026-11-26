import * as directoryAdmin from '@/modules/directory/admin';
import { respData, respErr, respOk, respPage } from '@/lib/resp';

import type { AdminHandlerContext } from '../types';

export async function GET({ request }: AdminHandlerContext) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('all') === 'true') {
      const items = await directoryAdmin.listDirectoryTagOptions();
      return respData(items);
    }
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20'))
    );
    const search = searchParams.get('search') || undefined;
    const { items, total } = await directoryAdmin.listDirectoryTagsAdmin({
      page,
      pageSize,
      search,
    });
    return respPage(items, total);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function POST({ request }: AdminHandlerContext) {
  try {
    const body = await request.json();
    if (!body?.name) return respErr('name is required');
    const result = await directoryAdmin.createDirectoryTagAdmin(body);
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function PUT({ request }: AdminHandlerContext) {
  try {
    const body = await request.json();
    if (!body?.id) return respErr('ID is required');
    const { id, ...rest } = body;
    const result = await directoryAdmin.updateDirectoryTagAdmin(id, rest);
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function DELETE({ request }: AdminHandlerContext) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return respErr('ID is required');
    await directoryAdmin.deleteDirectoryTagAdmin(id);
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}
