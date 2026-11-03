import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { loadSource } from '../../../../../tests/helpers/load-source';
import { ApiError, id, otherId, input } from '../../../../../tests/helpers/product-fixture';

type FormValues = Partial<import('@/models/product').CreateProductPayload>;
type FieldError = { name: string; errors: string[] };
type FormProps = {
  open: boolean;
  onClose: () => void;
  product?: Omit<FormValues, 'code'> & { id: string; code: string | null };
};
type ElementNode = {
  type: string | ((props: ElementProps) => unknown); // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
  props: ElementProps;
};
type ElementProps = {
  children?: unknown;
  label?: string;
  extra?: unknown;
  message?: string;
  open?: boolean;
  forceRender?: boolean;
  okButtonProps: { disabled: boolean };
  onCancel: () => void;
  onClick: () => Promise<void>;
  onFinish: (values: FormValues) => Promise<void>; // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
  onValuesChange: (values: FormValues) => void; // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
};
function isElement(node: unknown): node is ElementNode {
  return !!node && typeof node === 'object' && 'type' in node && 'props' in node;
}
function productFormHarness() {
  const states: unknown[] = [],
    setters: ((value: unknown) => void)[] = [], // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
    refs: { current: unknown }[] = [],
    effects: { deps: unknown[]; cleanup?: void | (() => void) }[] = [];
  let cursor = 0,
    refCursor = 0,
    effectCursor = 0,
    tree: ElementNode,
    props: FormProps = {
      open: true,
      onClose: () => {
        closed++;
      },
    };
  let closed = 0,
    requests = 0,
    confirmation: { onOk: () => Promise<void> } | undefined;
  const pending: { resolve: (value: { code: string }) => void; reject: (error: unknown) => void }[] = []; // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
  const formCalls: string[] = [];
  const effectJobs: (() => void)[] = [];
  let formMounted = false;
  let stateChanged = false;
  const form = {
    values: {} as FormValues,
    errors: [] as FieldError[],
    resetFields() {
      assert.ok(formMounted, 'resetFields requires a mounted Form');
      formCalls.push('reset');
      this.values = {};
      this.errors = [];
    },
    setFieldsValue(value: FormValues) {
      assert.ok(formMounted, 'setFieldsValue requires a mounted Form');
      formCalls.push('prefill');
      Object.assign(this.values, value);
    },
    setFields(value: FieldError[]) {
      this.errors = value;
    },
    getFieldValue(name: keyof FormValues) {
      return this.values[name];
    },
    validateFields: async () => form.values,
    submit() {},
    scrollToField() {},
  };
  const Form = Object.assign(function Form() {}, {
    useForm: () => [form],
    useFormInstance: () => {
      assert.ok(formMounted, 'form context requires a mounted Form');
      return form;
    },
    Item: 'FormItem',
  });
  const react = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      setters[index] ??= (value) => {
        const next = typeof value === 'function' ? value(states[index]) : value;
        if (!Object.is(states[index], next)) stateChanged = true;
        states[index] = next;
      };
      return [states[index], setters[index]];
    },
    useRef(initial: unknown) {
      const index = refCursor++;
      return refs[index] ?? (refs[index] = { current: initial });
    },
    useEffect(callback: () => void | (() => void), deps: unknown[]) {
      const index = effectCursor++;
      const previous = effects[index];
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
        effectJobs.push(() => {
          if (typeof previous?.cleanup === 'function') previous.cleanup();
          effects[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const mutation = { isPending: false, mutateAsync: async () => ({}) };
  const generate = {
    isPending: false,
    mutateAsync: () => {
      requests++;
      return new Promise<{ code: string }>((resolve, reject) => pending.push({ resolve, reject }));
    },
  };
  const { default: Component } = loadSource<{ default: (props: FormProps) => ElementNode }>( // eslint-disable-line no-unused-vars -- Parameter names document test callback types.
    'src/features/dashboard/products/components/modal-product-form.tsx',
    {
      react,
      '@/components/antd-wrapper': { FormItem: 'FormItem' },
      '@/utils/api': { ApiError },
      '@/utils/rules': { requiredRule: {} },
      antd: {
        Form,
        Alert: 'Alert',
        Input: 'Input',
        Button: 'Button',
        Modal: 'Modal',
        Select: 'Select',
        Space: { Compact: 'Compact' },
        App: {
          useApp: () => ({
            message: { success() {}, error() {} },
            modal: {
              confirm: (value: { onOk: () => Promise<void> }) => {
                confirmation = value;
              },
            },
          }),
        },
      },
      '../hooks/use-products': {
        useCreateProduct: () => mutation,
        useUpdateProduct: () => mutation,
        useGenerateProductCode: () => generate,
      },
    },
  );
  function render(next: Partial<FormProps> = {}, { mountForm = true } = {}) {
    props = { ...props, ...next };
    let commits = 0;
    do {
      assert.ok(commits++ < 20, 'form effects must settle');
      stateChanged = false;
      cursor = refCursor = effectCursor = 0;
      tree = Component(props);
      const parentJobs = effectJobs.splice(0);
      // rc-dialog retains mounted children but skips their updates while hidden.
      if (mountForm && props.open) {
        formMounted = true;
        const lifecycle = search(
          (node) => typeof node.type === 'function' && node.type.name === 'ProductFormMount',
          tree,
        );
        if (lifecycle && typeof lifecycle.type === 'function') lifecycle.type(lifecycle.props);
      }
      effectJobs.splice(0).forEach((job) => job());
      parentJobs.forEach((job) => job());
    } while (stateChanged);
    return tree;
  }
  // eslint-disable-next-line no-unused-vars -- Parameter names document test callback types.
  function search(predicate: (node: ElementNode) => boolean, node: unknown): ElementNode | undefined {
    if (Array.isArray(node)) {
      for (const child of node) {
        const result = search(predicate, child);
        if (result) return result;
      }
    }
    if (!isElement(node)) return undefined;
    return predicate(node) ? node : search(predicate, node.props.children);
  }
  // eslint-disable-next-line no-unused-vars -- Parameter names document test callback types.
  function find(predicate: (node: ElementNode) => boolean): ElementNode {
    const result = search(predicate, tree);
    assert.ok(result, 'expected element must exist');
    return result;
  }
  const edit = (value: string) => {
    form.values.code = value;
    find((node) => node.type === Form).props.onValuesChange({ code: value });
  };
  return {
    render,
    find,
    edit,
    form,
    formCalls,
    pending,
    mutation,
    generate: () => find((node) => node.type === 'Button' && node.props.children === 'Generate').props.onClick(),
    confirm: () => confirmation?.onOk(),
    get requests() {
      return requests;
    },
    get confirmation() {
      return confirmation;
    },
    get closed() {
      return closed;
    },
    close: () => tree.props.onCancel(),
    unmount: () => {
      effects.forEach((effect) => typeof effect.cleanup === 'function' && effect.cleanup());
      formMounted = false;
    },
  };
}

test('form waits for lazy mounting and resets Create/Edit values on every reopen', () => {
  const h = productFormHarness();
  const product = { id: 'p1', name: 'Original', category: 'Makanan', price: 1000, stock: 2, code: 'Original001' };
  const modal = h.render({ open: false });
  expect(modal.props.forceRender).toBe(undefined);
  expect(h.formCalls).toStrictEqual([]);
  h.render({ open: true, product }, { mountForm: false });
  expect(h.formCalls).toStrictEqual([]);
  h.render();
  expect(h.form.values).toStrictEqual({
    name: 'Original',
    category: 'Makanan',
    price: 1000,
    stock: 2,
    code: 'Original001',
  });
  h.edit('Unsaved');
  h.form.values.name = 'Unsaved name';
  h.form.setFields([{ name: 'code', errors: ['Duplicate'] }]);
  h.close();
  h.render({ open: false });
  h.render({ open: true });
  expect(h.form.values.code).toBe('Original001');
  expect(h.form.values.name).toBe('Original');
  expect(h.form.errors).toStrictEqual([]);
  h.render({ open: false });
  h.render({ open: true, product: undefined });
  expect(h.form.values).toStrictEqual({});
  h.edit('UnsavedCreate');
  h.render({ open: false });
  h.render({ open: true });
  expect(h.form.values).toStrictEqual({});
  h.render({ product: { ...product, id: 'legacy', code: null } });
  expect(h.form.values.code).toBe('');
});

test('form generates only on click, confirms populated replacement, and never saves during generation', async () => {
  const h = productFormHarness();
  h.render();
  expect(h.requests).toBe(0);
  const promise = h.generate();
  h.render();
  expect(h.requests).toBe(1);
  expect(h.find((node) => node.type === 'Modal').props.okButtonProps.disabled).toBe(true);
  h.pending[0].resolve({ code: '2000000000008' });
  await promise;
  h.render();
  expect(h.form.values.code).toBe('2000000000008');
  h.generate();
  assert.ok(h.confirmation);
  expect(h.requests).toBe(1);
  const replacement = h.confirm();
  h.pending[1].resolve({ code: '2000000000015' });
  await replacement;
  expect(h.form.values.code).toBe('2000000000015');
  expect(h.closed).toBe(0);
});

test('Product Code guidance explains internal generation and legacy assignment only when needed', () => {
  const h = productFormHarness();
  const extraText = () => {
    const extra = h.find((node) => node.props?.label === 'Product Code').props.extra;
    const text = (node: unknown): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(text).join(' ');
      return isElement(node) ? text(node.props.children) : '';
    };
    return text(extra);
  };
  h.render();
  expect(extraText()).toMatch(/Generated codes are for internal MyKasir use only and are not GS1-assigned GTINs/);
  expect(extraText()).not.toMatch(/Assign a unique code/);
  h.render({ product: { ...input(), id, code: null } });
  expect(extraText()).toMatch(/This product has no Product Code. Assign a unique code before saving any changes/);
  h.render({ product: { ...input(), id } });
  expect(extraText()).not.toMatch(/Assign a unique code/);
});

test('form ignores generation results after manual code edits, closing, switching products, and unmount', async () => {
  for (const change of ['edit', 'close', 'switch', 'unmount']) {
    const h = productFormHarness();
    h.render();
    const promise = h.generate();
    if (change === 'edit') h.edit('Manual001');
    if (change === 'close') h.close();
    if (change === 'switch') h.render({ product: { ...input('Other001'), id: otherId } });
    if (change === 'unmount') h.unmount();
    h.pending[0].resolve({ code: '2000000000008' });
    await promise;
    expect(h.form.values.code).not.toBe('2000000000008');
    if (change === 'edit') expect(h.form.values.code).toBe('Manual001');
    if (change === 'switch') expect(h.form.values.code).toBe('Other001');
  }
});

test('form keeps input on failure and ignores outdated confirmations and pending responses from another form', async () => {
  const h = productFormHarness();
  h.render();
  h.edit('Original001');
  h.generate();
  h.edit('NewManual001');
  await h.confirm();
  expect(h.requests).toBe(0);
  h.generate();
  const promise = h.confirm();
  h.pending[0].reject(new ApiError('Generation unavailable', 503));
  await promise;
  expect(h.form.values.code).toBe('NewManual001');
  h.render();
  h.edit('');
  const old = h.generate();
  h.render({ product: { ...input(), id: otherId, code: null } });
  const next = h.generate();
  h.render();
  h.pending[1].resolve({ code: '2000000000015' });
  await old;
  h.render();
  expect(h.find((node) => node.type === 'Modal').props.okButtonProps.disabled).toBe(true);
  h.pending[2].resolve({ code: '2000000000022' });
  await next;
  expect(h.form.values.code).toBe('2000000000022');
});

test('form retains entries on duplicate and assignment conflicts, and does not retry automatically', async () => {
  for (const message of [
    'Product code is already in use',
    'Product Code was assigned by another request. Refresh and retry manually.',
  ]) {
    const h = productFormHarness();
    const tree = h.render({ product: { ...input(), id } });
    let attempts = 0;
    h.mutation.mutateAsync = async () => {
      attempts++;
      throw new ApiError(message, 409);
    };
    h.edit('Manual001');
    const formNode = h.find((node) => !!node.props?.onFinish);
    await formNode.props.onFinish({ ...input(), code: 'Manual001' });
    h.render();
    expect(attempts).toBe(1);
    expect(h.closed).toBe(0);
    expect(h.form.values.code).toBe('Manual001');
    if (message.startsWith('Product code is')) expect(h.form.errors[0].errors).toStrictEqual([message]);
    else expect(h.find((node) => node.type === 'Alert').props.message).toBe(message);
    assert.ok(tree.props.open);
  }
});
