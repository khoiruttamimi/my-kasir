export type Transaction = {
  id: string;
  invoiceNumber: string;
  items: TransactionItem[];
  subtotal: number;
  total: number;
  paymentMethod: 'cash' | 'qris';
  paidAmount: number;
  changeAmount: number;
  userId: string;
  userName: string;
  createdAt: string;
};

export type TransactionItem = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
};
