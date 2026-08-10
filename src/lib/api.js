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

  const accountIds = Array.from(
    new Set(subscriptions.map((subscription) => subscription.cuenta_vinculada__c).filter(Boolean)),
  );
  const [paymentsResult, accountsResult] = await Promise.all([
    client
      .from('dinero_de_cuentas__c')
      .select('subscription_pagada__c, fecha_de_pago__c')
      .eq('cliente__c', customerId)
      .order('fecha_de_pago__c', { ascending: false }),
    accountIds.length
      ? client
          .from('correo_electronico__c')
          .select('id, correo_electronico__c, contrasena__c')
          .in('id', accountIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const payments = unwrap(paymentsResult);
  const accounts = unwrap(accountsResult);
  const lastPaymentBySubscription = new Map();
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  payments.forEach((payment) => {
    if (!lastPaymentBySubscription.has(payment.subscription_pagada__c)) {
      lastPaymentBySubscription.set(payment.subscription_pagada__c, payment.fecha_de_pago__c);
    }
  });

  return subscriptions.map((subscription) => {
    const account = accountById.get(subscription.cuenta_vinculada__c);
    return {
      ...subscription,
      account_email: account?.correo_electronico__c || subscription.cuenta_correo_electronico__c,
      account_password: account?.contrasena__c || '',
      last_payment_date: lastPaymentBySubscription.get(subscription.id) || subscription.start_date__c,
    };
  });
}

export async function listAccounts() {
  const client = ensureClient();
  return unwrap(
    await client
      .from('correo_electronico__c')
      .select(
        'id, correo_electronico__c, contrasena__c, tipo_de_servicio__c, clientes_contador__c, capacidad_clientes__c, activo__c',
      )
      .order('tipo_de_servicio__c', { ascending: true })
      .order('clientes_contador__c', { ascending: true }),
  );
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
