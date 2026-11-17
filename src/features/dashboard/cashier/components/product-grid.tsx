import { Alert, Button, Empty, Spin } from 'antd';
import { formatRupiah } from '@/utils/format-money';
import type { CashierProduct } from '../hooks/use-cashier-products';
import styles from '../styles.module.scss';

type ProductGridProps = {
  products?: CashierProduct[];
  loading?: boolean;
  onRetry?: () => void;
  onSelect: (product: CashierProduct) => void;
};

export default function ProductGrid({ products = [], loading, onRetry, onSelect }: ProductGridProps) {
  if (loading) {
    return (
      <div className={styles.loading} role="status">
        <Spin aria-hidden="true" />
        <span>Memuat produk…</span>
      </div>
    );
  }

  if (onRetry) {
    return (
      <Alert
        type="error"
        showIcon
        message="Gagal memuat produk."
        action={<Button onClick={onRetry}>Coba lagi</Button>}
      />
    );
  }

  if (products.length === 0) {
    return <Empty description="Tidak ada produk yang cocok." />;
  }

  return (
    <div className={styles.grid}>
      {products.map((product) => (
        <Button key={product.id} className={styles.card} onClick={() => onSelect(product)}>
          <span className={styles.productName}>{product.name}</span>
          <span className={styles.productCode}>{product.code ?? 'Kode belum diisi'}</span>
          <strong>{formatRupiah(product.price)}</strong>
        </Button>
      ))}
    </div>
  );
}
