import { useState } from 'react';
import { CheckCircle2, ClipboardX, ShieldCheck } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, Tabs, useAction } from '../../components/ui';
import { fmtDateTime, useApi } from '../../utils';

const TABS = ['For Review', 'Pending Requirements', 'Approved', 'All'];

export default function ClearanceQueue() {
  const [tab, setTab] = useState('For Review');
  const { data, error, loading, reload } = useApi(`/clearance/queue?status=${encodeURIComponent(tab)}`);
  const [pendingFor, setPendingFor] = useState(null);
  const [items, setItems] = useState('');
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  const approve = (row) => run(() => api.post(`/clearance/decisions/${row.decision_id}`, { action: 'approve' }), { onSuccess: reload });
  const savePending = () =>
    run(() => api.post(`/clearance/decisions/${pendingFor.decision_id}`, { action: 'pending', pending_items: items }), {
      onSuccess: () => { setPendingFor(null); reload(); },
      onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }),
    });

  const isCashier = data?.office_type === 'Cashier';

  return (
    <>
      <PageHeader
        title="Office Clearance"
        subtitle={data ? `${data.office} — approve the clearance or list what the student still needs to resolve.` : 'Clearance items for your office'}
      />
      <Card flush>
        <div className="card-header"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
        {error && <div className="card-body"><ErrorAlert error={error} /></div>}
        {loading && !data ? <Loading /> : !data?.items.length ? (
          <Empty icon={ShieldCheck} title="No clearance items" text={`There are no items under "${tab}".`} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th><th>Purpose</th><th>Overall progress</th>
                  {isCashier && <th>Outstanding fees</th>}
                  <th>Office status</th><th>Last update</th><th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.decision_id}>
                    <td>
                      <div className="cell-main">{r.first_name} {r.last_name}</div>
                      <div className="cell-sub">{r.student_number} · {r.program_code} {r.year_level}</div>
                    </td>
                    <td>
                      <div>{r.purpose}</div>
                      <div className="cell-sub">Clearance #{r.clearance_id} · {r.term_label}</div>
                    </td>
                    <td>
                      <div className="text-xs mb-2">{r.approved_offices} of {r.total_offices} offices</div>
                      <div className="progress"><div className="progress-bar" style={{ width: `${(r.approved_offices / r.total_offices) * 100}%` }} /></div>
                    </td>
                    {isCashier && (
                      <td>{r.outstanding?.length ? r.outstanding.map((o) => <div key={o} className="text-xs text-danger">{o}</div>) : <span className="text-xs text-success">None</span>}</td>
                    )}
                    <td>
                      <StatusBadge status={r.decision_status} />
                      {r.pending_items && <div className="cell-sub mt-1">{r.pending_items}</div>}
                    </td>
                    <td className="text-xs">
                      {r.resubmitted_at ? <>Resubmitted<br />{fmtDateTime(r.resubmitted_at)}</> : r.decided_at ? <>{r.decided_by_name}<br />{fmtDateTime(r.decided_at)}</> : fmtDateTime(r.submitted_at)}
                    </td>
                    <td className="actions">
                      {r.clearance_status === 'In Progress' && r.decision_status !== 'Approved' && (
                        <>
                          <Button size="sm" variant="success" onClick={() => approve(r)} disabled={busy}><CheckCircle2 /> Approve</Button>
                          {r.decision_status === 'For Review' && (
                            <Button size="sm" variant="warning" onClick={() => { setPendingFor(r); setItems(''); setErrors({}); }}><ClipboardX /> Pending</Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!pendingFor}
        title="Record pending requirements"
        onClose={() => setPendingFor(null)}
        footer={<><Button onClick={() => setPendingFor(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={savePending}>Save</Button></>}
      >
        {pendingFor && (
          <div className="form">
            <Alert type="info">The student will be notified and can resubmit to <strong>your office only</strong> after resolving these items.</Alert>
            <p className="text-sm"><strong>{pendingFor.first_name} {pendingFor.last_name}</strong> — {pendingFor.purpose}</p>
            <Field label="Requirements to resolve" required error={errors.pending_items}>
              <textarea className="textarea" value={items} onChange={(e) => setItems(e.target.value)} placeholder="e.g. Return borrowed laboratory equipment" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
