export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedApiData<T> {
  data: T[];
  pagination: PaginationMeta;
}
