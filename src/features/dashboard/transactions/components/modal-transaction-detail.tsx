import { Alert, Button, Col, Flex, Modal, Space, Table, Tag } from 'antd';
import type { TransactionItem } from '@/models/transaction';
import { formatRupiah } from '@/utils/format-money';
import { formatDateTime } from '@/utils/format-date';
import { useGetTransaction } from '../hooks/use-transactions';
import { Text } from '@/components/antd-wrapper';

type ModalTransactionDetailProps = { transactionId?: string; onClose: () => void };

export default function ModalTransactionDetail({ transactionId, onClose }: ModalTransactionDetailProps) {
  const { data, isPending, error, refetch } = useGetTransaction(transactionId);

  return (
    <Modal
      centered
      open={Boolean(transactionId)}
      onCancel={onClose}
      title="Transaction Detail"
      width={700}
      footer={<Button onClick={onClose}>Close</Button>}
      loading={isPending}
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          message={error.message}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      ) : data ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {[
              {
                label: 'Invoice',
                value: (
                  <Text strong type="secondary">
                    {data.invoiceNumber}
                  </Text>
                ),
              },
              {
                label: 'Date',
                value: (
                  <Text strong type="secondary">
                    {formatDateTime(data.createdAt)}
                  </Text>
                ),
              },
              {
                label: 'User',
                value: (
                  <Text strong type="secondary">
                    {data.userName}
                  </Text>
                ),
              },
              {
                label: 'Payment',
                value: (
                  <Tag color={data.paymentMethod === 'cash' ? 'green' : 'blue'}>{data.paymentMethod.toUpperCase()}</Tag>
                ),
              },
            ].map(({ label, value }) => (
              <Flex>
                <Col span={4}>{label}</Col>
                <Col>: {value}</Col>
              </Flex>
            ))}
          </Space>
          <Table<TransactionItem>
            bordered
            size="small"
            rowKey="productId"
            dataSource={data.items}
            pagination={false}
            scroll={{ x: 500 }}
            footer={() => (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {[
                  { label: 'Subtotal', value: formatRupiah(data.subtotal) },
                  { label: 'Total', value: <strong>{formatRupiah(data.total)}</strong> },
                  { label: 'Paid Amount', value: formatRupiah(data.paidAmount) },
                  { label: 'Change', value: formatRupiah(data.changeAmount) },
                ].map(({ label, value }) => (
                  <Flex justify="end">
                    <Col>{label} :</Col>
                    <Col span={6} className="text-right">
                      {value}
                    </Col>
                  </Flex>
                ))}
              </Space>
            )}
            columns={[
              { title: 'Product', dataIndex: 'productName' },
              { title: 'Price', dataIndex: 'price', align: 'right', render: (value: number) => formatRupiah(value) },
              { title: 'Quantity', dataIndex: 'quantity', align: 'right' },
              {
                title: 'Subtotal',
                dataIndex: 'subtotal',
                align: 'right',
                render: (value: number) => formatRupiah(value),
              },
            ]}
          />
        </Space>
      ) : null}
    </Modal>
  );
}
