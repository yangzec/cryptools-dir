import * as directoryAdmin from '@/modules/directory/admin';
import { respData, respErr, respOk, respPage } from '@/lib/resp';

import type { AdminHandlerContext } from '../types';

export async function GET({ request }: AdminHandlerContext) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const item = await directoryAdmin.getDirectoryToolAdmin(id);
      return respData(item);
    }
    if (searchParams.get('all') === 'true') {
      const items = await directoryAdmin.listDirectoryToolOptions();
      return respData(items);
    }
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20'))
    );
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const source = searchParams.get('source') || undefined;
    const { items, total } = await directoryAdmin.listDirectoryToolsAdmin({
      page,
      pageSize,
      search,
      status,
      source,
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
    const result = await directoryAdmin.createDirectoryToolAdmin(body);
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export async function PUT({ request }: AdminHandlerContext) {
  try {
    const body = await request.json();
    if (!body?.id) return respErr('ID is required');
    const { id, forceUnpublish, ...rest } = body;
    if (forceUnpublish) {
      const result = await directoryAdmin.forceUnpublishDirectoryToolAdmin(id);
      return respData(result);
    }
    const result = await directoryAdmin.updateDirectoryToolAdmin(id, rest);
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
    await directoryAdmin.deleteDirectoryToolAdmin(id);
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}
