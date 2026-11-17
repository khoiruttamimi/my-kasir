'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button, Input, Pagination, Typography } from 'antd';
import idID from 'antd/locale/id_ID';
import { useQueryParams } from '@/hooks/use-query-params';
import CartPanel from './components/cart-panel';
import ProductGrid from './components/product-grid';
import { useCashierCart } from './hooks/use-cashier-cart';
import { useCashierProducts, type CashierProduct } from './hooks/use-cashier-products';
import styles from './styles.module.scss';

const PAGE_SIZE = 24;
const SEARCH_DELAY_MS = 200;

export default function CashierContainer() {
  const [search, setSearch] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [lastAdded, setLastAdded] = useState('');
  const [pagePending, startPageTransition] = useTransition();
  const { getParam, setParams } = useQueryParams();
  const { addProduct, ...cart } = useCashierCart();
  const term = search.trim();
  const requestedPage = Number(getParam('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const changingQuery = term !== debouncedTerm || pagePending;
  const { data, isPending, isError, isFetching, refetch } = useCashierProducts(
    { page, limit: PAGE_SIZE, search: debouncedTerm },
    !changingQuery,
  );
  const loading = changingQuery || isPending || (isError && isFetching);
  const pagination = !loading && !isError ? data?.pagination : undefined;

  function changePage(nextPage: number) {
    startPageTransition(() => setParams({ page: nextPage === 1 ? null : nextPage }));
  }

  function changeSearch(value: string) {
    setSearch(value);
    if (value.trim() !== term && (getParam('page') !== null || pagePending)) {
      changePage(1);
    }
  }

  function selectProduct(product: CashierProduct) {
    addProduct(product);
    setLastAdded(product.name);
  }

  return (
    <section className={styles.cashier} lang="id" aria-labelledby="cashier-title">
      <div className={styles.heading}>
        <Typography.Title level={2} id="cashier-title">
          Kasir
        </Typography.Title>
        <Typography.Text strong>{cart.totalItems} item</Typography.Text>
      </div>
      <div className={styles.search}>
        <label htmlFor="cashier-search">Cari nama atau kode produk</label>
        <Input id="cashier-search" value={search} onChange={(event) => changeSearch(event.target.value)} />
      </div>
      <div role="status" className={styles.feedback}>
        {lastAdded && `${lastAdded} ditambahkan.`}
      </div>
      <ProductGrid
        products={data?.products}
        loading={loading}
        onRetry={isError ? () => void refetch() : undefined}
        onSelect={selectProduct}
      />
      {pagination && page > Math.max(1, pagination.totalPages) ? (
        <Button onClick={() => changePage(1)}>Kembali ke halaman pertama</Button>
      ) : pagination && pagination.totalPages > 1 ? (
        <Pagination
          className={styles.pagination}
          current={page}
          pageSize={PAGE_SIZE}
          total={pagination.total}
          showSizeChanger={false}
          showLessItems
          locale={idID.Pagination}
          onChange={changePage}
        />
      ) : null}
      <CartPanel {...cart} />
    </section>
  );
}
