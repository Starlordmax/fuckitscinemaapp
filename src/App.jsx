import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  DollarSign,
  Film,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  Ticket,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  checkConnection,
  createAccount,
  createCustomer,
  createSubscription,
  getCashLedger,
  getExpiredSubscriptions,
  getServiceAccounts,
  getSession,
  listAccounts,
  listCustomers,
  onAuthStateChange,
  signInWithEmail,
  signOut,
} from './lib/api';
import { hasSupabaseConfig } from './lib/supabaseClient';

const SERVICES = [
  'Netflix',
  'Disney+',
  'Hbomax',
  'Primevideo',
  'Spotify',
  'Netflix(cuenta completa)',
];

const SERVICE_CAPACITY = {
  Netflix: 5,
  'Disney+': 7,
  Hbomax: 5,
  Primevideo: 6,
};

const SELLERS = ['Marbelly', 'Wendy', 'Kennet'];
const PAYMENT_METHODS = ['Efectivo', 'Transferencia'];
const STATUSES = ['Pagado', 'No pagado', 'Expirado'];

const emptySubscription = {
  customerName: '',
  seller: 'Marbelly',
  service: 'Netflix',
  paymentMethod: 'Efectivo',
  status: 'Pagado',
  startDate: new Date().toISOString().slice(0, 10),
  accountEmail: '',
};

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'USD',
  }).format(numeric);
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-NI', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(`${value}T00:00:00`));
}

function getErrorText(error) {
  if (!error) {
    return '';
  }

  if (error.message) {
    return error.message;
  }

  return String(error);
}

function StatusPill({ status }) {
  if (!status) {
    return null;
  }

  return (
    <span className={`status-pill ${status.ok ? 'status-pill--ok' : 'status-pill--warn'}`}>
      {status.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {status.label}
    </span>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <section className="metric">
      <div className="metric__icon">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

function TextInput({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function getServiceCapacity(service) {
  return SERVICE_CAPACITY[service] ?? '';
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      <Icon size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function DataError({ error }) {
  if (!error) {
    return null;
  }

  return (
    <div className="data-error">
      <AlertCircle size={18} />
      <span>{getErrorText(error)}</span>
    </div>
  );
}

function AuthPanel({ session, onSession }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmail(email);
      setMessage('Revisa tu correo para entrar.');
      setEmail('');
    } catch (error) {
      setMessage(getErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      onSession(null);
    } finally {
      setBusy(false);
    }
  }

  if (session) {
    return (
      <div className="auth auth--signed">
        <UserRound size={18} />
        <span>{session.user.email}</span>
        <button type="button" className="icon-text-button" onClick={handleSignOut} disabled={busy}>
          <LogOut size={16} />
          Salir
        </button>
      </div>
    );
  }

  return (
    <form className="auth" onSubmit={handleSignIn}>
      <Mail size={18} />
      <input
        type="email"
        value={email}
        placeholder="email@cine.com"
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button type="submit" className="icon-text-button" disabled={busy}>
        <Ticket size={16} />
        Entrar
      </button>
      {message && <span className="auth__message">{message}</span>}
    </form>
  );
}

function Dashboard({ expired, cash }) {
  const totalCash = useMemo(
    () => cash.reduce((sum, row) => sum + Number(row.Total__c || row.total__c || 0), 0),
    [cash],
  );
  const uncollected = useMemo(
    () => cash.filter((row) => (row.Collected__c || row.collected__c) !== 'Si').length,
    [cash],
  );

  return (
    <div className="content-grid">
      <Metric label="Suscripciones vencidas" value={expired.length} icon={Ticket} />
      <Metric label="Efectivo registrado" value={formatCurrency(totalCash)} icon={DollarSign} />
      <Metric label="Pendiente de recolectar" value={uncollected} icon={WalletCards} />
    </div>
  );
}

function ExpiredTable({ rows, error }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Suscripciones Vencidas</h2>
        <Ticket size={18} />
      </div>
      <DataError error={error} />
      {rows.length === 0 && !error ? (
        <EmptyState icon={Film} title="Sin vencidas" text="No hay registros para mostrar." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Vence</th>
                <th>Servicio</th>
                <th>Precio</th>
                <th>Cliente de</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.clienteName}</td>
                  <td>{formatDate(row.expirationDate)}</td>
                  <td>{row.service}</td>
                  <td>{row.price}</td>
                  <td>{row.clienteDe || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CashTable({ rows, error }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Efectivo Ganado</h2>
        <DollarSign size={18} />
      </div>
      <DataError error={error} />
      {rows.length === 0 && !error ? (
        <EmptyState icon={WalletCards} title="Sin movimientos" text="No hay registros para mostrar." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recolectado</th>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.Id || row.id}>
                  <td>
                    <span className={`chip ${row.Collected__c === 'Si' ? 'chip--ok' : ''}`}>
                      {row.Collected__c || 'No'}
                    </span>
                  </td>
                  <td>{row.Cliente__c}</td>
                  <td>{row.servicio_pagado__c}</td>
                  <td>{formatDate(row.Fecha_de_pago__c)}</td>
                  <td>{formatCurrency(row.Total__c)}</td>
                  <td>{row.vendedor__c || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NewSubscription({ onSaved }) {
  const [form, setForm] = useState(emptySubscription);
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    let ignore = false;
    async function loadAccounts() {
      try {
        const data = await getServiceAccounts(form.service);
        if (!ignore) {
          setAccounts(data);
          if (!form.accountEmail && data[0]?.Correo_Electronico__c) {
            updateField('accountEmail', data[0].Correo_Electronico__c);
          }
        }
      } catch {
        if (!ignore) {
          setAccounts([]);
        }
      }
    }
    loadAccounts();
    return () => {
      ignore = true;
    };
  }, [form.service]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await createSubscription(form);
      setForm({ ...emptySubscription, service: form.service, seller: form.seller });
      setMessage('Suscripcion guardada.');
      onSaved();
    } catch (error) {
      setMessage(getErrorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Nueva Suscripcion</h2>
        <Plus size={18} />
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <TextInput
          label="Nombre del cliente"
          value={form.customerName}
          onChange={(value) => updateField('customerName', value)}
          placeholder="Nombre"
        />
        <SelectInput label="Vendedor" value={form.seller} onChange={(value) => updateField('seller', value)} options={SELLERS} />
        <SelectInput label="Servicio" value={form.service} onChange={(value) => updateField('service', value)} options={SERVICES} />
        <SelectInput
          label="Metodo de pago"
          value={form.paymentMethod}
          onChange={(value) => updateField('paymentMethod', value)}
          options={PAYMENT_METHODS}
        />
        <SelectInput label="Status" value={form.status} onChange={(value) => updateField('status', value)} options={STATUSES} />
        <TextInput label="Start Date" type="date" value={form.startDate} onChange={(value) => updateField('startDate', value)} />
        <label className="field field--wide">
          <span>Cuenta asociada</span>
          <select value={form.accountEmail} onChange={(event) => updateField('accountEmail', event.target.value)}>
            <option value="">Sin cuenta</option>
            {accounts.map((account) => (
              <option key={account.Id || account.Correo_Electronico__c} value={account.Correo_Electronico__c}>
                {account.Correo_Electronico__c} ({account.Clientes_Contador__c})
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            <Save size={17} />
            Guardar
          </button>
          {message && <span className="form-message">{message}</span>}
        </div>
      </form>
    </section>
  );
}

function Customers({ rows, error, onSaved }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    try {
      await createCustomer({ name, phone });
      setName('');
      setPhone('');
      setMessage('Cliente guardado.');
      onSaved();
    } catch (error) {
      setMessage(getErrorText(error));
    }
  }

  return (
    <div className="split">
      <section className="panel">
        <div className="panel__header">
          <h2>Clientes</h2>
          <Users size={18} />
        </div>
        <DataError error={error} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Telefono</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.telefono__c || '—'}</td>
                  <td>{new Date(row.created_at).toLocaleDateString('es-NI')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel__header">
          <h2>Nuevo Cliente</h2>
          <UserRound size={18} />
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <TextInput label="Nombre" value={name} onChange={setName} />
          <TextInput label="Telefono" value={phone} onChange={setPhone} type="tel" />
          <button type="submit" className="primary-button">
            <Save size={17} />
            Guardar
          </button>
          {message && <span className="form-message">{message}</span>}
        </form>
      </section>
    </div>
  );
}

function Accounts({ rows, error, onSaved }) {
  const [form, setForm] = useState({
    email: '',
    service: 'Netflix',
    capacity: getServiceCapacity('Netflix'),
  });
  const [message, setMessage] = useState('');

  function updateField(key, value) {
    setForm((current) => {
      if (key === 'service') {
        return {
          ...current,
          service: value,
          capacity: getServiceCapacity(value),
        };
      }

      return { ...current, [key]: value };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    try {
      await createAccount(form);
      setForm({ email: '', service: form.service, capacity: getServiceCapacity(form.service) });
      setMessage('Cuenta guardada.');
      onSaved();
    } catch (error) {
      setMessage(getErrorText(error));
    }
  }

  return (
    <div className="split">
      <section className="panel">
        <div className="panel__header">
          <h2>Cuentas</h2>
          <Mail size={18} />
        </div>
        <DataError error={error} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Correo</th>
                <th>Servicio</th>
                <th>Clientes</th>
                <th>Capacidad</th>
                <th>Activa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.correo_electronico__c}</td>
                  <td>{row.tipo_de_servicio__c}</td>
                  <td>{row.clientes_contador__c}</td>
                  <td>{row.capacidad_clientes__c ?? '—'}</td>
                  <td>{row.activo__c ? 'Si' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel__header">
          <h2>Nueva Cuenta</h2>
          <Plus size={18} />
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <TextInput label="Correo" type="email" value={form.email} onChange={(value) => updateField('email', value)} />
          <SelectInput label="Servicio" value={form.service} onChange={(value) => updateField('service', value)} options={SERVICES} />
          <label className="field">
            <span>Capacidad</span>
            <input type="number" value={form.capacity} readOnly />
          </label>
          <button type="submit" className="primary-button">
            <Save size={17} />
            Guardar
          </button>
          {message && <span className="form-message">{message}</span>}
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [session, setSession] = useState(null);
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState([]);
  const [cash, setCash] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [errors, setErrors] = useState({});
  const [query, setQuery] = useState('');

  async function refreshData() {
    if (!hasSupabaseConfig) {
      setConnection({ ok: false, label: 'Sin configuracion' });
      return;
    }

    setLoading(true);
    setErrors({});

    const status = await checkConnection();
    setConnection({
      ok: status.ok,
      label: status.ok ? 'Supabase conectado' : 'RLS bloqueado',
      detail: status.message,
    });

    const loaders = [
      ['expired', getExpiredSubscriptions, setExpired],
      ['cash', getCashLedger, setCash],
      ['customers', listCustomers, setCustomers],
      ['accounts', listAccounts, setAccounts],
    ];

    const nextErrors = {};
    await Promise.all(
      loaders.map(async ([key, loader, setter]) => {
        try {
          setter(await loader());
        } catch (error) {
          setter([]);
          nextErrors[key] = error;
        }
      }),
    );

    setErrors(nextErrors);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const currentSession = await getSession();
        if (mounted) {
          setSession(currentSession);
        }
      } catch {
        if (mounted) {
          setSession(null);
        }
      }
      refreshData();
    }
    boot();
    onAuthStateChange((nextSession) => {
      setSession(nextSession);
      refreshData();
    }).then(({ data }) => {
      if (data?.subscription) {
        return data.subscription;
      }
      return null;
    });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return customers;
    }
    return customers.filter((customer) => customer.name.toLowerCase().includes(term));
  }, [customers, query]);

  const tabs = [
    ['dashboard', 'Panel', Clapperboard],
    ['new', 'Nuevo', Plus],
    ['expired', 'Vencidas', Ticket],
    ['cash', 'Dinero', DollarSign],
    ['accounts', 'Cuentas', Mail],
    ['customers', 'Clientes', Users],
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <Clapperboard size={24} />
          </div>
          <div>
            <strong>Fuck Its Cinema</strong>
            <span>Subscription desk</span>
          </div>
        </div>
        <nav className="nav">
          {tabs.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              className={activeTab === key ? 'nav__item nav__item--active' : 'nav__item'}
              onClick={() => setActiveTab(key)}
              title={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{tabs.find(([key]) => key === activeTab)?.[1]}</h1>
            <StatusPill status={connection} />
          </div>
          <div className="topbar__actions">
            <div className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente" />
            </div>
            <button type="button" className="icon-button" onClick={refreshData} disabled={loading} title="Refresh">
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
            <AuthPanel session={session} onSession={setSession} />
          </div>
        </header>

        {connection && !connection.ok && (
          <div className="notice">
            <AlertCircle size={18} />
            <span>{connection.detail}</span>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            <Dashboard expired={expired} cash={cash} />
            <div className="dual-panels">
              <ExpiredTable rows={expired.slice(0, 6)} error={errors.expired} />
              <CashTable rows={cash.slice(0, 6)} error={errors.cash} />
            </div>
          </>
        )}
        {activeTab === 'new' && <NewSubscription onSaved={refreshData} />}
        {activeTab === 'expired' && <ExpiredTable rows={expired} error={errors.expired} />}
        {activeTab === 'cash' && <CashTable rows={cash} error={errors.cash} />}
        {activeTab === 'accounts' && <Accounts rows={accounts} error={errors.accounts} onSaved={refreshData} />}
        {activeTab === 'customers' && <Customers rows={filteredCustomers} error={errors.customers} onSaved={refreshData} />}
      </section>
    </main>
  );
}
