import { useEffect, useState } from 'react';
import { api, fieldErrors } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Button, Card, ErrorAlert, Field, Loading, PageHeader, StatusBadge, useAction } from '../../components/ui';
import { fmtDate, useApi, yearLevel } from '../../utils';

export default function Profile() {
  const { refresh } = useAuth();
  const { data, error, loading, reload } = useApi('/student/profile');
  const [form, setForm] = useState({ email: '', contact_number: '', address: '' });
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  useEffect(() => {
    if (data) setForm({ email: data.profile.email || '', contact_number: data.profile.contact_number || '', address: data.profile.address || '' });
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;
  const p = data.profile;

  const save = (e) => {
    e.preventDefault();
    setErrors({});
    run(() => api.put('/student/profile', form), {
      onSuccess: () => { reload(); refresh(); },
      onError: (err) => setErrors(fieldErrors(err)),
    });
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Your student record. Official details are maintained by the Registrar." />
      <div className="grid grid-2">
        <Card title="Student information" actions={<StatusBadge status={p.student_status} />}>
          <dl className="info-list">
            <dt>Student number</dt><dd>{p.student_number}</dd>
            <dt>Full name</dt><dd>{[p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')}</dd>
            <dt>Program</dt><dd>{p.program_code} — {p.program_name}</dd>
            <dt>Department</dt><dd>{p.department_name}</dd>
            <dt>Year level</dt><dd>{yearLevel(p.year_level)}</dd>
            <dt>Birth date</dt><dd>{fmtDate(p.birth_date)}</dd>
            <dt>Username</dt><dd>{data.username}</dd>
          </dl>
        </Card>
        <Card title="Contact details" subtitle="You may update these fields.">
          <form className="form" onSubmit={save} noValidate>
            <Field label="Email address" required error={errors.email}>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Contact number" error={errors.contact_number} hint="e.g. 0917 123 4567">
              <input className="input" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
            </Field>
            <Field label="Address" error={errors.address}>
              <textarea className="textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Alert type="info">To correct your name, birth date or program, please file a request with the Registrar.</Alert>
            <div><Button variant="primary" type="submit" loading={busy}>Save changes</Button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
