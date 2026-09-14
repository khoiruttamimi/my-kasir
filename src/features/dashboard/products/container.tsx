'use client';

import { Search, Title } from '@/components/antd-wrapper';
import PaginationTable from '@/components/pagination-table';
import { Table } from 'antd';
import { useProducts } from './hooks/use-products';
import { useQueryParams } from '@/hooks/use-query-params';

export default function ProductsContainer() {
  const { getParam, setParams } = useQueryParams();
  const page = Math.max(Number(getParam('page')) || 1, 1);
  const limit = Math.max(Number(getParam('limit')) || 10, 10);
  const search = getParam('search') ?? '';

  const { data, isFetching } = useProducts({ page, limit, search });

  return (
    <div>
      <Title>Products</Title>
      <Search
        className="pb-12"
        placeholder="Search"
        defaultValue={search}
        allowClear
        style={{ width: 300 }}
        onSearch={(val) => setParams({ search: val, page: 1 })}
      />
      <Table
        dataSource={data?.data || []}
        bordered
        rowKey="id"
        loading={isFetching}
        pagination={false}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Category', dataIndex: 'category' },
          { title: 'Price', dataIndex: 'price' },
          { title: 'Stock', dataIndex: 'stock' },
        ]}
      />
      <PaginationTable
        page={data?.pagination?.page || page}
        limit={data?.pagination?.limit || limit}
        total={data?.pagination?.total || 0}
        onChange={(page, limit) => setParams({ page, limit })}
      />
    </div>
  );
}
