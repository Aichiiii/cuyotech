import { useState } from 'react';
import { api, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Button, Card, Field, PageHeader, PasswordInput, useAction } from '../../components/ui';
import { fmtDateTime } from '../../utils';

const EMPTY = { current_password: '', new_password: '', confirm_password: '' };

export default function Account() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  const submit = (e) => {
    e.preventDefault();
    setErrors({});
    run(() => api.post('/auth/change-password', form), {
      onSuccess: () => setForm(EMPTY),
      onError: (err) => setErrors({ ...fieldErrors(err), _: err.message }),
    });
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader title="Account security" subtitle={`Signed in as ${user.username} · Last login ${fmtDateTime(user.last_login_at)}`} />
      <div className="grid grid-2">
        <Card title="Change password" subtitle="Use at least 8 characters with letters and numbers.">
          <form className="form" onSubmit={submit} noValidate>
            <Field label="Current password" required error={errors.current_password}>
              <PasswordInput autoComplete="current-password" value={form.current_password} onChange={set('current_password')} />
            </Field>
            <Field label="New password" required error={errors.new_password}>
              <PasswordInput autoComplete="new-password" value={form.new_password} onChange={set('new_password')} />
            </Field>
            <Field label="Confirm new password" required error={errors.confirm_password}>
              <PasswordInput autoComplete="new-password" value={form.confirm_password} onChange={set('confirm_password')} />
            </Field>
            <div><Button variant="primary" type="submit" loading={busy}>Update password</Button></div>
          </form>
        </Card>
        <Card title="Your access">
          <dl className="info-list">
            <dt>Role</dt><dd>{user.role_name}</dd>
            {user.staff && <><dt>Office</dt><dd>{user.staff.office_name}</dd><dt>Position</dt><dd>{user.staff.position_title}</dd></>}
            <dt>Permissions</dt>
            <dd>{user.permissions.map((p) => <span key={p} className="chip">{p}</span>)}</dd>
          </dl>
        </Card>
      </div>
    </>
  );
}
