import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const requireDependency = createRequire(import.meta.url);
function loadSource(file, dependencies = {}) {
  const loaded = new Module(path.resolve(file));
  loaded.require = (name) => (name in dependencies ? dependencies[name] : requireDependency(name));
  loaded._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2017,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    path.resolve(file),
  );
  return loaded.exports;
}
const { ApiError } = loadSource('src/utils/api.ts');
const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const input = (code = 'AbC001') => ({ name: 'Tea', category: 'Minuman', price: 10000, stock: 5, code });
function setup(options = {}) {
  const records = options.records ?? [];
  const calls = { inserts: 0, updates: 0, generated: 0, lookup: [] };
  const repository = {
    nextProductCodeValue: async () => {
      const position = calls.generated++;
      if (options.sequenceFailure) throw options.sequenceFailure;
      return options.sequence ? (options.sequence[position] ?? null) : String(position);
    },
    findProducts: async () => ({ data: records.filter((row) => !row.deletedAt), pagination: {} }),
    findProductById: async (productId) => records.find((row) => row.id === productId && !row.deletedAt) ?? null,
    findProductByCode: async (code, excludeId) => {
      calls.lookup.push({ code, excludeId });
      return records.find((row) => row.id !== excludeId && row.code?.toLowerCase() === code.toLowerCase()) ?? null;
    },
    insertProduct: async (data) => {
      calls.inserts++;
      if (options.failure) throw options.failure;
      const row = { ...data, id };
      records.push(row);
      return row;
    },
    updateProductById: async (productId, data) => {
      calls.updates++;
      if (options.failure) throw options.failure;
      if (options.guardedMiss) {
        options.afterMiss?.(records);
        return null;
      }
      const row = records.find((entry) => entry.id === productId && !entry.deletedAt);
      if (!row || (data.code === undefined && row.code === null)) return null;
      Object.assign(row, data);
      return row;
    },
    deleteProductById: async (productId) => {
      const row = records.find((entry) => entry.id === productId && !entry.deletedAt);
      if (!row) return null;
      row.deletedAt = '2026-10-14';
      return row;
    },
  };
  const service = loadSource('src/server/services/product.service.ts', {
    'server-only': {},
    '@/utils/api': { ApiError },
    '../repositories/product.repository': repository,
    '../utils/product-code': fs.existsSync('src/server/utils/product-code.ts')
      ? loadSource('src/server/utils/product-code.ts')
      : {},
  });
  return { service, records, calls };
}
const status = (value, message) => (error) =>
  error instanceof ApiError && error.status === value && (message === undefined || error.message === message);

test('manual code strings preserve case and zeros, trim outside whitespace, accept 1 and 100 characters', async () => {
  for (const [source, expected] of [
    [' AbC001 ', 'AbC001'],
    ['0012345678905', '0012345678905'],
    ['123', '123'],
    ['A', 'A'],
    ['Z'.repeat(100), 'Z'.repeat(100)],
  ]) {
    const { service } = setup();
    assert.equal((await service.createProduct(input(source))).code, expected);
  }
});

test('new products require a string code with ASCII characters and length limits before insertion', async () => {
  for (const code of [undefined, null, 123, '', '  ', 'A B', 'A-1', 'é', 'A'.repeat(101)]) {
    const { service, calls } = setup();
    const body = { ...input(), code };
    if (code === undefined) delete body.code;
    await assert.rejects(service.createProduct(body), status(400));
    assert.equal(calls.inserts, 0);
  }
});

test('case-insensitive and soft-deleted code owners prevent new products', async () => {
  for (const deletedAt of [null, '2026-01-01']) {
    const { service, calls } = setup({ records: [{ ...input('abc001'), id: otherId, deletedAt }] });
    await assert.rejects(service.createProduct(input()), status(409, 'Product code is already in use'));
    assert.equal(calls.inserts, 0);
  }
});

test('maps only the named unique-index race through nested/cyclic causes and preserves unexpected errors', async () => {
  const conflict = new Error('query failed', {
    cause: { cause: { code: '23505', constraint: 'products_code_unique' } },
  });
  await assert.rejects(
    setup({ failure: conflict }).service.createProduct(input()),
    status(409, 'Product code is already in use'),
  );
  for (const failure of [
    new Error('offline'),
    { code: '23505', constraint: 'unrelated_index' },
    { code: '08006', constraint: 'products_code_unique' },
  ]) {
    await assert.rejects(setup({ failure }).service.createProduct(input()), (error) => error === failure);
  }
  const cyclic = { message: 'cycle' };
  cyclic.cause = cyclic;
  await assert.rejects(setup({ failure: cyclic }).service.createProduct(input()), (error) => error === cyclic);
});

test('existing collection routes preserve create/list envelopes and validation statuses without live auth/database', async () => {
  const { service } = setup();
  let session = { user: { id, role: 'admin' } };
  const { withAuth } = loadSource('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => session },
  });
  const responses = loadSource('src/server/utils/api.ts', { '@/utils/api': { ApiError } });
  const route = loadSource('src/app/api/products/route.ts', {
    '@/server/services/product.service': service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  });
  const request = (body) =>
    new Request('http://localhost/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const created = await route.POST(request(input()));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).code, 'AbC001');
  const duplicate = await route.POST(request(input('abc001')));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { message: 'Product code is already in use' });
  const invalid = await route.POST(request({ ...input(), code: '' }));
  assert.equal(invalid.status, 400);
  const list = await route.GET({ nextUrl: new URL('http://localhost/api/products') });
  const result = await list.json();
  assert.equal(list.status, 200);
  assert.equal(result.data[0].code, 'AbC001');
  assert.ok('pagination' in result);
  session = null;
  const unauthorized = await route.POST(request(input('other')));
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(await unauthorized.json(), { message: 'Unauthorized' });
});

test('coded edits preserve omitted codes, allow self-code and release replaced codes', async () => {
  const row = { ...input(), id };
  const { service, calls } = setup({ records: [row] });
  assert.equal((await service.updateProduct(id, { name: 'New name' })).code, 'AbC001');
  assert.equal((await service.updateProduct(id, { code: ' AbC001 ' })).code, 'AbC001');
  assert.equal((await service.updateProduct(id, { code: 'New001' })).id, id);
  assert.equal(row.stock, 5);
  assert.equal((await service.createProduct(input('AbC001'))).code, 'AbC001');
  assert.equal(calls.lookup[0].excludeId, id);
});

test('edit duplicates and invalid clearing fail without changing other product fields', async () => {
  for (const deletedAt of [null, '2026-01-01']) {
    const row = { ...input('Own001'), id };
    const before = { ...row };
    const { service, calls } = setup({ records: [row, { ...input('Taken001'), id: otherId, deletedAt }] });
    await assert.rejects(
      service.updateProduct(id, { code: ' taken001 ', name: 'Wrong' }),
      status(409, 'Product code is already in use'),
    );
    for (const code of ['', '  ', null, 123, 'A B', 'A'.repeat(101)]) {
      await assert.rejects(service.updateProduct(id, { code, name: 'Wrong' }), status(400));
    }
    assert.deepEqual(row, before);
    assert.equal(calls.updates, 0);
  }
});

test('edit translates only the named index conflict, preserving original data', async () => {
  const row = { ...input(), id };
  const before = { ...row };
  const conflict = new Error('query failed', { cause: { code: '23505', constraint: 'products_code_unique' } });
  await assert.rejects(
    setup({ records: [row], failure: conflict }).service.updateProduct(id, { code: 'New001' }),
    status(409, 'Product code is already in use'),
  );
  assert.deepEqual(row, before);
  const failure = new Error('offline');
  await assert.rejects(
    setup({ records: [row], failure }).service.updateProduct(id, { name: 'New' }),
    (error) => error === failure,
  );
});

test('guarded omitted-code miss distinguishes uncoded 400, missing/deleted 404, and assigned 409 without retry', async () => {
  const row = { ...input(), id, code: null };
  const first = setup({ records: [row] });
  await assert.rejects(first.service.updateProduct(id, { name: 'Wrong' }), status(400, 'Product Code is required'));
  assert.equal(row.name, 'Tea');
  assert.equal(first.calls.updates, 1);
  for (const records of [[], [{ ...input(), id, deletedAt: '2026-01-01' }]]) {
    const missing = setup({ records });
    assert.equal(await missing.service.updateProduct(id, { name: 'Wrong' }), null);
    assert.equal(missing.calls.updates, 1);
  }
  const race = setup({
    records: [row],
    guardedMiss: true,
    afterMiss: (records) => {
      records[0].code = 'Concurrent001';
      records[0].name = 'Committed name';
    },
  });
  await assert.rejects(
    race.service.updateProduct(id, { name: 'Wrong' }),
    status(409, 'Product Code was assigned by another request. Refresh and retry manually.'),
  );
  assert.equal(race.calls.updates, 1);
  assert.equal(row.code, 'Concurrent001');
  assert.equal(row.name, 'Committed name');
});

test('legacy reads remain usable, assignment is required on edits, and deletion does not require a code', async () => {
  const row = { ...input(), id, code: null, createdAt: '2025-01-01', stock: 5 };
  const { service } = setup({ records: [row] });
  assert.equal((await service.getProductById(id)).code, null);
  assert.equal((await service.getProducts()).data[0].code, null);
  await assert.rejects(service.updateProduct(id, { name: 'Tea changed' }), status(400));
  assert.equal(row.name, 'Tea');
  const updated = await service.updateProduct(id, { code: 'Legacy001' });
  assert.equal(updated.id, id);
  assert.equal(updated.stock, 5);
  assert.equal(updated.createdAt, '2025-01-01');
  assert.equal((await service.updateProduct(id, { name: 'Tea changed' })).code, 'Legacy001');
  await assert.rejects(service.updateProduct(id, { code: '' }), status(400));
  const uncoded = setup({ records: [{ ...input(), id: otherId, code: null }] });
  assert.equal((await uncoded.service.deleteProduct(otherId)).code, null);
});

test('legacy duplicate assignment rejects the whole edit without losing saved business fields', async () => {
  const row = { ...input(), id, code: null };
  const before = { ...row };
  const { service, calls } = setup({ records: [row, { ...input('Taken001'), id: otherId }] });
  await assert.rejects(service.updateProduct(id, { code: 'TAKEN001', name: 'Wrong', stock: 10 }), status(409));
  assert.deepEqual(row, before);
  assert.equal(calls.updates, 0);
});

test('internal checksum helper pads range boundaries, handles a zero check digit, and rejects out-of-range values', () => {
  const { formatInternalProductCode } = loadSource('src/server/utils/product-code.ts');
  assert.equal(formatInternalProductCode('0'), '2000000000008');
  assert.equal(formatInternalProductCode('6'), '2000000000060');
  for (const value of ['0', '6', '9999999999']) {
    const code = formatInternalProductCode(value);
    assert.match(code, /^20\d{11}$/);
    assert.equal([...code].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10, 0);
  }
  for (const value of ['-1', '10000000000', '1.5', 'NaN', '', ' 1 ']) {
    assert.throws(() => formatInternalProductCode(value));
  }
});

test('generation returns an unreserved unused candidate, skips deleted owners, and writes no product', async () => {
  const { service, calls } = setup({ records: [{ ...input('2000000000008'), id, deletedAt: '2026-01-01' }] });
  const code = await service.generateProductCode();
  assert.equal(code, '2000000000015');
  assert.equal(calls.generated, 2);
  assert.equal(calls.inserts, 0);
  assert.equal(calls.updates, 0);
});

test('generation distinguishes 32 occupied attempts, sequence exhaustion, and unexpected errors', async () => {
  const repeated = setup({ records: [{ ...input('2000000000008'), id }], sequence: Array(32).fill('0') });
  await assert.rejects(
    repeated.service.generateProductCode(),
    status(503, 'Unable to generate an unused product code. Try again or enter a code manually.'),
  );
  assert.equal(repeated.calls.generated, 32);
  const exhausted = setup({ sequence: [] });
  await assert.rejects(
    exhausted.service.generateProductCode(),
    status(503, 'Internal product code generation range is exhausted. Enter a code manually.'),
  );
  assert.equal(exhausted.calls.generated, 1);
  const failure = new Error('connection failed');
  await assert.rejects(setup({ sequenceFailure: failure }).service.generateProductCode(), (error) => error === failure);
});

function productFormHarness() {
  const states = [],
    setters = [],
    refs = [],
    effects = [];
  let cursor = 0,
    refCursor = 0,
    effectCursor = 0,
    tree,
    props = {
      open: true,
      onClose: () => {
        closed++;
      },
    };
  let closed = 0,
    requests = 0,
    confirmation;
  const pending = [];
  const formCalls = [];
  const effectJobs = [];
  let formMounted = false;
  let stateChanged = false;
  const form = {
    values: {},
    errors: [],
    resetFields() {
      assert.ok(formMounted, 'resetFields requires a mounted Form');
      formCalls.push('reset');
      this.values = {};
      this.errors = [];
    },
    setFieldsValue(value) {
      assert.ok(formMounted, 'setFieldsValue requires a mounted Form');
      formCalls.push('prefill');
      Object.assign(this.values, value);
    },
    setFields(value) {
      this.errors = value;
    },
    getFieldValue(name) {
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
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      setters[index] ??= (value) => {
        const next = typeof value === 'function' ? value(states[index]) : value;
        if (!Object.is(states[index], next)) stateChanged = true;
        states[index] = next;
      };
      return [states[index], setters[index]];
    },
    useRef(initial) {
      const index = refCursor++;
      return refs[index] ?? (refs[index] = { current: initial });
    },
    useEffect(callback, deps) {
      const index = effectCursor++;
      const previous = effects[index];
      if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
        effectJobs.push(() => {
          previous?.cleanup?.();
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
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    },
  };
  const { default: Component } = loadSource('src/features/dashboard/products/components/modal-product-form.tsx', {
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
            confirm: (value) => {
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
  });
  function render(next = {}, { mountForm = true } = {}) {
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
        const lifecycle = find((node) => typeof node.type === 'function' && node.type.name === 'ProductFormMount');
        if (lifecycle) lifecycle.type(lifecycle.props);
      }
      effectJobs.splice(0).forEach((job) => job());
      parentJobs.forEach((job) => job());
    } while (stateChanged);
    return tree;
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) return node.map((child) => find(predicate, child ?? null)).find(Boolean);
    if (predicate(node)) return node;
    return find(predicate, node.props?.children ?? null);
  }
  const edit = (value) => {
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
      effects.forEach((effect) => effect.cleanup?.());
      formMounted = false;
    },
  };
}

test('form waits for lazy mounting and resets Create/Edit values on every reopen', () => {
  const h = productFormHarness();
  const product = { id: 'p1', name: 'Original', category: 'Makanan', price: 1000, stock: 2, code: 'Original001' };
  const modal = h.render({ open: false });
  assert.equal(modal.props.forceRender, undefined);
  assert.deepEqual(h.formCalls, []);
  h.render({ open: true, product }, { mountForm: false });
  assert.deepEqual(h.formCalls, []);
  h.render();
  assert.deepEqual(h.form.values, {
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
  assert.equal(h.form.values.code, 'Original001');
  assert.equal(h.form.values.name, 'Original');
  assert.deepEqual(h.form.errors, []);
  h.render({ open: false });
  h.render({ open: true, product: undefined });
  assert.deepEqual(h.form.values, {});
  h.edit('UnsavedCreate');
  h.render({ open: false });
  h.render({ open: true });
  assert.deepEqual(h.form.values, {});
  h.render({ product: { ...product, id: 'legacy', code: null } });
  assert.equal(h.form.values.code, '');
});

test('form generates only on click, confirms populated replacement, and never saves during generation', async () => {
  const h = productFormHarness();
  h.render();
  assert.equal(h.requests, 0);
  const promise = h.generate();
  h.render();
  assert.equal(h.requests, 1);
  assert.equal(h.find((node) => node.type === 'Modal').props.okButtonProps.disabled, true);
  h.pending[0].resolve({ code: '2000000000008' });
  await promise;
  h.render();
  assert.equal(h.form.values.code, '2000000000008');
  h.generate();
  assert.ok(h.confirmation);
  assert.equal(h.requests, 1);
  const replacement = h.confirm();
  h.pending[1].resolve({ code: '2000000000015' });
  await replacement;
  assert.equal(h.form.values.code, '2000000000015');
  assert.equal(h.closed, 0);
});

test('Product Code guidance explains internal generation and legacy assignment only when needed', () => {
  const h = productFormHarness();
  const extraText = () => {
    const extra = h.find((node) => node.props?.label === 'Product Code').props.extra;
    const text = (node) => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(text).join(' ');
      return node && typeof node === 'object' ? text(node.props?.children) : '';
    };
    return text(extra);
  };
  h.render();
  assert.match(extraText(), /Generated codes are for internal MyKasir use only and are not GS1-assigned GTINs/);
  assert.doesNotMatch(extraText(), /Assign a unique code/);
  h.render({ product: { ...input(), id, code: null } });
  assert.match(extraText(), /This product has no Product Code. Assign a unique code before saving any changes/);
  h.render({ product: { ...input(), id } });
  assert.doesNotMatch(extraText(), /Assign a unique code/);
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
    assert.notEqual(h.form.values.code, '2000000000008');
    if (change === 'edit') assert.equal(h.form.values.code, 'Manual001');
    if (change === 'switch') assert.equal(h.form.values.code, 'Other001');
  }
});

test('form keeps input on failure and ignores outdated confirmations and pending responses from another form', async () => {
  const h = productFormHarness();
  h.render();
  h.edit('Original001');
  h.generate();
  h.edit('NewManual001');
  await h.confirm();
  assert.equal(h.requests, 0);
  h.generate();
  const promise = h.confirm();
  h.pending[0].reject(new ApiError('Generation unavailable', 503));
  await promise;
  assert.equal(h.form.values.code, 'NewManual001');
  h.render();
  h.edit('');
  const old = h.generate();
  h.render({ product: { ...input(), id: otherId, code: null } });
  const next = h.generate();
  h.render();
  h.pending[1].resolve({ code: '2000000000015' });
  await old;
  h.render();
  assert.equal(h.find((node) => node.type === 'Modal').props.okButtonProps.disabled, true);
  h.pending[2].resolve({ code: '2000000000022' });
  await next;
  assert.equal(h.form.values.code, '2000000000022');
});

test('generation route preserves authentication, returns no-store on 200/401/503, and accepts existing cashier policy', async () => {
  const { service, calls } = setup();
  let session = { user: { id, role: 'cashier' } };
  const { withAuth } = loadSource('src/server/auth/with-auth.ts', { '@/auth': { auth: async () => session } });
  const responses = loadSource('src/server/utils/api.ts', { '@/utils/api': { ApiError } });
  const route = loadSource('src/app/api/products/generate-code/route.ts', {
    '@/server/services/product.service': service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  });
  const request = new Request('http://localhost/api/products/generate-code', { method: 'POST' });
  const generated = await route.POST(request);
  assert.equal(generated.status, 200);
  assert.equal(generated.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await generated.json(), { code: '2000000000008' });
  session = null;
  const unauthorized = await route.POST(request);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls.generated, 1);
  session = { user: { id, role: 'admin' } };
  const exhausted = loadSource('src/app/api/products/generate-code/route.ts', {
    '@/server/services/product.service': setup({ sequence: [] }).service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  });
  const unavailable = await exhausted.POST(request);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await unavailable.json(), {
    message: 'Internal product code generation range is exhausted. Enter a code manually.',
  });
});

test('item routes retain PUT data envelope and distinguish assignment conflict from duplicate ownership', async () => {
  const row = { ...input(), id };
  const { service } = setup({ records: [row] });
  const { withAuth } = loadSource('src/server/auth/with-auth.ts', {
    '@/auth': { auth: async () => ({ user: { id, role: 'admin' } }) },
  });
  const responses = loadSource('src/server/utils/api.ts', { '@/utils/api': { ApiError } });
  const dependencies = {
    '@/server/services/product.service': service,
    '@/server/auth/with-auth': { withAuth },
    '@/server/utils/api': responses,
  };
  const route = loadSource('src/app/api/products/[id]/route.ts', dependencies);
  const request = (body) =>
    new Request('http://localhost/api/products/' + id, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  const context = { params: Promise.resolve({ id }) };
  const result = await route.PUT(request({ code: 'Edited001' }), context);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).data.code, 'Edited001');
  const race = setup({
    records: [{ ...input(), id, code: null }],
    guardedMiss: true,
    afterMiss: (records) => {
      records[0].code = 'Assigned001';
    },
  });
  const conflicted = loadSource('src/app/api/products/[id]/route.ts', {
    ...dependencies,
    '@/server/services/product.service': race.service,
  });
  const conflict = await conflicted.PUT(request({ name: 'Wrong' }), context);
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), {
    message: 'Product Code was assigned by another request. Refresh and retry manually.',
  });
  assert.equal(race.calls.updates, 1);
  const missing = await route.GET(new Request('http://localhost/'), { params: Promise.resolve({ id: otherId }) });
  assert.equal(missing.status, 404);
});

test('repository guard and all-owner lookup use parameterized Drizzle SQL without live execution', async () => {
  const { PgDialect } = requireDependency('drizzle-orm/pg-core');
  const dialect = new PgDialect();
  const schema = loadSource('src/server/db/schema.ts');
  const queries = [];
  let values;
  const builder = {
    set(value) {
      values = value;
      return this;
    },
    from() {
      return this;
    },
    where(sql) {
      queries.push(dialect.sqlToQuery(sql));
      return this;
    },
    returning: async () => [],
    limit: async () => [],
  };
  const repository = loadSource('src/server/repositories/product.repository.ts', {
    'server-only': {},
    '@/server/db/schema': schema,
    '@/server/db': { db: { update: () => builder, select: () => builder } },
  });
  await repository.updateProductById(id, { name: 'New name' });
  assert.ok(!('code' in values));
  assert.match(queries.at(-1).sql, /"products"\."code" is not null/);
  assert.match(queries.at(-1).sql, /"products"\."deleted_at" is null/);
  await repository.updateProductById(id, { code: 'Assigned001' });
  assert.equal(values.code, 'Assigned001');
  assert.doesNotMatch(queries.at(-1).sql, /"code" is not null/);
  await repository.findProductByCode("Injected'Value", id);
  assert.doesNotMatch(queries.at(-1).sql, /deleted_at|Injected/);
  assert.ok(queries.at(-1).params.includes("injected'value"));
  assert.ok(queries.at(-1).params.includes(id));
});

test('dedicated sequence repository returns text and maps only generator limit failures without live access', async () => {
  const schema = loadSource('src/server/db/schema.ts');
  let failure,
    calls = 0;
  const repository = loadSource('src/server/repositories/product.repository.ts', {
    'server-only': {},
    '@/server/db/schema': schema,
    '@/server/db': {
      db: {
        execute: async () => {
          calls++;
          if (failure) throw failure;
          return { rows: [{ value: '9999999999' }] };
        },
      },
    },
  });
  assert.equal(await repository.nextProductCodeValue(), '9999999999');
  failure = new Error('query failed', { cause: { code: '2200H' } });
  assert.equal(await repository.nextProductCodeValue(), null);
  failure = new Error('permission denied', { cause: { code: '42501' } });
  await assert.rejects(repository.nextProductCodeValue(), (error) => error === failure);
  assert.equal(calls, 3);
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
    const formNode = h.find((node) => node.props?.onFinish);
    await formNode.props.onFinish({ ...input(), code: 'Manual001' });
    h.render();
    assert.equal(attempts, 1);
    assert.equal(h.closed, 0);
    assert.equal(h.form.values.code, 'Manual001');
    if (message.startsWith('Product code is')) assert.deepEqual(h.form.errors[0].errors, [message]);
    else assert.equal(h.find((node) => node.type === 'Alert').props.message, message);
    assert.ok(tree.props.open);
  }
});

test('client partial edits omit unspecified code/timestamps and generation has no save cache side effects', async () => {
  const requests = [],
    invalidations = [];
  const api = loadSource('src/features/dashboard/products/api/product.api.ts', {
    '@/utils/api': {
      fetcher: async (url, init) => {
        requests.push({ url, init });
        return {};
      },
    },
  });
  await api.updateProduct({ id, name: 'Changed' });
  assert.equal(requests[0].url, '/api/products/' + id);
  assert.deepEqual(JSON.parse(requests[0].init.body), { name: 'Changed' });
  await api.generateProductCode();
  assert.equal(requests[1].url, '/api/products/generate-code');
  assert.equal(requests[1].init.method, 'POST');
  assert.equal(requests[1].init.cache, 'no-store');
  const hooks = loadSource('src/features/dashboard/products/hooks/use-products.ts', {
    '../api/product.api': api,
    '@tanstack/react-query': {
      useMutation: (configuration) => configuration,
      useQueryClient: () => ({ invalidateQueries: (query) => invalidations.push(query.queryKey) }),
    },
  });
  const edit = hooks.useUpdateProduct();
  assert.equal(edit.retry, false);
  edit.onSuccess({}, { id });
  assert.deepEqual(invalidations, [['products'], ['products', 'detail', id]]);
  const generation = hooks.useGenerateProductCode();
  assert.equal(generation.retry, false);
  assert.equal(generation.onSuccess, undefined);
});
