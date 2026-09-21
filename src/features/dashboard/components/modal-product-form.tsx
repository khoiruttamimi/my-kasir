import { FormItem } from '@/components/antd-wrapper';
import { Product } from '@/models/product';
import { requiredRule } from '@/utils/rules';
import { App, Form, Input, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { useCreateProduct, useUpdateProduct } from '../products/hooks/use-products';

type ModalProductFormType = {
  open: boolean;
  onClose: () => void;
  product?: Product;
};

const ModalProductForm = ({ open, onClose, product }: ModalProductFormType) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  useEffect(() => {
    if (open) {
      form.setFieldsValue(product);
    }
  }, [open, product, form]);

  const handleClose = () => {
    onClose();
    form.resetFields();
  };

  const handleSubmit = async (values: Product) => {
    try {
      if (product) {
        await updateMutation.mutateAsync({ ...values, id: product.id });

        message.success('Product updated');
      } else {
        await createMutation.mutateAsync(values);

        message.success('Product created');
      }

      handleClose();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  const handleValidate = () => {
    form
      .validateFields()
      .then(form.submit)
      .catch((err) => form.scrollToField(err?.errorFields?.[0]?.name, { behavior: 'smooth', block: 'center' }));
  };

  return (
    <Modal
      centered
      open={open}
      onCancel={handleClose}
      title="Add New Product"
      maskClosable={false}
      onOk={handleValidate}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <FormItem label="Product Name" name="name" rules={[requiredRule]}>
          <Input placeholder="Enter here" />
        </FormItem>
        <FormItem label="Category" name="category" rules={[requiredRule]}>
          <Select
            placeholder="Select category"
            options={[
              { label: 'Makanan', value: 'Makanan' },
              { label: 'Minuman', value: 'Minuman' },
            ]}
          />
        </FormItem>
        <FormItem label="Price" name="price" rules={[requiredRule]}>
          <Input placeholder="Enter here" />
        </FormItem>
        <FormItem label="Stock" name="stock" rules={[requiredRule]}>
          <Input placeholder="Enter here" />
        </FormItem>
      </Form>
    </Modal>
  );
};

export default ModalProductForm;
