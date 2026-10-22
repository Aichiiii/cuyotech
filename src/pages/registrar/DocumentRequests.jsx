import { useState } from 'react';
import { BadgeCheck, FileCheck2, PackageCheck, RotateCcw, XCircle } from 'lucide-react';
import { api } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, Tabs, useAction } from '../../components/ui';
import { fmtDate, fmtDateTime, peso, useApi } from '../../utils';

const TABS = ['Submitted', 'Approved', 'For Correction', 'Released', 'Rejected', 'Cancelled', 'All'];

export default function DocumentRequests() {
  const [tab, setTab] = useState('Submitted');
  const { data, error, loading, reload } = useApi(`/registrar/documents?status=${tab === 'All' ? '' : encodeURIComponent(tab)}`);
  const [decision, setDecision] = useState(null); // { r, action }
  const [reason, setReason] = useState('');
  const [run, busy] = useAction();

  const decide = () =>
    run(() => api.post(`/registrar/documents/${decision.r.request_id}/decision`, { action: decision.action, reason }), {
      onSuccess: () => { setDecision(null); setReason(''); reload(); },
    });
  const release = (r) => run(() => api.post(`/registrar/documents/${r.request_id}/release`), { onSuccess: reload });
  const titles = { approve: 'Approve request', correct: 'Return for correction', reject: 'Reject request' };

  return (
    <>
      <PageHeader title="Document Requests" subtitle="Review eligibility, check clearance when the document requires it, and release after payment." />
      <Card flush>
        <div className="card-header"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
        {error && <div className="card-body"><ErrorAlert error={error} /></div>}
        {loading && !data ? <Loading /> : !data?.requests.length ? <Empty icon={FileCheck2} title="No requests" text={`No document requests under "${tab}".`} /> : (
          <div className="table-wrap card-table">
            <table className="table">
              <thead><tr><th>Request</th><th>Student</th><th>Clearance</th><th className="num">Fee</th><th>Payment</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.requests.map((r) => {
                  const feeOk = r.fee.total === 0 || r.payment.state === 'Confirmed';
                  return (
                    <tr key={r.request_id}>
                      <td data-label="Request">
                        <div className="cell-main">{r.document_name} × {r.copies}</div>
                        <div className="cell-sub">#{r.request_id} · {r.delivery_channel} · {fmtDate(r.submitted_at)} · due {fmtDate(r.due_date)}</div>
                        <div className="cell-sub">{r.purpose}</div>
                      </td>
                      <td data-label="Student"><div className="cell-main">{r.last_name}, {r.first_name}</div><div className="cell-sub">{r.student_number} · {r.program_code}</div></td>
                      <td className="mob-hide" data-label="Clearance">{Number(r.requires_clearance) ? (r.completed_clearance_id ? <span className="badge badge-success">Completed</span> : <span className="badge badge-danger">Required</span>) : <span className="text-faint text-xs">Not required</span>}</td>
                      <td className="num mob-hide" data-label="Fee">{r.fee.total > 0 ? peso(r.fee.total) : 'Free'}</td>
                      <td className="mob-hide" data-label="Payment">{r.fee.total > 0 ? <StatusBadge status={r.payment.state} /> : <span className="text-faint">—</span>}</td>
                      <td data-label="Status">
                        <StatusBadge status={r.request_status} />
                        {r.released_at && <div className="cell-sub">{fmtDateTime(r.released_at)}</div>}
                      </td>
                      <td className="actions">
                        {r.request_status === 'Submitted' && (
                          <>
                            <Button size="sm" variant="success" onClick={() => setDecision({ r, action: 'approve' })}><BadgeCheck /> Approve</Button>
                            <Button size="sm" variant="warning" onClick={() => setDecision({ r, action: 'correct' })}><RotateCcw /></Button>
                            <Button size="sm" variant="danger" onClick={() => setDecision({ r, action: 'reject' })}><XCircle /></Button>
                          </>
                        )}
                        {r.request_status === 'Approved' && (
                          <Button size="sm" variant="primary" disabled={!feeOk || busy} title={feeOk ? '' : 'Waiting for confirmed payment'} onClick={() => release(r)}><PackageCheck /> Release</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!decision}
        title={decision ? titles[decision.action] : ''}
        onClose={() => setDecision(null)}
        footer={<><Button onClick={() => setDecision(null)}>Cancel</Button><Button variant={decision?.action === 'reject' ? 'danger' : 'primary'} loading={busy} onClick={decide}>Confirm</Button></>}
      >
        {decision && (
          <div className="form">
            <p><strong>{decision.r.document_name}</strong> × {decision.r.copies} for {decision.r.first_name} {decision.r.last_name} — “{decision.r.purpose}”</p>
            {decision.action === 'approve' && Number(decision.r.requires_clearance) === 1 && !decision.r.completed_clearance_id && (
              <Alert type="danger">This document requires a completed clearance, and the student has none. Approval will be blocked.</Alert>
            )}
            {decision.action === 'approve' && decision.r.fee.total > 0 && <Alert type="info">The student will be asked to pay {peso(decision.r.fee.total)} before release.</Alert>}
            {decision.action !== 'approve' && (
              <Field label={decision.action === 'reject' ? 'Reason for rejection' : 'What should the student correct?'} required>
                <textarea className="textarea" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
