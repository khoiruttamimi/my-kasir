'use client';

import { useState } from 'react';
import { EyeOutlined } from '@ant-design/icons';
import { Alert, Button, Table, Tag } from 'antd';
import { Search, Title } from '@/components/antd-wrapper';
import PaginationTable from '@/components/pagination-table';
import { useQueryParams } from '@/hooks/use-query-params';
import type { Transaction } from '@/models/transaction';
import { formatRupiah } from '@/utils/format-money';
import { formatDateTime } from '@/utils/format-date';
import { useGetTransactions } from './hooks/use-transactions';
import ModalTransactionDetail from './components/modal-transaction-detail';

export default function TransactionsContainer() {
  const { getParam, setParams } = useQueryParams();
  const pageParam = Number(getParam('page') ?? 1);
  const limitParam = Number(getParam('limit') ?? 10);
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isSafeInteger(limitParam) && limitParam > 0 ? limitParam : 10;
  const search = getParam('search') ?? '';
  const { data, isFetching, error, refetch } = useGetTransactions({ page, limit, search });
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <div>
      <Title>Transactions</Title>
      <Search
        className="pb-12"
        placeholder="Search invoice or user"
        key={search}
        defaultValue={search}
        allowClear
        style={{ width: 300, maxWidth: '100%' }}
        onSearch={(value) => setParams({ search: value, page: 1 })}
      />
      {error && (
        <Alert
          type="error"
          showIcon
          message={error.message}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      )}
      <Table<Transaction>
        dataSource={data?.data ?? []}
        bordered
        rowKey="id"
        loading={isFetching}
        pagination={false}
        scroll={{ x: 850 }}
        columns={[
          { title: 'Invoice', dataIndex: 'invoiceNumber' },
          { title: 'Date', dataIndex: 'createdAt', render: (value: string) => formatDateTime(value) },
          { title: 'User', dataIndex: 'userName' },
          {
            title: 'Payment',
            dataIndex: 'paymentMethod',
            render: (value: Transaction['paymentMethod']) => (
              <Tag color={value === 'cash' ? 'green' : 'blue'}>{value.toUpperCase()}</Tag>
            ),
          },
          { title: 'Total', dataIndex: 'total', align: 'right', render: (value: number) => formatRupiah(value) },
          {
            title: 'Action',
            key: 'action',
            render: (_, transaction) => (
              <Button
                icon={<EyeOutlined />}
                aria-label={`View ${transaction.invoiceNumber}`}
                onClick={() => setSelectedId(transaction.id)}
              >
                View
              </Button>
            ),
          },
        ]}
      />
      <PaginationTable
        page={page}
        limit={limit}
        total={data?.pagination?.total ?? 0}
        onChange={(nextPage, nextLimit) => setParams({ page: nextLimit !== limit ? 1 : nextPage, limit: nextLimit })}
      />
      <ModalTransactionDetail transactionId={selectedId} onClose={() => setSelectedId(undefined)} />
    </div>
  );
}
