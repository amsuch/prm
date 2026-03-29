import { useState, useCallback } from "react";
import { useSession } from "@/lib/auth/ctx";
import {
  searchContacts,
  countActiveFilters,
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
