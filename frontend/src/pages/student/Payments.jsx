import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Wallet } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, useAction } from '../../components/ui';
import { fmtDateTime, peso, useApi } from '../../utils';

export default function Payments() {
  const { data, error, loading, reload } = useApi('/student/payments');
  const [paying, setPaying] = useState(null);
  const [form, setForm] = useState({ payment_method: 'E-Wallet', reference_number: '' });
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const due = data.transactions.filter((t) => t.payment.state !== 'Confirmed');

  const pay = () =>
    run(() => api.post('/student/payments', { transaction_type: paying.transaction_type, transaction_id: paying.transaction_id, ...form }), {
      onSuccess: () => { setPaying(null); reload(); },
      onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }),
    });

  return (
    <>
      <PageHeader title="Payments" subtitle="Pay assessed fees and get your official receipts." />
      <div className="stack">
        <Card title="Payables" subtitle="Approved enrollments and document requests with fees." flush>
          {!due.length ? <Empty icon={Wallet} title="No pending payables" text="You have no unpaid fees." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Transaction</th><th className="num">Amount</th><th>Payment status</th><th /></tr></thead>
                <tbody>
                  {due.map((t) => (
                    <tr key={`${t.transaction_type}-${t.transaction_id}`}>
                      <td>
                        <div className="cell-main">{t.description}</div>
                        {t.payment.last_payment?.payment_status === 'Unconfirmed' && t.payment.state === 'Unpaid' && (
                          <div className="cell-sub text-danger">Last payment unconfirmed: {t.payment.last_payment.remarks}</div>
                        )}
                      </td>
                      <td className="num fw-600">{peso(t.amount)}</td>
                      <td><StatusBadge status={t.payment.state === 'Submitted' ? 'For Review' : t.payment.state} label={t.payment.state === 'Submitted' ? 'Awaiting verification' : undefined} /></td>
                      <td className="actions">
                        {t.payment.state === 'Unpaid' && (
                          <Button size="sm" variant="primary" onClick={() => { setPaying(t); setErrors({}); setForm({ payment_method: 'E-Wallet', reference_number: '' }); }}><Wallet /> Pay</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Payment history" flush>
          {!data.history.length ? <Empty icon={Receipt} title="No payments yet" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Method</th><th className="num">Amount</th><th>Status</th><th>Receipt</th></tr></thead>
                <tbody>
                  {data.history.map((p) => (
                    <tr key={p.payment_id}>
                      <td className="nowrap text-sm">{fmtDateTime(p.submitted_at)}</td>
                      <td>{p.description}{p.remarks && <div className="cell-sub">{p.remarks}</div>}</td>
                      <td>{p.payment_method}{p.reference_number && <div className="cell-sub mono">{p.reference_number}</div>}</td>
                      <td className="num">{peso(p.amount)}</td>
                      <td><StatusBadge status={p.payment_status} /></td>
                      <td>{p.receipt_id ? <Link to={`/print/receipt/${p.receipt_id}`} className="mono">{p.receipt_number}</Link> : <span className="text-faint">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!paying}
        title="Submit payment"
        onClose={() => setPaying(null)}
        footer={<><Button onClick={() => setPaying(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={pay}>Submit payment</Button></>}
      >
        {paying && (
          <div className="form">
            <dl className="info-list">
              <dt>For</dt><dd>{paying.description}</dd>
              <dt>Amount due</dt><dd className="fw-600">{peso(paying.amount)}</dd>
            </dl>
            {errors._ && !errors.reference_number && <Alert type="danger">{errors._}</Alert>}
            <Field label="Payment method" required error={errors.payment_method}>
              <select className="select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option>E-Wallet</option><option>Bank Transfer</option><option>Cash</option>
              </select>
            </Field>
            <Field
              label="Reference number"
              required={form.payment_method !== 'Cash'}
              error={errors.reference_number}
              hint={form.payment_method === 'Cash' ? 'Pay at the Cashier window; the cashier will verify your payment.' : 'Copy the reference number from your e-wallet or bank confirmation.'}
            >
              <input className="input" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="e.g. GC-12345678" />
            </Field>
            <Alert type="info">The Cashier verifies every payment. An official receipt is issued only after confirmation.</Alert>
          </div>
        )}
      </Modal>
    </>
  );
}
