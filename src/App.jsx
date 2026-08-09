import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  ClipboardList,
  DollarSign,
  Download,
  Film,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Ticket,
  UserRound,
  Users,
  WalletCards,
  X,
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
  listCustomerSubscriptions,
  listCustomers,
  onAuthStateChange,
  signInWithPassword,
  signOut,
  updateAccount,
} from './lib/api';
import { hasSupabaseConfig } from './lib/supabaseClient';

const SERVICES = [
  'Netflix',
  'Disney+',
  'Hbomax',
  'Hbomax (cuenta completa)',
  'Primevideo',
  'Paramount+',
  'Crunchyroll',
  'Spotify',
  'Netflix(cuenta completa)',
];

const SERVICE_CAPACITY = {
  Netflix: 5,
  'Disney+': 7,
  Hbomax: 5,
  Primevideo: 6,
};

const SERVICE_PRICES = {
  Netflix: 140,
  'Disney+': 120,
  Hbomax: 100,
  Primevideo: 100,
  'Paramount+': 100,
  Crunchyroll: 100,
  'Netflix(cuenta completa)': 450,
  'Hbomax (cuenta completa)': 300,
};

const SERVICE_IMAGE_THEMES = {
  disney: {
    label: 'Disney+',
    accent: '#2d8eff',
    secondary: '#48d5ff',
    iconTop: '#3357b8',
    iconBottom: '#36b7e2',
  },
  netflix: {
    label: 'NETFLIX',
    accent: '#e50914',
    secondary: '#ff8a8a',
    iconTop: '#ad0710',
    iconBottom: '#241111',
  },
  hbo: {
    label: 'MAX',
    accent: '#7c5cff',
    secondary: '#54c4ff',
    iconTop: '#29235c',
    iconBottom: '#111827',
  },
  prime: {
    label: 'Prime Video',
    accent: '#00a8e1',
    secondary: '#7dd3fc',
    iconTop: '#1f4f80',
    iconBottom: '#0f172a',
  },
  spotify: {
    label: 'Spotify',
    accent: '#1db954',
    secondary: '#8df0a9',
    iconTop: '#1db954',
    iconBottom: '#103d24',
  },
  paramount: {
    label: 'Paramount+',
    accent: '#2d8eff',
    secondary: '#8fc7ff',
    iconTop: '#0b5fe8',
    iconBottom: '#07348a',
  },
  crunchyroll: {
    label: 'Crunchyroll',
    accent: '#f47521',
    secondary: '#ffb26b',
    iconTop: '#f47521',
    iconBottom: '#8a3b0a',
  },
  default: {
    label: 'Streaming',
    accent: '#f2a01f',
    secondary: '#ffd28a',
    iconTop: '#384050',
    iconBottom: '#171613',
  },
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
    currency: 'NIO',
    maximumFractionDigits: 0,
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
    const message = error.message.toLowerCase();
    if (
      message.includes('correo_electronico__c_owner_email_service_uidx') ||
      message.includes('correo_electronico__c_email_lower_uidx')
    ) {
      return 'Ya existe una cuenta con ese correo para ese servicio.';
    }

    if (message.includes('row-level security') || message.includes('permission denied')) {
      return 'No tienes permiso para guardar este registro o tu sesion expiro. Sal y vuelve a entrar.';
    }

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

function CustomerLookupInput({ customers, value, onChange }) {
  const [open, setOpen] = useState(false);
  const searchValue = value.trim().toLowerCase();
  const matches = useMemo(() => {
    const filtered = searchValue
      ? customers.filter((customer) => customer.name.toLowerCase().includes(searchValue))
      : customers;

    return filtered.slice(0, 6);
  }, [customers, searchValue]);
  const exactMatch = customers.some((customer) => customer.name.toLowerCase() === searchValue);
  const showCreateOption = searchValue.length > 0 && !exactMatch;
  const hasMenu = open && (matches.length > 0 || showCreateOption);

  function selectCustomer(name) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div className="field lookup-field">
      <label htmlFor="subscription-customer">Nombre del cliente</label>
      <div className="lookup">
        <input
          id="subscription-customer"
          type="text"
          value={value}
          placeholder="Nombre"
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        />
        {hasMenu && (
          <div className="lookup__menu">
            {matches.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="lookup__option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCustomer(customer.name)}
              >
                <UserRound size={15} />
                <span>{customer.name}</span>
                {customer.telefono__c && <small>{customer.telefono__c}</small>}
              </button>
            ))}
            {showCreateOption && (
              <button
                type="button"
                className="lookup__option lookup__option--new"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCustomer(value.trim())}
              >
                <Plus size={15} />
                <span>{value.trim()}</span>
                <small>Nuevo cliente</small>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getServiceCapacity(service) {
  return SERVICE_CAPACITY[service] ?? '';
}

function getServicePrice(service) {
  return SERVICE_PRICES[service] ?? 0;
}

function getServiceImageTheme(service) {
  const normalized = String(service || '').toLowerCase();
  if (normalized.includes('disney')) return SERVICE_IMAGE_THEMES.disney;
  if (normalized.includes('netflix')) return SERVICE_IMAGE_THEMES.netflix;
  if (normalized.includes('hbo')) return SERVICE_IMAGE_THEMES.hbo;
  if (normalized.includes('prime')) return SERVICE_IMAGE_THEMES.prime;
  if (normalized.includes('spotify')) return SERVICE_IMAGE_THEMES.spotify;
  if (normalized.includes('paramount')) return SERVICE_IMAGE_THEMES.paramount;
  if (normalized.includes('crunchyroll')) return SERVICE_IMAGE_THEMES.crunchyroll;
  return SERVICE_IMAGE_THEMES.default;
}

function drawRoundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawFittedText(context, text, x, y, maxWidth, fontSize, weight, color) {
  let size = fontSize;
  const family = 'Inter, Arial, sans-serif';
  context.fillStyle = color;
  do {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= maxWidth || size <= 14) {
      break;
    }
    size -= 1;
  } while (size > 14);
  context.fillText(text, x, y);
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let nextY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, nextY);
      line = word;
      nextY += lineHeight;
      return;
    }
    line = testLine;
  });

  if (line) {
    context.fillText(line, x, nextY);
  }
}

function sanitizeDownloadName(value) {
  return String(value || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function downloadSubscriptionAccessImage(customer, subscription) {
  const theme = getServiceImageTheme(subscription.service__c);
  const email = subscription.account_email || subscription.cuenta_correo_electronico__c || 'Sin cuenta asignada';
  const password = subscription.account_password || 'Sin contrasena registrada';
  const profile = customer?.name || 'Cliente';
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 620;
  const context = canvas.getContext('2d');

  context.fillStyle = '#151515';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const iconGradient = context.createLinearGradient(110, 22, 110, 210);
  iconGradient.addColorStop(0, theme.iconTop);
  iconGradient.addColorStop(1, theme.iconBottom);
  drawRoundRect(context, 108, 22, 190, 190, 42);
  context.fillStyle = iconGradient;
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  context.stroke();

  context.fillStyle = 'rgba(255, 255, 255, 0.10)';
  context.beginPath();
  context.ellipse(203, 142, 86, 38, -0.12, 0, Math.PI * 2);
  context.fill();

  drawFittedText(context, theme.label, 135, 122, 135, 30, '800', '#ffffff');
  context.strokeStyle = theme.secondary;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(205, 118, 62, Math.PI * 1.1, Math.PI * 1.9);
  context.stroke();

  const labelX = 52;
  const valueX = 182;
  context.font = '700 22px Inter, Arial, sans-serif';
  context.fillStyle = '#ffffff';
  context.fillText('Correo:', labelX, 314);
  drawFittedText(context, email, valueX, 314, 650, 22, '800', theme.accent);

  context.font = '700 22px Inter, Arial, sans-serif';
  context.fillStyle = '#ffffff';
  context.fillText('Contrasena:', labelX, 368);
  drawFittedText(context, password, valueX, 368, 620, 22, '800', '#f2a01f');

  context.font = '700 22px Inter, Arial, sans-serif';
  context.fillStyle = '#ffffff';
  context.fillText('Perfil:', labelX, 422);
  drawFittedText(context, profile, 128, 422, 685, 22, '800', '#3fa16c');

  context.fillStyle = '#f4f4f4';
  context.fillRect(52, 458, 3, 90);

  drawRoundRect(context, 82, 460, 774, 96, 3);
  context.fillStyle = '#1f1f1f';
  context.fill();

  context.font = '600 16px Consolas, monospace';
  context.fillStyle = '#ff5e4d';
  drawWrappedText(
    context,
    'Como parte de nuestras medidas de seguridad, se realizara una renovacion mensual de contrasenas para proteger la informacion de la cuenta.',
    90,
    482,
    748,
    30,
  );

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `credenciales-${sanitizeDownloadName(profile)}-${sanitizeDownloadName(subscription.service__c)}.png`;
  link.click();
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
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await signInWithPassword(email, password);
      setMessage('Sesion iniciada.');
      setPassword('');
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
      <LockKeyhole size={18} />
      <input
        type="password"
        value={password}
        placeholder="Contraseña"
        onChange={(event) => setPassword(event.target.value)}
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
                  <td>{formatCurrency(row.price)}</td>
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

function CustomerSubscriptionsPanel({ customer, rows, loading, error, onCreateSubscription }) {
  if (!customer) {
    return <EmptyState icon={ClipboardList} title="Sin cliente seleccionado" text="Selecciona un cliente en la tabla." />;
  }

  return (
    <div className="stack">
      <div className="selected-customer">
        <UserRound size={18} />
        <div>
          <strong>{customer.name}</strong>
          <span>{customer.telefono__c || 'Sin telefono'}</span>
        </div>
        <button type="button" className="table-action selected-customer__action" onClick={() => onCreateSubscription(customer)}>
          <Plus size={15} />
          Nueva suscripcion
        </button>
      </div>
      <DataError error={error} />
      {loading ? (
        <EmptyState icon={RefreshCw} title="Cargando" text="Consultando suscripciones." />
      ) : rows.length === 0 && !error ? (
        <EmptyState icon={CalendarDays} title="Sin suscripciones" text="No hay registros para mostrar." />
      ) : (
        <div className="table-wrap">
          <table className="compact-table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Precio</th>
                <th>Cuenta</th>
                <th>Ultimo pago</th>
                <th>Termina</th>
                <th>Status</th>
                <th>Imagen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.service__c}</td>
                  <td>{formatCurrency(row.precio__c)}</td>
                  <td>{row.account_email || row.cuenta_correo_electronico__c || 'Sin cuenta'}</td>
                  <td>{formatDate(row.last_payment_date)}</td>
                  <td>{formatDate(row.expiration_date__c)}</td>
                  <td>
                    <span className={`chip ${row.status__c === 'Pagado' ? 'chip--ok' : ''}`}>
                      {row.status__c}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => downloadSubscriptionAccessImage(customer, row)}
                      disabled={!row.account_email && !row.cuenta_correo_electronico__c}
                      title="Descargar imagen de acceso"
                    >
                      <Download size={15} />
                      Imagen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewSubscription({ customers, onSaved, draft }) {
  const [form, setForm] = useState(emptySubscription);
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function updateField(key, value) {
    setForm((current) => {
      if (key === 'service') {
        return { ...current, service: value, accountEmail: '' };
      }
      return { ...current, [key]: value };
    });
  }

  useEffect(() => {
    if (!draft?.customerName) {
      return;
    }

    setForm((current) => ({
      ...emptySubscription,
      seller: current.seller,
      service: current.service,
      customerName: draft.customerName,
      accountEmail: '',
      startDate: new Date().toISOString().slice(0, 10),
    }));
    setMessage('');
  }, [draft?.requestId]);

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
        <CustomerLookupInput
          customers={customers}
          value={form.customerName}
          onChange={(value) => updateField('customerName', value)}
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
        <label className="field">
          <span>Precio</span>
          <input type="text" value={formatCurrency(getServicePrice(form.service))} readOnly />
        </label>
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

function Customers({ rows, error, onSaved, onCreateSubscription }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [panelView, setPanelView] = useState('new');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [subscriptionsError, setSubscriptionsError] = useState(null);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

  function openSubscriptions(customer) {
    setSelectedCustomer(customer);
    setPanelView('subscriptions');
  }

  function showSubscriptionsPanel() {
    if (!selectedCustomer && rows[0]) {
      setSelectedCustomer(rows[0]);
    }
    setPanelView('subscriptions');
  }

  useEffect(() => {
    if (panelView !== 'subscriptions' || !selectedCustomer?.id) {
      return undefined;
    }

    let ignore = false;
    async function loadSubscriptions() {
      setLoadingSubscriptions(true);
      setSubscriptionsError(null);
      try {
        const data = await listCustomerSubscriptions(selectedCustomer.id);
        if (!ignore) {
          setSubscriptions(data);
        }
      } catch (error) {
        if (!ignore) {
          setSubscriptions([]);
          setSubscriptionsError(error);
        }
      } finally {
        if (!ignore) {
          setLoadingSubscriptions(false);
        }
      }
    }

    loadSubscriptions();

    return () => {
      ignore = true;
    };
  }, [panelView, selectedCustomer?.id]);

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
                <th>Suscripciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={selectedCustomer?.id === row.id ? 'selected-row' : ''}>
                  <td>{row.name}</td>
                  <td>{row.telefono__c || '—'}</td>
                  <td>{new Date(row.created_at).toLocaleDateString('es-NI')}</td>
                  <td>
                    <button type="button" className="table-action" onClick={() => openSubscriptions(row)}>
                      <ClipboardList size={15} />
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel__header">
          <h2>{panelView === 'new' ? 'Nuevo Cliente' : 'Suscripciones'}</h2>
          {panelView === 'new' ? <UserRound size={18} /> : <ClipboardList size={18} />}
        </div>
        <div className="panel-tabs">
          <button
            type="button"
            className={panelView === 'new' ? 'panel-tabs__item panel-tabs__item--active' : 'panel-tabs__item'}
            onClick={() => setPanelView('new')}
          >
            <Plus size={15} />
            Nuevo
          </button>
          <button
            type="button"
            className={
              panelView === 'subscriptions' ? 'panel-tabs__item panel-tabs__item--active' : 'panel-tabs__item'
            }
            onClick={showSubscriptionsPanel}
          >
            <ClipboardList size={15} />
            Suscripciones
          </button>
        </div>
        {panelView === 'new' ? (
          <form className="stack" onSubmit={handleSubmit}>
            <TextInput label="Nombre" value={name} onChange={setName} />
            <TextInput label="Telefono" value={phone} onChange={setPhone} type="tel" />
            <button type="submit" className="primary-button">
              <Save size={17} />
              Guardar
            </button>
            {message && <span className="form-message">{message}</span>}
          </form>
        ) : (
          <CustomerSubscriptionsPanel
            customer={selectedCustomer}
            rows={subscriptions}
            loading={loadingSubscriptions}
            error={subscriptionsError}
            onCreateSubscription={onCreateSubscription}
          />
        )}
      </section>
    </div>
  );
}

function createEmptyAccountForm(service = 'Netflix') {
  return {
    email: '',
    password: '',
    service,
    capacity: getServiceCapacity(service),
    active: true,
  };
}

function Accounts({ rows, error, onSaved, session }) {
  const [form, setForm] = useState(createEmptyAccountForm());
  const [editingAccount, setEditingAccount] = useState(null);
  const [message, setMessage] = useState('');
  const isEditing = Boolean(editingAccount);

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

  function clearForm(nextMessage = '') {
    setForm(createEmptyAccountForm(form.service));
    setEditingAccount(null);
    setMessage(nextMessage);
  }

  function editAccount(account) {
    const service = account.tipo_de_servicio__c || 'Netflix';
    setEditingAccount(account);
    setForm({
      email: account.correo_electronico__c || '',
      password: account.contrasena__c || '',
      service,
      capacity: account.capacidad_clientes__c ?? getServiceCapacity(service),
      active: account.activo__c !== false,
    });
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!session) {
      setMessage('Inicia sesion para guardar cuentas.');
      return;
    }

    try {
      if (isEditing) {
        await updateAccount(editingAccount.id, form);
        clearForm('Cuenta actualizada.');
      } else {
        await createAccount(form);
        clearForm('Cuenta guardada.');
      }
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
          <table className="accounts-table">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Contrasena</th>
                <th>Servicio</th>
                <th>Clientes</th>
                <th>Capacidad</th>
                <th>Activa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={editingAccount?.id === row.id ? 'selected-row' : ''}>
                  <td>{row.correo_electronico__c}</td>
                  <td>{row.contrasena__c || '-'}</td>
                  <td>{row.tipo_de_servicio__c}</td>
                  <td>{row.clientes_contador__c}</td>
                  <td>{row.capacidad_clientes__c ?? '—'}</td>
                  <td>{row.activo__c ? 'Si' : 'No'}</td>
                  <td>
                    <button type="button" className="table-action" onClick={() => editAccount(row)}>
                      <Pencil size={15} />
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel__header">
          <h2>{isEditing ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
          {isEditing ? <Pencil size={18} /> : <Plus size={18} />}
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <TextInput label="Correo" type="email" value={form.email} onChange={(value) => updateField('email', value)} />
          <TextInput label="Contrasena" value={form.password} onChange={(value) => updateField('password', value)} />
          <SelectInput label="Servicio" value={form.service} onChange={(value) => updateField('service', value)} options={SERVICES} />
          <label className="field">
            <span>Capacidad</span>
            <input type="number" value={form.capacity} readOnly />
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateField('active', event.target.checked)}
            />
            <span>Cuenta activa</span>
          </label>
          <button type="submit" className="primary-button" disabled={!session}>
            <Save size={17} />
            {isEditing ? 'Actualizar' : 'Guardar'}
          </button>
          {isEditing && (
            <button type="button" className="secondary-button" onClick={() => clearForm()}>
              <X size={17} />
              Cancelar
            </button>
          )}
          {!session && <span className="form-message">Inicia sesion para guardar cuentas.</span>}
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
  const [subscriptionDraft, setSubscriptionDraft] = useState(null);

  function startSubscriptionForCustomer(customer) {
    setSubscriptionDraft({
      requestId: Date.now(),
      customerName: customer.name,
    });
    setActiveTab('new');
  }

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
        {activeTab === 'new' && <NewSubscription customers={customers} onSaved={refreshData} draft={subscriptionDraft} />}
        {activeTab === 'expired' && <ExpiredTable rows={expired} error={errors.expired} />}
        {activeTab === 'cash' && <CashTable rows={cash} error={errors.cash} />}
        {activeTab === 'accounts' && <Accounts rows={accounts} error={errors.accounts} onSaved={refreshData} session={session} />}
        {activeTab === 'customers' && (
          <Customers
            rows={filteredCustomers}
            error={errors.customers}
            onSaved={refreshData}
            onCreateSubscription={startSubscriptionForCustomer}
          />
        )}
      </section>
    </main>
  );
}
