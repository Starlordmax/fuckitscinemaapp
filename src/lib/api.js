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

export async function listAccounts() {
  const client = ensureClient();
  return unwrap(
    await client
      .from('correo_electronico__c')
      .select(
        'id, correo_electronico__c, tipo_de_servicio__c, clientes_contador__c, capacidad_clientes__c, activo__c',
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
        tipo_de_servicio__c: payload.service,
        capacidad_clientes__c: payload.capacity ? Number(payload.capacity) : null,
        activo__c: true,
      })
      .select()
      .single(),
  );
}
