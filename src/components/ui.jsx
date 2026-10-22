// Reusable UI building blocks. All styling comes from styles/app.css.
import { createContext, Fragment, useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Eye, EyeOff, Info, Inbox, X, XCircle } from 'lucide-react';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, footer, flush, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

const TONE_ALIAS = { success: 'green', danger: 'red', info: 'blue', warning: 'gold', '': 'gold' };

/** Dynamic-color status card. tone: red | green | blue | gold (or success | danger | info | warning). */
export function Stat({ label, value, hint, icon: Icon, tone = '', to }) {
  const Tag = to ? Link : 'div';
  const t = TONE_ALIAS[tone] || tone;
  return (
    <Tag className={`stat tone-${t}`} {...(to ? { to } : {})}>
      {Icon && <span className="stat-icon"><Icon /></span>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </Tag>
  );
}

const STATUS_TONE = {
  success: ['Approved', 'Finalized', 'Released', 'Confirmed', 'Completed', 'Published', 'Active', 'Passed', 'Open', 'Paid'],
  warning: ['Submitted', 'Pending review', 'Pending', 'Under review', 'For Review', 'Pending Requirements', 'In Progress', 'Encoded', 'Upcoming', 'Draft', 'Incomplete'],
  danger: ['Rejected', 'For Correction', 'Needs correction', 'Unconfirmed', 'Locked', 'Failed', 'Unpaid', 'Dropped'],
  info: [],
};

export function StatusBadge({ status, label }) {
  if (!status) return <span className="text-faint">—</span>;
  const tone = Object.keys(STATUS_TONE).find((k) => STATUS_TONE[k].includes(status));
  return <span className={`badge ${tone ? `badge-${tone}` : ''}`}>{label || status}</span>;
}

export function Alert({ type = 'info', title, children }) {
  const Icon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle }[type];
  return (
    <div className={`alert alert-${type}`} role="alert">
      <Icon />
      <div>
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

/** Shows an ApiError, including list-style details (e.g. subject validation errors). */
export function ErrorAlert({ error }) {
  if (!error) return null;
  const lists = error.details && typeof error.details === 'object'
    ? Object.values(error.details).filter(Array.isArray).flat()
    : [];
  return (
    <Alert type="danger" title={error.message}>
      {lists.length > 0 && <ul>{lists.map((m, i) => <li key={i}>{m}</li>)}</ul>}
    </Alert>
  );
}

export function Loading({ text = 'Loading…' }) {
  return <div className="loading"><span className="spinner" /> {text}</div>;
}

export function Empty({ icon: Icon = Inbox, title = 'Nothing here yet', text, children }) {
  return (
    <div className="empty">
      <Icon />
      <div className="empty-title">{title}</div>
      {text && <p>{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Button({ variant = '', size = '', loading, children, className = '', ...props }) {
  return (
    <button className={`btn ${variant ? `btn-${variant}` : ''} ${size ? `btn-${size}` : ''} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}

export function Field({ label, required, error, hint, children, className = '' }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && <span className="label">{label}{required && <span className="req">*</span>}</span>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

/**
 * Password input with a show/hide eye-icon toggle.
 * Accepts all standard <input> props (value, onChange, autoComplete, etc.).
 * Wrap in a <Field> for label + error display as usual.
 */
export function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const label = visible ? 'Hide password' : 'Show password';
  return (
    <div className="input-pw">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`input ${className}`}
      />
      <button
        type="button"
        className="input-pw-toggle"
        aria-label={label}
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon />
      </button>
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, size = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size ? `modal-${size}` : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.value;
        const label = typeof t === 'string' ? t : t.label;
        return (
          <button key={key} role="tab" className={`tab ${value === key ? 'active' : ''}`} onClick={() => onChange(key)}>
            {label}
            {t.count != null && <span className="tab-count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Steps({ steps, current }) {
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <Fragment key={s}>
          <span className={`step ${i < current ? 'done' : i === current ? 'current' : ''}`}>
            <span className="step-dot">{i < current ? '✓' : i + 1}</span>
            {s}
          </span>
          {i < steps.length - 1 && <span className="step-line" />}
        </Fragment>
      ))}
    </div>
  );
}

export function CheckList({ items }) {
  return (
    <ul className="check-list">
      {items.map((c) => (
        <li key={c.label} className={c.ok ? 'ok' : 'no'}>
          {c.ok ? <CheckCircle2 /> : <XCircle />} {c.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Toasts ---------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const api = { success: (m) => push(m, 'success'), error: (m) => push(m, 'error') };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? <AlertCircle /> : <CheckCircle2 />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/**
 * Hook for running an API action with loading state + toast feedback.
 * const [run, busy] = useAction(); run(() => api.post(...), { onSuccess })
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn, { onSuccess, onError, silent } = {}) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!silent && res?.message) toast.success(res.message);
      await onSuccess?.(res);
      return res;
    } catch (e) {
      if (onError) onError(e);
      else toast.error(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return [run, busy];
}
