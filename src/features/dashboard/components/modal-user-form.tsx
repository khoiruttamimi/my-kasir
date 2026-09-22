import { FormItem } from '@/components/antd-wrapper';
import type { UserResponse, UserRole } from '@/models/user';
import { App, Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { useCreateUser, useUpdateUser } from '../users/hooks/use-users';

type UserFormValues = { name: string; email: string; role: UserRole; password?: string };
type ModalUserFormProps = { open: boolean; onClose: () => void; user?: UserResponse };

export default function ModalUserForm({ open, onClose, user }: ModalUserFormProps) {
  const [form] = Form.useForm<UserFormValues>();
  const { message } = App.useApp();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(user ? { name: user.name, email: user.email, role: user.role } : { role: 'cashier' });
    }
  }, [open, user, form]);

  const handleClose = () => {
    if (isPending) return;
    form.resetFields();
    onClose();
  };

  const handleSubmit = async (values: UserFormValues) => {
    const payload = { name: values.name.trim(), email: values.email.trim(), role: values.role };
    try {
      if (user) {
        await updateMutation.mutateAsync({
          ...payload,
          id: user.id,
          ...(values.password ? { password: values.password } : {}),
        });
        message.success('User updated');
      } else {
        await createMutation.mutateAsync({ ...payload, password: values.password! });
        message.success('User created');
      }
      form.resetFields();
      onClose();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  return (
    <Modal
      centered
      open={open}
      onCancel={handleClose}
      title={user ? 'Edit User' : 'Add New User'}
      maskClosable={false}
      onOk={() => form.submit()}
      confirmLoading={isPending}
      cancelButtonProps={{ disabled: isPending }}
      closable={!isPending}
      keyboard={!isPending}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit} disabled={isPending}>
        <FormItem label="Name" name="name" rules={[{ required: true, whitespace: true, message: 'Name is required' }]}>
          <Input placeholder="Enter name" autoComplete="name" />
        </FormItem>
        <FormItem
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Enter a valid email', transform: (value: string) => value?.trim() },
          ]}
        >
          <Input placeholder="Enter email" autoComplete="email" />
        </FormItem>
        <FormItem label="Role" name="role" rules={[{ required: true, message: 'Role is required' }]}>
          <Select
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Cashier', value: 'cashier' },
            ]}
          />
        </FormItem>
        <FormItem
          label="Password"
          name="password"
          extra={user ? 'Leave blank to keep the current password.' : undefined}
          rules={[
            { required: !user, whitespace: true, message: 'Password must not be blank' },
            {
              validator: async (_, value?: string) => {
                if (value && new TextEncoder().encode(value).length > 72)
                  throw new Error('Password must not exceed 72 bytes');
              },
            },
          ]}
        >
          <Input.Password
            placeholder={user ? 'Enter new password (optional)' : 'Enter password'}
            autoComplete="new-password"
          />
        </FormItem>
      </Form>
    </Modal>
  );
}
