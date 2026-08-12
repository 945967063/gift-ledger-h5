import { normalizePage } from './validation';

export interface PaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
  legacyLimit?: unknown;
}

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export const readPagination = (
  query: Record<string, unknown>,
  options: PaginationOptions = {}
): Pagination => {
  const defaultPageSize = options.defaultPageSize ?? 20;
  const maxPageSize = options.maxPageSize ?? 100;
  const requestedPageSize = query.pageSize ?? options.legacyLimit;
  const page = normalizePage(query.page, 1, 1_000_000);
  const pageSize = normalizePage(requestedPageSize, defaultPageSize, maxPageSize);
  return { page, pageSize, offset: (page - 1) * pageSize };
};

export const createPaginationMeta = (
  pagination: Pick<Pagination, 'page' | 'pageSize'>,
  total: number
): PaginationMeta => ({
  page: pagination.page,
  pageSize: pagination.pageSize,
  total,
  hasMore: pagination.page * pagination.pageSize < total,
});

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
