import { useState, useCallback } from "react";
import { useSession } from "@/lib/auth/ctx";
import {
  searchContacts,
  type SearchFilters,
  type SearchResultContact,
  type SearchSortOption,
  type LastContactedRange,
  type SourceFilter,
  DEFAULT_FILTERS,
} from "@/lib/search";

export type { SearchFilters, SearchResultContact, SearchSortOption, LastContactedRange, SourceFilter };
export { DEFAULT_FILTERS };

export function useSearch() {
  const { session } = useSession();
  const [results, setResults] = useState<SearchResultContact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [hasSearched, setHasSearched] = useState(false);

  const userId = session?.user?.id;

  const search = useCallback(
    async (overrideFilters?: Partial<SearchFilters>) => {
      if (!userId) return;

      const activeFilters = overrideFilters
        ? { ...filters, ...overrideFilters }
        : filters;

      setIsSearching(true);
      setError(null);
      setHasSearched(true);

      const { data, error: searchError } = await searchContacts(
        userId,
        activeFilters,
      );

      setResults(data);
      setError(searchError);
      setIsSearching(false);
    },
    [userId, filters],
  );

  const updateFilters = useCallback(
    (update: Partial<SearchFilters>) => {
      setFilters((prev) => ({ ...prev, ...update }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setHasSearched(false);
    setError(null);
  }, []);

  const activeFilterCount = countActiveFilters(filters);

  return {
    results,
    isSearching,
    error,
    filters,
    hasSearched,
    activeFilterCount,
    search,
    updateFilters,
    clearFilters,
    setFilters,
  };
}

function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.tagIds.length > 0) count++;
  if (filters.company.trim()) count++;
  if (filters.lastContactedRange !== "any") count++;
  if (filters.source !== "all") count++;
  if (filters.sortBy !== "relevance") count++;
  return count;
}
