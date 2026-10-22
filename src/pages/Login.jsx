import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { fieldErrors } from '../api';
import { Alert, Button, Field, Modal, PasswordInput } from '../components/ui';
import logo from '../assets/logo-crest.png';

const DEMO = [
  ['2023-00001', 'Student (Juan)'],
  ['2023-00002', 'Student (Maria)'],
  ['registrar', 'Registrar'],
  ['cashier', 'Cashier'],
  ['dept.ccs', 'Department (CCS)'],
  ['admin', 'Administrator'],
];

const REMEMBER_KEY = 'ssis.rememberedUsername';
const readRemembered = () => {
  try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch { return ''; }
};
const saveRemembered = (value) => {
  try { value ? localStorage.setItem(REMEMBER_KEY, value) : localStorage.removeItem(REMEMBER_KEY); } catch { /* storage unavailable */ }
};

export default function Login() {
  const { login, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const remembered = readRemembered();
  const [form, setForm] = useState({ username: remembered, password: '' });
  const [remember, setRemember] = useState(!!remembered);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    // Client-side validation (the API validates again)
    const v = {};
    if (!form.username.trim()) v.username = 'Student ID / Username is required.';
    if (!form.password) v.password = 'Password is required.';
    setErrors(v);
    if (Object.keys(v).length) return;

    setBusy(true);
    setError('');
    try {
      await login(form.username.trim(), form.password);
      saveRemembered(remember ? form.username.trim() : '');
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      const left = err.details?.attempts_left;
      setError(err.message + (left && left <= 3 ? ` ${left} attempt(s) left before the account is locked.` : ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-brand">
          <img className="brand-logo" src={logo} alt="" />
          CuyoTech University
        </div>
        <div className="glass-card">
          <h1>Skip the queue.</h1>
          <p>Enrollment, clearance, grades, and document requests in one place.</p>
          <ul>
            <li>Enroll and track your application online</li>
            <li>View your subjects and published grades</li>
            <li>Check your clearance status for every office</li>
            <li>Request your TOR, COR, and certifications</li>
          </ul>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-box form" onSubmit={submit} noValidate>
          <div>
            <h2>Welcome back</h2>
            <p className="text-muted text-xs mt-2">Sign in with your university account to access the Student Portal.</p>
          </div>
          {notice && !error && <Alert type="warning">{notice}</Alert>}
          {error && <Alert type="danger">{error}</Alert>}
          <Field label="Student ID / Username" error={errors.username}>
            <input className="input" autoFocus={!remembered} autoComplete="username" placeholder="e.g. 2026-00000"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label="Password" error={errors.password}>
            <PasswordInput autoFocus={!!remembered} autoComplete="current-password" placeholder="Enter your password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <div className="login-meta">
            <label className="checkbox text-xs"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <button type="button" onClick={() => setForgot(true)}>Forgot password?</button>
          </div>
          <Button variant="primary" className="btn-block" loading={busy} type="submit">Sign in</Button>
          <p className="login-foot">Accounts are issued by the university administrator. Need help? Visit the Registrar's Office.</p>

          <details className="demo-accounts">
            <summary>Demo accounts (password: <code>password123</code>)</summary>
            <table>
              <tbody>
                {DEMO.map(([u, label]) => (
                  <tr key={u}>
                    <td>{label}</td>
                    <td className="text-right"><button type="button" onClick={() => setForm({ username: u, password: 'password123' })}>{u}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </form>
      </section>

      <Modal open={forgot} title="Forgot your password?" onClose={() => setForgot(false)} footer={<Button variant="primary" onClick={() => setForgot(false)}>OK</Button>}>
        <p className="text-sm">For your security, passwords are reset only by the System Administrator after verifying your identity.</p>
        <p className="text-sm mt-3">Please visit the <strong>Registrar's Office</strong> or the <strong>Office of Administration</strong> and bring a valid school ID. You will receive a temporary password that you must change after signing in.</p>
      </Modal>
    </div>
  );
}
