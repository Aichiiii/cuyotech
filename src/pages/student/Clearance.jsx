import { useState } from 'react';
import { ClipboardCheck, RotateCcw, XCircle } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, useAction } from '../../components/ui';
import { fmtDateTime, useApi } from '../../utils';

export default function Clearance() {
  const { data, error, loading, reload } = useApi('/student/clearances');
  const [purpose, setPurpose] = useState('');
  const [errors, setErrors] = useState({});
  const [resubmit, setResubmit] = useState(null);
  const [note, setNote] = useState('');
  const [run, busy] = useAction();

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const termId = data.open_term?.term_id;
  const active = data.clearances.find((c) => c.term_id === termId && ['In Progress', 'Completed'].includes(c.clearance_status));

  const request = (e) => {
    e.preventDefault();
    setErrors({});
    run(() => api.post('/student/clearances', { purpose }), {
      onSuccess: () => { setPurpose(''); reload(); },
      onError: (err) => setErrors({ ...fieldErrors(err), _: err.message }),
    });
  };
  const doResubmit = () =>
    run(() => api.post(`/student/clearances/${resubmit.c.clearance_id}/decisions/${resubmit.d.decision_id}/resubmit`, { note }), {
      onSuccess: () => { setResubmit(null); setNote(''); reload(); },
    });
  const cancel = (c) => run(() => api.post(`/student/clearances/${c.clearance_id}/cancel`), { onSuccess: reload });

  return (
    <>
      <PageHeader title="Clearance" subtitle="Your clearance is complete only when every required office approves." />
      <div className="stack">
        {!active && data.open_term && (
          <Card title={`Request clearance — ${data.open_term.label}`} subtitle="Your request is routed to your department, the Registrar and the Cashier.">
            <form className="form" onSubmit={request} noValidate>
              {errors._ && !errors.purpose && <Alert type="danger">{errors._}</Alert>}
              <Field label="Purpose" required error={errors.purpose}>
                <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Requirement for Transcript of Records" />
              </Field>
              <div><Button variant="primary" type="submit" loading={busy}><ClipboardCheck /> Request clearance</Button></div>
            </form>
          </Card>
        )}

        {!data.clearances.length ? <Card><Empty icon={ClipboardCheck} title="No clearance requests yet" /></Card> : data.clearances.map((c) => (
          <Card
            key={c.clearance_id}
            title={`Clearance #${c.clearance_id} — ${c.term_label}`}
            subtitle={`${c.purpose} · Requested ${fmtDateTime(c.submitted_at)}`}
            actions={<>
              <StatusBadge status={c.clearance_status} />
              {c.clearance_status === 'In Progress' && <Button size="sm" variant="ghost" onClick={() => cancel(c)} disabled={busy}><XCircle /> Cancel</Button>}
            </>}
            flush
          >
            <div className="card-body">
              <div className="row-between text-sm mb-2"><span>{c.approved_count} of {c.decisions.length} offices approved</span>{c.completed_at && <span className="text-success">Completed {fmtDateTime(c.completed_at)}</span>}</div>
              <div className="progress"><div className="progress-bar" style={{ width: `${(c.approved_count / c.decisions.length) * 100}%` }} /></div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Office</th><th>Status</th><th>Pending requirements</th><th>Decided</th><th /></tr></thead>
                <tbody>
                  {c.decisions.map((d) => (
                    <tr key={d.decision_id}>
                      <td><div className="cell-main">{d.office_name}</div><div className="cell-sub">{d.office_type}</div></td>
                      <td><StatusBadge status={d.decision_status} /></td>
                      <td className="text-sm">{d.decision_status === 'Pending Requirements' ? d.pending_items : <span className="text-faint">—</span>}{d.resubmitted_at && <div className="cell-sub">Resubmitted {fmtDateTime(d.resubmitted_at)}</div>}</td>
                      <td className="text-xs">{d.decided_at ? <>{d.decided_by_name}<br />{fmtDateTime(d.decided_at)}</> : '—'}</td>
                      <td className="actions">
                        {c.clearance_status === 'In Progress' && d.decision_status === 'Pending Requirements' && (
                          <Button size="sm" variant="primary" onClick={() => setResubmit({ c, d })}><RotateCcw /> Resubmit</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!resubmit}
        title={`Resubmit to ${resubmit?.d.office_name}`}
        onClose={() => setResubmit(null)}
        footer={<><Button onClick={() => setResubmit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={doResubmit}>Resubmit</Button></>}
      >
        {resubmit && (
          <div className="form">
            <Alert type="warning" title="Pending requirement">{resubmit.d.pending_items}</Alert>
            <Field label="Note to the office (optional)">
              <textarea className="textarea" value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Laptop returned on Oct 15 to Mr. Santos" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
