"use client";

import { useState, useCallback } from "react";

interface UsePaginationProps {
  pageSize?: number;
  initialPage?: number;
}

interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  paginationOpts: {
    numItems: number;
    cursor: string | null;
  };
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  resetPagination: () => void;
  setPageSize: (size: number) => void;
}

export function usePagination({ 
  pageSize = 10, 
  initialPage = 1 
}: UsePaginationProps = {}): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [size, setSize] = useState(pageSize);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => prev + 1);
  }, []);

  const previousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const setPageSize = useCallback((newSize: number) => {
    setSize(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Calculate cursor for Convex pagination
  const cursor = currentPage > 1 ? ((currentPage - 1) * size).toString() : null;

  return {
    currentPage,
    pageSize: size,
    paginationOpts: {
      numItems: size,
      cursor,
    },
    goToPage,
    nextPage,
    previousPage,
    resetPagination,
    setPageSize,
  };
}
