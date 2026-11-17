import { DeleteOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Empty, Typography } from 'antd';
import type { Ref } from 'react';
import { formatRupiah } from '@/utils/format-money';
import type { useCashierCart } from '../hooks/use-cashier-cart';
import styles from '../styles.module.scss';

type CartPanelProps = Omit<ReturnType<typeof useCashierCart>, 'addProduct'> & { headingRef?: Ref<HTMLElement> };

export default function CartPanel({
  lines,
  totalItems,
  grandTotal,
  increaseQuantity,
  decreaseQuantity,
  removeProduct,
  clear,
  headingRef,
}: CartPanelProps) {
  const { modal } = App.useApp();
  const isEmpty = lines.length === 0;

  function confirmClear() {
    modal.confirm({
      title: 'Kosongkan keranjang?',
      content: 'Semua produk akan dihapus dari keranjang.',
      okText: 'Kosongkan',
      cancelText: 'Batal',
      okButtonProps: { danger: true },
      autoFocusButton: 'cancel',
      onOk: clear,
    });
  }

  return (
    <section className={styles.cart} aria-labelledby="cashier-cart-title">
      <Card
        title={
          <Typography.Title
            ref={headingRef}
            id="cashier-cart-title"
            level={3}
            tabIndex={-1}
            className={styles.cartTitle}
          >
            Keranjang
          </Typography.Title>
        }
      >
        {isEmpty ? (
          <Empty description="Keranjang masih kosong." />
        ) : (
          <ul className={styles.cartLines}>
            {lines.map(({ productId, name, quantity, unitPrice, subtotal }) => (
              <li key={productId} className={styles.cartLine}>
                <Typography.Text strong className={styles.cartProductName}>
                  {name}
                </Typography.Text>
                <div className={styles.cartActions}>
                  <Button
                    icon={<MinusOutlined />}
                    aria-label={`Kurangi jumlah ${name}`}
                    disabled={quantity === 1}
                    onClick={() => decreaseQuantity(productId)}
                  />
                  <span>{quantity}</span>
                  <Button
                    icon={<PlusOutlined />}
                    aria-label={`Tambah jumlah ${name}`}
                    onClick={() => increaseQuantity(productId)}
                  />
                  <Button
                    icon={<DeleteOutlined />}
                    aria-label={`Hapus ${name}`}
                    danger
                    onClick={() => removeProduct(productId)}
                  />
                </div>
                <div className={styles.cartAmounts}>
                  <Typography.Text type="secondary">{`Harga satuan ${formatRupiah(unitPrice)}`}</Typography.Text>
                  <Typography.Text strong>{`Subtotal ${formatRupiah(subtotal)}`}</Typography.Text>
                </div>
              </li>
            ))}
          </ul>
        )}
        <dl className={styles.cartSummary} aria-live="polite">
          <div>
            <dt>Jumlah item</dt>
            <dd>{totalItems}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              <strong>{formatRupiah(grandTotal)}</strong>
            </dd>
          </div>
        </dl>
        <Button danger disabled={isEmpty} onClick={confirmClear}>
          Kosongkan keranjang
        </Button>
      </Card>
    </section>
  );
}
