import { useState } from 'react';
import { Pencil, Search, UserPlus, Users as UsersIcon } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, useAction } from '../../components/ui';
import { fmtDateTime, useApi } from '../../utils';

const NEW_USER = {
  role_code: 'STUDENT', username: '', password: '', first_name: '', middle_name: '', last_name: '', email: '',
  student_number: '', program_id: '', year_level: 1, employee_number: '', office_id: '', position_title: '',
};

export default function Users() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState({ role: '', status: '', search: '' });
  const { data, error, loading, reload } = useApi(`/admin/users?${new URLSearchParams(filters)}`);
  const lookups = useApi('/admin/lookups');
  const [creating, setCreating] = useState(null);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  const create = () => {
    setErrors({});
    const body = { ...creating, program_id: Number(creating.program_id) || null, office_id: Number(creating.office_id) || null, year_level: Number(creating.year_level) };
    run(() => api.post('/admin/users', body), {
      onSuccess: () => { setCreating(null); reload(); },
      onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }),
    });
  };
  const update = () => {
    setErrors({});
    run(() => api.put(`/admin/users/${editing.user_id}`, { account_status: editing.account_status, new_password: editing.new_password }), {
      onSuccess: () => { setEditing(null); reload(); },
      onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }),
    });
  };
  const set = (k) => (e) => setCreating({ ...creating, [k]: e.target.value });
  const isStudent = creating?.role_code === 'STUDENT';

  return (
    <>
      <PageHeader
        title="User Accounts"
        subtitle="Create accounts, assign roles, activate, deactivate or unlock users."
        actions={<Button variant="primary" onClick={() => { setErrors({}); setCreating(NEW_USER); }}><UserPlus /> New account</Button>}
      />
      <Card flush>
        <div className="card-header">
          <div className="filters">
            <div className="input-icon"><Search /><input className="input" placeholder="Search name, username, email…" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
            <select className="select" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
              <option value="">All roles</option>
              {lookups.data?.roles.map((r) => <option key={r.role_code} value={r.role_code}>{r.role_name}</option>)}
            </select>
            <select className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option><option>Active</option><option>Inactive</option><option>Locked</option>
            </select>
          </div>
        </div>
        {error && <div className="card-body"><ErrorAlert error={error} /></div>}
        {loading && !data ? <Loading /> : !data?.users.length ? <Empty icon={UsersIcon} title="No users found" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>User</th><th>Role</th><th>ID no.</th><th>Program / Office</th><th>Last login</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.user_id}>
                    <td><div className="cell-main">{u.first_name} {u.last_name}</div><div className="cell-sub">{u.username} · {u.email}</div></td>
                    <td><span className="badge badge-brand plain">{u.role_name}</span></td>
                    <td className="mono text-sm">{u.id_number}</td>
                    <td className="text-sm">{u.unit}</td>
                    <td className="text-sm nowrap">{fmtDateTime(u.last_login_at)}</td>
                    <td><StatusBadge status={u.account_status} /></td>
                    <td className="actions"><Button size="sm" onClick={() => { setErrors({}); setEditing({ ...u, new_password: '' }); }}><Pencil /> Manage</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!creating}
        title="New account"
        size="lg"
        onClose={() => setCreating(null)}
        footer={<><Button onClick={() => setCreating(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={create}>Create account</Button></>}
      >
        {creating && (
          <div className="form">
            {errors._ && <Alert type="danger">{errors._}</Alert>}
            <div className="form-grid">
              <Field label="Role" required error={errors.role_code}>
                <select className="select" value={creating.role_code} onChange={set('role_code')}>
                  {lookups.data?.roles.map((r) => <option key={r.role_code} value={r.role_code}>{r.role_name}</option>)}
                </select>
              </Field>
              <Field label="Username" required error={errors.username} hint={isStudent ? 'Use the student number' : 'Letters, numbers, dot, dash'}>
                <input className="input" value={creating.username} onChange={set('username')} />
              </Field>
              <Field label="First name" required error={errors.first_name}><input className="input" value={creating.first_name} onChange={set('first_name')} /></Field>
              <Field label="Middle name" error={errors.middle_name}><input className="input" value={creating.middle_name} onChange={set('middle_name')} /></Field>
              <Field label="Last name" required error={errors.last_name}><input className="input" value={creating.last_name} onChange={set('last_name')} /></Field>
              <Field label="Email" required error={errors.email}><input className="input" type="email" value={creating.email} onChange={set('email')} /></Field>
              {isStudent ? (
                <>
                  <Field label="Student number" required error={errors.student_number} hint="Format: 2026-00001"><input className="input" value={creating.student_number} onChange={set('student_number')} /></Field>
                  <Field label="Program" required error={errors.program_id}>
                    <select className="select" value={creating.program_id} onChange={set('program_id')}>
                      <option value="">Select…</option>
                      {lookups.data?.programs.map((p) => <option key={p.program_id} value={p.program_id}>{p.program_code} — {p.program_name}</option>)}
                    </select>
                  </Field>
                  <Field label="Year level" required error={errors.year_level}>
                    <select className="select" value={creating.year_level} onChange={set('year_level')}>{[1, 2, 3, 4, 5].map((y) => <option key={y}>{y}</option>)}</select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Employee number" required error={errors.employee_number}><input className="input" value={creating.employee_number} onChange={set('employee_number')} /></Field>
                  <Field label="Office" required error={errors.office_id}>
                    <select className="select" value={creating.office_id} onChange={set('office_id')}>
                      <option value="">Select…</option>
                      {lookups.data?.offices.map((o) => <option key={o.office_id} value={o.office_id}>{o.office_name}</option>)}
                    </select>
                  </Field>
                  <Field label="Position title" required error={errors.position_title}><input className="input" value={creating.position_title} onChange={set('position_title')} /></Field>
                </>
              )}
              <Field label="Temporary password" required error={errors.password} hint="At least 8 characters. Ask the user to change it after first login.">
                <input className="input" type="text" autoComplete="new-password" value={creating.password} onChange={set('password')} />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!editing}
        title={`Manage ${editing?.username}`}
        onClose={() => setEditing(null)}
        footer={<><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={update}>Save</Button></>}
      >
        {editing && (
          <div className="form">
            {errors._ && <Alert type="danger">{errors._}</Alert>}
            <dl className="info-list">
              <dt>Name</dt><dd>{editing.first_name} {editing.last_name}</dd>
              <dt>Role</dt><dd>{editing.role_name}</dd>
              <dt>Created</dt><dd>{fmtDateTime(editing.created_at)}</dd>
            </dl>
            {editing.account_status === 'Locked' && <Alert type="warning">This account was locked (e.g. too many failed logins). Set it to Active to unlock.</Alert>}
            <Field label="Account status" required error={errors.account_status} hint={editing.user_id === me.user_id ? 'You cannot deactivate your own account.' : ''}>
              <select className="select" value={editing.account_status} onChange={(e) => setEditing({ ...editing, account_status: e.target.value })}>
                <option>Active</option><option>Inactive</option><option>Locked</option>
              </select>
            </Field>
            <Field label="Reset password (optional)" error={errors.new_password} hint="Leave blank to keep the current password.">
              <input className="input" type="text" autoComplete="new-password" value={editing.new_password} onChange={(e) => setEditing({ ...editing, new_password: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
