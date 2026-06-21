/**
 * API response types - mirrors server responseHandler format
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  meta: { pagination?: Pagination } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}
