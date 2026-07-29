"use client";

import { useState, useCallback, useMemo } from "react";

export function useInfiniteSlice<T>(items: T[], pageSize = 10) {
  const [count, setCount] = useState(pageSize);

  const sliced = useMemo(() => items.slice(0, count), [items, count]);
  const hasMore = count < items.length;

  const loadMore = useCallback(() => {
    setCount((c) => Math.min(c + pageSize, items.length));
  }, [pageSize, items.length]);

  const reset = useCallback(() => setCount(pageSize), [pageSize]);

  return { sliced, hasMore, loadMore, reset };
}
