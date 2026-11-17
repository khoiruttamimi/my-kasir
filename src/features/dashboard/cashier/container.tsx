'use client';

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { Button, Input, Pagination, Typography, theme } from 'antd';
import idID from 'antd/locale/id_ID';
import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import { useDashboardFocusMode } from '@/components/dashboard-layout/focus-mode';
import { useQueryParams } from '@/hooks/use-query-params';
import { formatRupiah } from '@/utils/format-money';
import CartPanel from './components/cart-panel';
import ProductGrid from './components/product-grid';
import { useCashierCart } from './hooks/use-cashier-cart';
import {
  ScanLookupTimeout,
  useCashierCodeLookup,
  useCashierProducts,
  type CashierProduct,
} from './hooks/use-cashier-products';
import styles from './styles.module.scss';

const PAGE_SIZE = 24;
const SEARCH_DELAY_MS = 200;

const scanMessages = {
  pending: 'Sedang mencari kode. Pindai ulang kode yang dipindai saat pencarian berlangsung.',
  missing: 'Kode produk tidak ditemukan',
  timeout: 'Pencarian kode melebihi batas waktu. Coba lagi.',
  network: 'Gagal mencari kode produk. Periksa koneksi dan coba lagi.',
  failure: 'Gagal mencari kode produk. Coba lagi.',
};

export default function CashierContainer() {
  const [search, setSearch] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [lastAdded, setLastAdded] = useState('');
  const [scanStatus, setScanStatus] = useState<keyof typeof scanMessages | null>(null);
  const scanRequest = useRef<AbortController | null>(null);
  const [pagePending, startPageTransition] = useTransition();
  const cartHeading = useRef<HTMLElement>(null);
  const focusMode = useDashboardFocusMode();
  const { token } = theme.useToken();
  const { getParam, setParams } = useQueryParams();
  const { addProduct, ...cart } = useCashierCart();
  const lookupCode = useCashierCodeLookup();
  const term = search.trim();
  const requestedPage = Number(getParam('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(
    () => () => {
      const request = scanRequest.current;
      scanRequest.current = null;
      request?.abort();
    },
    [],
  );

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
    if (scanRequest.current) return;
    setSearch(value);
    setScanStatus(null);
    if (value.trim() !== term && (getParam('page') !== null || pagePending)) {
      changePage(1);
    }
  }

  function selectProduct(product: CashierProduct) {
    addProduct(product);
    setLastAdded(product.name);
  }

  async function submitScan(value: string) {
    const code = value.trim();
    if (!code || scanRequest.current) return;

    const controller = new AbortController();
    scanRequest.current = controller;
    setLastAdded('');
    setScanStatus('pending');
    try {
      const product = await lookupCode(code, controller);
      if (scanRequest.current !== controller || controller.signal.aborted) return;
      if (!product) {
        setScanStatus('missing');
        return;
      }

      selectProduct(product);
      setSearch('');
      setScanStatus(null);
      if (getParam('page') !== null || pagePending) changePage(1);
    } catch (error) {
      if (scanRequest.current !== controller) return;
      if (error instanceof ScanLookupTimeout) setScanStatus('timeout');
      else if (error instanceof TypeError) setScanStatus('network');
      else setScanStatus('failure');
    } finally {
      if (scanRequest.current === controller) scanRequest.current = null;
    }
  }

  function handleScanKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.repeat || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submitScan(event.currentTarget.value);
  }

  const canRetry = scanStatus === 'timeout' || scanStatus === 'network' || scanStatus === 'failure';

  return (
    <section className={styles.cashier} lang="id" aria-labelledby="cashier-title">
      <div className={styles.heading} style={{ backgroundColor: token.colorBgContainer }}>
        <Typography.Title level={2} id="cashier-title">
          Kasir
        </Typography.Title>
        <div className={styles.toolbar}>
          <Typography.Text strong>{cart.totalItems} item</Typography.Text>
          <Button className={styles.cartShortcut} onClick={() => cartHeading.current?.focus()}>
            Lihat keranjang · {formatRupiah(cart.grandTotal)}
          </Button>
          {focusMode && (
            <Button
              aria-pressed={focusMode.active}
              icon={
                focusMode.active ? (
                  <FullscreenExitOutlined aria-hidden="true" />
                ) : (
                  <FullscreenOutlined aria-hidden="true" />
                )
              }
              onClick={focusMode.toggle}
            >
              {focusMode.active ? 'Keluar layar penuh' : 'Layar penuh'}
            </Button>
          )}
        </div>
      </div>
      <div className={styles.workspace}>
        <div className={styles.catalog}>
          <div className={styles.search}>
            <label htmlFor="cashier-search">Cari nama atau kode produk</label>
            <Input
              id="cashier-search"
              value={search}
              readOnly={scanStatus === 'pending'}
              onChange={(event) => changeSearch(event.target.value)}
              onKeyDown={handleScanKey}
            />
          </div>
          <div role="status" className={styles.feedback}>
            {scanStatus ? scanMessages[scanStatus] : lastAdded && `${lastAdded} ditambahkan.`}
            {canRetry && (
              <Button type="link" onClick={() => void submitScan(search)}>
                Coba lagi
              </Button>
            )}
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
        </div>
        <CartPanel {...cart} headingRef={cartHeading} />
      </div>
    </section>
  );
}
