'use client';

import { Search, Title } from '@/components/antd-wrapper';
import PaginationTable from '@/components/pagination-table';
import { Alert, App, Button, Flex, Result, Space, Table, Tag } from 'antd';
import { useDeleteUser, useGetUsers } from './hooks/use-users';
import { useQueryParams } from '@/hooks/use-query-params';
import ModalUserForm from '../components/modal-user-form';
import { useState } from 'react';
import { DeleteFilled, EditFilled } from '@ant-design/icons';
import { UserResponse } from '@/models/user';
import { useSession } from 'next-auth/react';
import { useRoleChecking } from '@/hooks/use-auth';

export default function UsersContainer() {
  const { modal, notification } = App.useApp();
  const isHaveAccess = useRoleChecking();
  const { status } = useSession();
  const isAdmin = isHaveAccess('admin');

  const { getParam, setParams } = useQueryParams();
  const pageParam = Number(getParam('page') ?? 1);
  const limitParam = Number(getParam('limit') ?? 10);
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isSafeInteger(limitParam) && limitParam > 0 ? limitParam : 10;
  const search = getParam('search') ?? '';
  const { data, isFetching, error, refetch } = useGetUsers({ page, limit, search }, isAdmin);
  const [isModalFormOpen, setIsModalFormOpen] = useState(false);
  const [userSelected, setUserSelected] = useState<UserResponse>();
  const deleteMutation = useDeleteUser();

  const handleEdit = (user: UserResponse) => {
    setUserSelected(user);
    setIsModalFormOpen(true);
  };

  const handleDelete = (user: UserResponse) => {
    modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete "${user.name}"?`,
      okButtonProps: { danger: true },
      okText: 'Yes',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync(user.id);
          notification.success({ message: 'User deleted' });
          if (data?.data.length === 1 && page > 1) setParams({ page: page - 1 });
        } catch (error) {
          notification.error({ message: error instanceof Error ? error.message : 'Something went wrong' });
          throw error;
        }
      },
    });
  };

  const handleCloseModal = () => {
    setIsModalFormOpen(false);
    setUserSelected(undefined);
  };

  if (status === 'loading') return <Table loading columns={[]} dataSource={[]} />;
  if (!isAdmin) return <Result status="403" title="403" subTitle="Only admins can manage users." />;

  return (
    <div>
      <Title>Users</Title>
      <Flex justify="space-between" wrap gap={12}>
        <Search
          className="pb-12"
          placeholder="Search name or email"
          key={search}
          defaultValue={search}
          allowClear
          style={{ width: 300 }}
          onSearch={(val) => setParams({ search: val, page: 1 })}
        />
        <Button disabled={!isHaveAccess('admin')} type="primary" onClick={() => setIsModalFormOpen(true)}>
          Add user
        </Button>
      </Flex>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error.message}
          action={<Button onClick={() => refetch()}>Retry</Button>}
        />
      )}
      <Table<UserResponse>
        dataSource={data?.data || []}
        bordered
        rowKey="id"
        loading={isFetching}
        pagination={false}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Email', dataIndex: 'email' },
          {
            title: 'Role',
            dataIndex: 'role',
            render: (role) => (
              <Tag color={role === 'admin' ? 'blue' : 'green'}>{role === 'admin' ? 'Admin' : 'Cashier'}</Tag>
            ),
          },
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
                  aria-label={`Edit ${row.name}`}
                  icon={<EditFilled />}
                  onClick={() => handleEdit(row)}
                />
                <Button
                  disabled={!isHaveAccess('admin')}
                  shape="circle"
                  danger
                  aria-label={`Delete ${row.name}`}
                  loading={deleteMutation.isPending && deleteMutation.variables === row.id}
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
        onChange={(nextPage, nextLimit) => setParams({ page: nextLimit !== limit ? 1 : nextPage, limit: nextLimit })}
      />
      <ModalUserForm open={isModalFormOpen} user={userSelected} onClose={handleCloseModal} />
    </div>
  );
}
