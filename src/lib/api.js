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
  const [subscriptionsResult, paymentsResult] = await Promise.all([
    client
      .from('subscription__c')
      .select(
        'id, service__c, status__c, start_date__c, expiration_date__c, cuenta_correo_electronico__c, metodo_de_pago__c',
      )
      .eq('cliente__c', customerId)
      .order('expiration_date__c', { ascending: false })
      .limit(100),
    client
      .from('dinero_de_cuentas__c')
      .select('subscription_pagada__c, fecha_de_pago__c')
      .eq('cliente__c', customerId)
      .order('fecha_de_pago__c', { ascending: false }),
  ]);

  const subscriptions = unwrap(subscriptionsResult);
  const payments = unwrap(paymentsResult);
  const lastPaymentBySubscription = new Map();

  payments.forEach((payment) => {
    if (!lastPaymentBySubscription.has(payment.subscription_pagada__c)) {
      lastPaymentBySubscription.set(payment.subscription_pagada__c, payment.fecha_de_pago__c);
    }
  });

  return subscriptions.map((subscription) => ({
    ...subscription,
    last_payment_date: lastPaymentBySubscription.get(subscription.id) || subscription.start_date__c,
  }));
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
        correo_electronico__c: payload.email,
        contrasena__c: payload.password?.trim() || null,
        tipo_de_servicio__c: payload.service,
        capacidad_clientes__c: payload.capacity ? Number(payload.capacity) : null,
        activo__c: true,
      })
      .select()
      .single(),
  );
}
