import { supabase } from './supabaseClient';

function ensureClient() {
  if (!supabase) {
    throw new Error('Supabase environment variables are missing.');
  }
  return supabase;
}

function unwrap({ data, error }) {
  if (error) {
    throw error;
  }
  return data ?? [];
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  );
}

function isSameEmail(left, right) {
  return normalizeValue(left) === normalizeValue(right);
}

function isSameService(left, right) {
  return normalizeValue(left) === normalizeValue(right);
}

function isCanceledStatus(status) {
  return normalizeValue(status) === 'cancelado';
}

function resolveAccountForSubscription(subscription, accounts) {
  const linkedValue = subscription.account_id || subscription.cuenta_vinculada__c;
  const linkedEmail = subscription.cuenta_correo_electronico__c || (String(linkedValue || '').includes('@') ? linkedValue : '');
  const linkedAccount = accounts.find((account) => account.id === linkedValue);
  const emailMatches = linkedEmail
    ? accounts.filter((account) => isSameEmail(account.correo_electronico__c, linkedEmail))
    : [];
  const emailAndServiceMatch = emailMatches.find((account) =>
    isSameService(account.tipo_de_servicio__c, subscription.service__c),
  );

  if (linkedAccount) {
    const serviceMatches = isSameService(linkedAccount.tipo_de_servicio__c, subscription.service__c);
    const emailMatchesLinked = !linkedEmail || isSameEmail(linkedAccount.correo_electronico__c, linkedEmail);

    if (serviceMatches && emailMatchesLinked) {
      return linkedAccount;
    }
  }

  return emailAndServiceMatch || linkedAccount || (emailMatches.length === 1 ? emailMatches[0] : null);
}

async function fetchAccountsForSubscriptions(client, subscriptions) {
  const accountIds = Array.from(
    new Set(
      subscriptions
        .flatMap((subscription) => [subscription.account_id, subscription.cuenta_vinculada__c])
        .filter(isUuid),
    ),
  );
  const accountEmails = Array.from(
    new Set(
      subscriptions
        .flatMap((subscription) => [
          subscription.cuenta_correo_electronico__c,
          String(subscription.cuenta_vinculada__c || '').includes('@') ? subscription.cuenta_vinculada__c : '',
        ])
        .filter(Boolean),
    ),
  );

  const [accountsByIdResult, accountsByEmailResult] = await Promise.all([
    accountIds.length
      ? client
          .from('correo_electronico__c')
          .select('id, correo_electronico__c, contrasena__c, tipo_de_servicio__c')
          .in('id', accountIds)
      : Promise.resolve({ data: [], error: null }),
    accountEmails.length
      ? client
          .from('correo_electronico__c')
          .select('id, correo_electronico__c, contrasena__c, tipo_de_servicio__c')
          .in('correo_electronico__c', accountEmails)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const accounts = [...unwrap(accountsByIdResult), ...unwrap(accountsByEmailResult)];
  return Array.from(new Map(accounts.map((account) => [account.id, account])).values());
}

export async function getSession() {
  const client = ensureClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function onAuthStateChange(callback) {
  const client = ensureClient();
  return client.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signInWithPassword(email, password) {
  const client = ensureClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw error;
  }
}

export async function signOut() {
  const client = ensureClient();
  const { error } = await client.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function checkConnection() {
  const client = ensureClient();
  const { error } = await client.from('clientes__c').select('id', {
    count: 'exact',
    head: true,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code || error.status || 'blocked',
    };
  }

  return {
    ok: true,
    message: 'Connected',
    code: 'ok',
  };
}

export async function getExpiredSubscriptions() {
  const client = ensureClient();
  return unwrap(await client.rpc('get_expired_subscriptions'));
}

export async function getCashLedger() {
  const client = ensureClient();
  return unwrap(await client.rpc('obtener_registros_filtrados'));
}

export async function getServiceAccounts(service) {
  const client = ensureClient();
  return unwrap(await client.rpc('listadecorreos', {
    Tipo_de_servicio: service,
  }));
}

export async function createCustomer({ name, phone }) {
  const client = ensureClient();
  return unwrap(await client.rpc('crearnuevocliente', {
    Nombre: name,
    Phonenumber: phone || null,
  }));
}

export async function createSubscription(payload) {
  const client = ensureClient();
  return unwrap(await client.rpc('creating_new_sub', {
    nombreDelCliente: payload.customerName.trim(),
    fechaDeCompra: payload.startDate,
    clienteDe: payload.seller,
    servicioAdquirido: payload.service,
    cuentaVinculada: payload.accountEmail,
    metodoPago: payload.paymentMethod,
    status: payload.status,
  }));
}

export async function updateSubscription(id, payload) {
  const client = ensureClient();
  return unwrap(await client.rpc('actualizar_suscripcion', {
    subscription_id: id,
    fechaDeCompra: payload.startDate,
    clienteDe: payload.seller,
    servicioAdquirido: payload.service,
    cuentaVinculada: payload.accountEmail || '',
    metodoPago: payload.paymentMethod,
    status: payload.status,
  }));
}

export async function renewSubscription(id, payload) {
  const client = ensureClient();
  const values = {
    start_date__c: payload.startDate,
    status__c: 'Pagado',
  };

  if (payload.price !== undefined && payload.price !== null && payload.price !== '') {
    values.precio__c = Number(payload.price);
  }

  return unwrap(
    await client
      .from('subscription__c')
      .update(values)
      .eq('id', id)
      .select('id, start_date__c, expiration_date__c, status__c, precio__c')
      .single(),
  );
}

export async function cancelSubscription(id) {
  const client = ensureClient();
  return unwrap(
    await client
      .from('subscription__c')
      .update({ status__c: 'Cancelado' })
      .eq('id', id)
      .select('id, status__c')
      .single(),
  );
}

export async function listCustomers() {
  const client = ensureClient();
  return unwrap(
    await client
      .from('clientes__c')
      .select('id, name, telefono__c, created_at')
      .order('name', { ascending: true })
      .limit(200),
  );
}

export async function listCustomerSubscriptions(customerId) {
  const client = ensureClient();
  const subscriptionsResult = await client
    .from('subscription__c')
    .select(
      'id, service__c, precio__c, cliente_de__c, status__c, start_date__c, expiration_date__c, cuenta_vinculada__c, cuenta_correo_electronico__c, metodo_de_pago__c',
    )
    .eq('cliente__c', customerId)
    .order('expiration_date__c', { ascending: false })
    .limit(100);
  const subscriptions = unwrap(subscriptionsResult);
  const [paymentsResult, accountsResult] = await Promise.all([
    client
      .from('dinero_de_cuentas__c')
      .select('subscription_pagada__c, fecha_de_pago__c')
      .eq('cliente__c', customerId)
      .order('fecha_de_pago__c', { ascending: false }),
    fetchAccountsForSubscriptions(client, subscriptions).then((accounts) => ({ data: accounts, error: null })),
  ]);

  const payments = unwrap(paymentsResult);
  const accounts = unwrap(accountsResult);
  const lastPaymentBySubscription = new Map();

  payments.forEach((payment) => {
    if (!lastPaymentBySubscription.has(payment.subscription_pagada__c)) {
      lastPaymentBySubscription.set(payment.subscription_pagada__c, payment.fecha_de_pago__c);
    }
  });

  return subscriptions.map((subscription) => {
    const account = resolveAccountForSubscription(subscription, accounts);
    return {
      ...subscription,
      account_id: account?.id || subscription.cuenta_vinculada__c,
      account_email: account?.correo_electronico__c || subscription.cuenta_correo_electronico__c,
      account_password: account?.contrasena__c || '',
      account_service: account?.tipo_de_servicio__c || '',
      last_payment_date: lastPaymentBySubscription.get(subscription.id) || subscription.start_date__c,
    };
  });
}

export async function listAccounts() {
  const client = ensureClient();
  const accounts = unwrap(
    await client
      .from('correo_electronico__c')
      .select(
        'id, correo_electronico__c, contrasena__c, tipo_de_servicio__c, clientes_contador__c, capacidad_clientes__c, activo__c',
      )
      .order('tipo_de_servicio__c', { ascending: true })
      .order('clientes_contador__c', { ascending: true }),
  );

  if (!accounts.length) {
    return accounts;
  }

  const [subscriptionsResult, customersResult] = await Promise.all([
    client
      .from('subscription__c')
      .select('id, cliente__c, cuenta_vinculada__c, cuenta_correo_electronico__c, service__c, status__c')
      .limit(1000),
    client.from('clientes__c').select('id, name').limit(1000),
  ]);
  const subscriptions = unwrap(subscriptionsResult);
  const customers = unwrap(customersResult);
  const customerById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const clientsByAccountId = new Map(accounts.map((account) => [account.id, new Set()]));

  subscriptions.forEach((subscription) => {
    if (isCanceledStatus(subscription.status__c)) {
      return;
    }

    const account = resolveAccountForSubscription(subscription, accounts);
    const customerName = customerById.get(subscription.cliente__c);

    if (account?.id && customerName) {
      clientsByAccountId.get(account.id)?.add(customerName);
    }
  });

  return accounts.map((account) => ({
    ...account,
    client_names: Array.from(clientsByAccountId.get(account.id) || []).sort((left, right) =>
      left.localeCompare(right, 'es'),
    ),
  }));
}

export async function getSubscriptionCredentialAccount(subscription) {
  const client = ensureClient();
  const accounts = await fetchAccountsForSubscriptions(client, [subscription]);
  return resolveAccountForSubscription(subscription, accounts);
}

export async function createAccount(payload) {
  const client = ensureClient();
  return unwrap(
    await client
      .from('correo_electronico__c')
      .insert({
        correo_electronico__c: payload.email.trim(),
        contrasena__c: payload.password?.trim() || null,
        tipo_de_servicio__c: payload.service,
        capacidad_clientes__c: payload.capacity ? Number(payload.capacity) : null,
        activo__c: payload.active ?? true,
      })
      .select()
      .single(),
  );
}

export async function updateAccount(id, payload) {
  const client = ensureClient();
  return unwrap(
    await client
      .from('correo_electronico__c')
      .update({
        correo_electronico__c: payload.email.trim(),
        contrasena__c: payload.password?.trim() || null,
        tipo_de_servicio__c: payload.service,
        capacidad_clientes__c: payload.capacity ? Number(payload.capacity) : null,
        activo__c: payload.active,
      })
      .eq('id', id)
      .select()
      .single(),
  );
}
