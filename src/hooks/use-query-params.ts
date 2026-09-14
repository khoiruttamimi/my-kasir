'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type QueryValue = string | number | boolean | null | undefined;

type QueryParams = Record<string, QueryValue>;

export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getParam = (key: string) => {
    return searchParams.get(key);
  };

  const setParams = (values: QueryParams) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        params.delete(key);
        return;
      }

      params.set(key, String(value));
    });

    const query = params.toString();

    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const removeParams = (...keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    keys.forEach((key) => {
      params.delete(key);
    });

    const query = params.toString();

    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return {
    searchParams,
    getParam,
    setParams,
    removeParams,
  };
}
