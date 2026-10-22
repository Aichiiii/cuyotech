import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CheckCircle2, Receipt, XCircle } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, Tabs, useAction } from '../../components/ui';
import { fmtDateTime, peso, useApi } from '../../utils';

const TABS = [
  { value: 'Submitted', label: 'To verify' },
  { value: 'NoReceipt', label: 'Receipt to issue' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Unconfirmed', label: 'Unconfirmed' },
  { value: '', label: 'All' },
];

export default function PaymentVerification() {
  const [tab, setTab] = useState('Submitted');
  const { data, error, loading, reload } = useApi(`/cashier/payments?status=${tab}`);
  const [rejecting, setRejecting] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  const confirm = (p) => run(() => api.post(`/cashier/payments/${p.payment_id}/verify`, { action: 'confirm' }), { onSuccess: reload });
  const issue = (p) => run(() => api.post(`/cashier/payments/${p.payment_id}/receipt`), { onSuccess: reload });
  const unconfirm = () =>
    run(() => api.post(`/cashier/payments/${rejecting.payment_id}/verify`, { action: 'unconfirm', remarks }), {
      onSuccess: () => { setRejecting(null); setRemarks(''); reload(); },
      onError: (e) => setErrors(fieldErrors(e)),
    });

  return (
    <>
      <PageHeader title="Payment Verification" subtitle="Confirm payments against your collections, then issue the official receipt." />
      <Card flush>
        <div className="card-header"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
        {error && <div className="card-body"><ErrorAlert error={error} /></div>}
        {loading && !data ? <Loading /> : !data?.payments.length ? <Empty icon={Banknote} title="Nothing to show" text="No payments in this list." /> : (
          <div className="table-wrap card-table">
            <table className="table">
              <thead><tr><th>Submitted</th><th>Student</th><th>For</th><th>Method / Ref.</th><th className="num">Amount</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.payment_id}>
                    <td className="text-sm nowrap mob-hide" data-label="Submitted">{fmtDateTime(p.submitted_at)}<div className="cell-sub">Payment #{p.payment_id}</div></td>
                    <td data-label="Student"><div className="cell-main">{p.last_name}, {p.first_name}</div><div className="cell-sub">{p.student_number} · {p.program_code}</div></td>
                    <td className="text-sm mob-hide" data-label="For">{p.description}</td>
                    <td className="mob-hide" data-label="Method">{p.payment_method}<div className="cell-sub mono">{p.reference_number || '—'}</div></td>
                    <td className="num fw-600" data-label="Amount">{peso(p.amount)}</td>
                    <td data-label="Status">
                      <StatusBadge status={p.payment_status} />
                      {p.remarks && <div className="cell-sub">{p.remarks}</div>}
                      {p.verified_by_name && <div className="cell-sub">by {p.verified_by_name}</div>}
                    </td>
                    <td className="actions">
                      {p.payment_status === 'Submitted' && (
                        <>
                          <Button size="sm" variant="success" disabled={busy} onClick={() => confirm(p)}><CheckCircle2 /> Confirm</Button>
                          <Button size="sm" variant="danger" onClick={() => { setRejecting(p); setErrors({}); }}><XCircle /> Unconfirm</Button>
                        </>
                      )}
                      {p.payment_status === 'Confirmed' && !p.receipt_id && <Button size="sm" variant="primary" disabled={busy} onClick={() => issue(p)}><Receipt /> Issue receipt</Button>}
                      {p.receipt_id && <Link className="btn btn-sm" to={`/print/receipt/${p.receipt_id}`}>{p.receipt_number}</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!rejecting}
        title="Mark payment as unconfirmed"
        onClose={() => setRejecting(null)}
        footer={<><Button onClick={() => setRejecting(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={unconfirm}>Mark unconfirmed</Button></>}
      >
        {rejecting && (
          <div className="form">
            <Alert type="warning">The student will be notified and asked to submit a new payment. No receipt will be issued.</Alert>
            <p className="text-sm">{rejecting.first_name} {rejecting.last_name} · {peso(rejecting.amount)} · {rejecting.payment_method} {rejecting.reference_number}</p>
            <Field label="Reason" required error={errors.remarks}>
              <textarea className="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Reference number not found in e-wallet records" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
