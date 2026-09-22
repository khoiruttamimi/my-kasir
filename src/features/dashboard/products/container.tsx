'use client';

import { Search, Title } from '@/components/antd-wrapper';
import PaginationTable from '@/components/pagination-table';
import { App, Button, Flex, Space, Table } from 'antd';
import { useDeleteProduct, useGetProducts } from './hooks/use-products';
import { useQueryParams } from '@/hooks/use-query-params';
import ModalProductForm from '../components/modal-product-form';
import { useState } from 'react';
import { DeleteFilled, EditFilled } from '@ant-design/icons';
import { Product } from '@/models/product';
import { useRoleChecking } from '@/hooks/use-auth';
import { formatRupiah } from '@/utils/format-money';

export default function ProductsContainer() {
  const { modal, notification } = App.useApp();
  const isHaveAccess = useRoleChecking();

  const { getParam, setParams } = useQueryParams();
  const page = Math.max(Number(getParam('page')) || 1, 1);
  const limit = Math.max(Number(getParam('limit')) || 10, 10);
  const search = getParam('search') ?? '';
  const { data, isFetching } = useGetProducts({ page, limit, search });
  const [isModalFormOpen, setIsModalFormOpen] = useState(false);
  const [productSelected, setProductSelected] = useState<Product>();
  const deleteMutation = useDeleteProduct();

  const handleEdit = (product: Product) => {
    setProductSelected(product);
    setIsModalFormOpen(true);
  };

  const handleDelete = (product: Product) => {
    modal.confirm({
      title: 'Delete Product',
      content: `Are you sure you want to delete "${product.name}"?`,
      okButtonProps: { danger: true },
      okText: 'Yes',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync(product.id);
          notification.success({ message: 'Product deleted' });
        } catch (error) {
          notification.error({ message: error instanceof Error ? error.message : 'Something went wrong' });
        }
      },
    });
  };

  const handleCloseModal = () => {
    setIsModalFormOpen(false);
    setProductSelected(undefined);
  };

  return (
    <div>
      <Title>Products</Title>
      <Flex justify="space-between">
        <Search
          className="pb-12"
          placeholder="Search"
          defaultValue={search}
          allowClear
          style={{ width: 300 }}
          onSearch={(val) => setParams({ search: val, page: 1 })}
        />
        <Button disabled={!isHaveAccess('admin')} type="primary" onClick={() => setIsModalFormOpen(true)}>
          Add product
        </Button>
      </Flex>
      <Table
        dataSource={data?.data || []}
        bordered
        rowKey="id"
        loading={isFetching}
        pagination={false}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Category', dataIndex: 'category' },
          { title: 'Price', dataIndex: 'price', render: (price: number) => formatRupiah(price) },
          { title: 'Stock', dataIndex: 'stock' },
          {
            title: 'Action',
            dataIndex: 'action',
            render: (_, row) => (
              <Space>
                <Button
                  disabled={!isHaveAccess('admin')}
                  shape="circle"
                  color="primary"
                  variant="outlined"
                  icon={<EditFilled />}
                  onClick={() => handleEdit(row)}
                />
                <Button
                  disabled={!isHaveAccess('admin')}
                  shape="circle"
                  danger
                  icon={<DeleteFilled />}
                  onClick={() => handleDelete(row)}
                />
              </Space>
            ),
          },
        ]}
      />
      <PaginationTable
        page={data?.pagination?.page || page}
        limit={data?.pagination?.limit || limit}
        total={data?.pagination?.total || 0}
        onChange={(page, limit) => setParams({ page, limit })}
      />
      <ModalProductForm open={isModalFormOpen} product={productSelected} onClose={handleCloseModal} />
    </div>
  );
}
