import { FormItem } from '@/components/antd-wrapper';
import type { Product, CreateProductPayload } from '@/models/product';
import { ApiError } from '@/utils/api';
import { requiredRule } from '@/utils/rules';
import { Alert, App, Button, Form, Input, Modal, Select, Space } from 'antd';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useCreateProduct, useUpdateProduct, useGenerateProductCode } from '../hooks/use-products';

type ModalProductFormType = {
  open: boolean;
  onClose: () => void;
  product?: Product;
};

const ProductFormMount = ({ setMounted }: { setMounted: Dispatch<SetStateAction<boolean>> }) => {
  // Signal connection from inside the lazy Form; hidden Modal children may skip updates.
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, [setMounted]);

  return null;
};

const ModalProductForm = ({ open, onClose, product }: ModalProductFormType) => {
  const [form] = Form.useForm<CreateProductPayload>();
  const { message, modal } = App.useApp();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const generateMutation = useGenerateProductCode();
  const [conflict, setConflict] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [formMounted, setFormMounted] = useState(false);
  const saving = createMutation.isPending || updateMutation.isPending;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const context = useRef({ epoch: 0, request: 0, revision: 0, pending: false, open, productId: product?.id });
  // Invalidate immediately on a render for another form, before effects or old promises run.
  if (context.current.open !== open || context.current.productId !== product?.id) {
    context.current.epoch++;
    context.current.request++;
    context.current.pending = false;
    context.current.open = open;
    context.current.productId = product?.id;
  }

  useEffect(() => {
    if (!open || !formMounted) return;
    form.resetFields();
    if (product) {
      form.setFieldsValue({
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        code: product.code ?? '',
      });
    }
  }, [open, product, form, formMounted]);

  useEffect(() => {
    const current = context.current;
    current.epoch++;
    current.request++;
    current.revision = 0;
    current.pending = false;
    current.open = open;
    current.productId = product?.id;
    setGenerating(false);
    setConflict(undefined);
    return () => {
      current.epoch++;
      current.request++;
      current.open = false;
      current.pending = false;
    };
  }, [open, product]);

  const closeForm = () => {
    context.current.epoch++;
    context.current.request++;
    context.current.open = false;
    context.current.pending = false;
    setGenerating(false);
    setConflict(undefined);
    onClose();
  };

  const handleClose = () => {
    if (!savingRef.current) closeForm();
  };

  const requestCode = async (epoch: number, revision: number) => {
    const current = context.current;
    if (
      !current.open ||
      current.epoch !== epoch ||
      current.revision !== revision ||
      current.pending ||
      savingRef.current
    )
      return;
    const request = ++current.request;
    current.pending = true;
    setGenerating(true);
    const isCurrent = () =>
      context.current.open && context.current.epoch === epoch && context.current.request === request;
    try {
      const result = await generateMutation.mutateAsync();
      if (isCurrent() && context.current.revision === revision) {
        form.setFieldsValue({ code: result.code });
      }
    } catch (error) {
      if (isCurrent() && context.current.revision === revision) {
        message.error(error instanceof Error ? error.message : 'Unable to generate a product code');
      }
    } finally {
      // A superseded response cannot clear the new form/request's loading state.
      if (isCurrent()) {
        context.current.pending = false;
        setGenerating(false);
      }
    }
  };

  const handleGenerate = () => {
    const { epoch, revision, pending } = context.current;
    if (pending || savingRef.current) return;
    if (form.getFieldValue('code')?.trim()) {
      modal.confirm({
        title: 'Replace Product Code?',
        content: 'Generate a new internal code to replace the value currently entered?',
        okText: 'Generate',
        onOk: () => requestCode(epoch, revision),
      });
      return;
    }
    return requestCode(epoch, revision);
  };

  const handleSubmit = async (values: CreateProductPayload) => {
    if (context.current.pending || savingRef.current) return;
    const payload = { ...values, code: values.code.trim() };
    setConflict(undefined);
    try {
      if (product) {
        await updateMutation.mutateAsync({ ...payload, id: product.id });
        message.success('Product updated');
      } else {
        await createMutation.mutateAsync(payload);
        message.success('Product created');
      }
      closeForm();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.message === 'Product code is already in use') {
        form.setFields([{ name: 'code', errors: [error.message] }]);
      } else if (error instanceof ApiError && error.status === 409) {
        setConflict(error.message);
      }
      message.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  const handleValidate = () => {
    if (context.current.pending || savingRef.current) return;
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
      title={product ? 'Edit Product' : 'Add New Product'}
      maskClosable={false}
      onOk={handleValidate}
      confirmLoading={saving}
      okButtonProps={{ disabled: generating || saving }}
      cancelButtonProps={{ disabled: saving }}
      closable={!saving}
      keyboard={!saving}
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={handleSubmit}
        disabled={saving}
        onValuesChange={(changed: Partial<CreateProductPayload>) => {
          if ('code' in changed) context.current.revision++;
        }}
      >
        <ProductFormMount setMounted={setFormMounted} />
        {conflict && <Alert type="error" showIcon message={conflict} className="mb-12" />}
        <FormItem
          label="Product Code"
          htmlFor="product-code"
          extra={
            <>
              <div>Generated codes are for internal MyKasir use only and are not GS1-assigned GTINs.</div>
              {product?.code === null && (
                <div>This product has no Product Code. Assign a unique code before saving any changes.</div>
              )}
            </>
          }
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="code"
              noStyle
              rules={[
                { required: true, whitespace: true, message: 'Product Code is required' },
                {
                  pattern: /^[A-Za-z0-9]{1,100}$/,
                  transform: (value: string) => value?.trim(),
                  message: 'Product Code must contain 1-100 letters or digits',
                },
              ]}
            >
              <Input id="product-code" placeholder="Enter product code" />
            </Form.Item>
            <Button htmlType="button" onClick={handleGenerate} loading={generating} disabled={generating || saving}>
              Generate
            </Button>
          </Space.Compact>
        </FormItem>
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
