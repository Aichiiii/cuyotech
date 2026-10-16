import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenCheck, FileText, Save, Send, XCircle } from 'lucide-react';
import { api } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Loading, Modal, PageHeader, StatusBadge, Steps, useAction } from '../../components/ui';
import { fmtDate, fmtDateTime, peso, useApi } from '../../utils';

const EDITABLE = ['Draft', 'For Correction'];
const STEPS = ['Select subjects', 'Submitted', 'Approved', 'Paid', 'Finalized'];

function stepIndex(enr, payment, fees) {
  if (!enr || EDITABLE.includes(enr.enrollment_status)) return 0;
  if (enr.enrollment_status === 'Submitted') return 1;
  if (enr.enrollment_status === 'Approved') return payment?.state === 'Confirmed' || fees?.total === 0 ? 4 : 2;
  if (enr.enrollment_status === 'Finalized') return 5;
  return 0;
}

export default function Enrollment() {
  const { data, error, loading, reload } = useApi('/student/enrollment');
  const [selected, setSelected] = useState([]);
  const [formError, setFormError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [run, busy] = useAction();

  const enr = data?.enrollment;
  const editing = !enr || EDITABLE.includes(enr.enrollment_status) || ['Cancelled', 'Rejected'].includes(enr.enrollment_status);

  useEffect(() => {
    if (data?.subjects && enr && EDITABLE.includes(enr.enrollment_status)) setSelected(data.subjects.map((s) => s.offering_id));
    else setSelected([]);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const units = useMemo(
    () => (data?.offerings || []).filter((o) => selected.includes(o.offering_id)).reduce((a, o) => a + Number(o.units), 0),
    [data, selected]
  );

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;
  if (!data.term) {
    return (<><PageHeader title="Enrollment" /><Card><Empty icon={BookOpenCheck} title="Enrollment is closed" text="There is no academic term open for enrollment right now." /></Card></>);
  }

  const toggle = (o) => {
    const sameCourse = (data.offerings || []).filter((x) => x.course_id === o.course_id).map((x) => x.offering_id);
    setSelected((cur) => (cur.includes(o.offering_id) ? cur.filter((x) => x !== o.offering_id) : [...cur.filter((x) => !sameCourse.includes(x)), o.offering_id]));
  };

  const save = async (andSubmit) => {
    setFormError(null);
    if (!selected.length) { setFormError({ message: 'Select at least one subject.' }); return; }
    const res = await run(() => api.post('/student/enrollment', { offering_ids: selected }), {
      silent: andSubmit,
      onError: (e) => setFormError(e),
    });
    if (!res) return;
    if (andSubmit) await run(() => api.post(`/student/enrollment/${res.enrollment_id}/submit`), { onError: (e) => setFormError(e) });
    reload();
  };

  const cancel = () => run(() => api.post(`/student/enrollment/${enr.enrollment_id}/cancel`), { onSuccess: () => { setConfirmCancel(false); reload(); } });
  const t = data.term;

  return (
    <>
      <PageHeader
        title="Enrollment"
        subtitle={`${t.label} · Enrollment period ${fmtDate(t.enrollment_start)} – ${fmtDate(t.enrollment_end)}`}
        actions={enr?.enrollment_status === 'Finalized' && <Link className="btn btn-primary" to={`/print/cor/${enr.enrollment_id}`}><FileText /> View COR</Link>}
      />

      <div className="stack">
        <Card>
          <Steps steps={STEPS} current={stepIndex(enr, data.payment, data.fees)} />
          {enr && (
            <div className="row mt-4 text-sm">
              Application #{enr.enrollment_id} <StatusBadge status={enr.enrollment_status} />
              {enr.submitted_at && <span className="text-muted">· Submitted {fmtDateTime(enr.submitted_at)}</span>}
              {enr.cor_number && <span className="text-muted">· COR <span className="mono">{enr.cor_number}</span></span>}
            </div>
          )}
        </Card>

        {!t.enrollment_window_open && <Alert type="warning">The enrollment period is closed. Applications can no longer be submitted.</Alert>}
        {enr?.enrollment_status === 'For Correction' && <Alert type="info" title="The Registrar returned your application for correction">{enr.decision_reason}</Alert>}
        {enr?.enrollment_status === 'Rejected' && <Alert type="danger" title="Your previous application was rejected">{enr.decision_reason} You may submit a new application.</Alert>}
        {enr?.enrollment_status === 'Approved' && data.payment?.state !== 'Confirmed' && data.fees?.total > 0 && (
          <Alert type="success" title="Approved — payment required">
            Pay {peso(data.fees.total)} under <Link to="/student/payments">Payments</Link>. {data.payment?.state === 'Submitted' ? 'Your payment is awaiting Cashier verification.' : ''}
          </Alert>
        )}

        {editing ? (
          <Card
            title="Offered subjects"
            subtitle="Subjects with unmet prerequisites, already passed, or full sections cannot be selected."
            flush
            footer={
              <div className="row-between">
                <div className="text-sm">
                  Selected: <strong>{selected.length}</strong> subject(s) · <strong>{units}</strong> unit(s)
                  {units > data.max_units && <span className="text-danger"> — exceeds the {data.max_units}-unit limit</span>}
                </div>
                <div className="row">
                  {enr && EDITABLE.includes(enr.enrollment_status) && <Button onClick={() => setConfirmCancel(true)}><XCircle /> Cancel application</Button>}
                  <Button onClick={() => save(false)} loading={busy} disabled={!t.enrollment_window_open}><Save /> Save draft</Button>
                  <Button variant="primary" onClick={() => save(true)} loading={busy} disabled={!t.enrollment_window_open}><Send /> Submit to Registrar</Button>
                </div>
              </div>
            }
          >
            {formError && <div className="card-body"><ErrorAlert error={formError} /></div>}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th /><th>Code</th><th>Subject</th><th>Section</th><th className="num">Units</th><th>Prerequisites</th><th className="num">Seats</th><th /></tr>
                </thead>
                <tbody>
                  {data.offerings.map((o) => {
                    const blocked = !o.prerequisites_met || o.already_passed || o.is_full;
                    const checked = selected.includes(o.offering_id);
                    return (
                      <tr key={o.offering_id} className={`${blocked ? 'is-disabled' : ''} ${checked ? 'is-selected' : ''}`}>
                        <td><input type="checkbox" checked={checked} disabled={blocked && !checked} onChange={() => toggle(o)} aria-label={`Select ${o.course_code}`} /></td>
                        <td className="cell-main">{o.course_code}</td>
                        <td>{o.course_name}<div className="cell-sub">{o.department_code}</div></td>
                        <td>{o.section_code}</td>
                        <td className="num">{o.units}</td>
                        <td>{o.prerequisites.length ? o.prerequisites.map((p) => <span key={p.course_code} className={`chip ${p.met ? 'ok' : 'no'}`}>{p.course_code}</span>) : <span className="text-faint">None</span>}</td>
                        <td className="num">{o.seats_taken}/{o.capacity}</td>
                        <td>
                          {o.already_passed ? <span className="badge plain">Passed</span>
                            : !o.prerequisites_met ? <span className="badge badge-danger plain">Prereq not met</span>
                            : o.is_full ? <span className="badge badge-danger plain">Full</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-sidebar">
            <Card title="Enrolled subjects" flush>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Code</th><th>Subject</th><th>Section</th><th className="num">Units</th></tr></thead>
                  <tbody>
                    {data.subjects.map((s) => (
                      <tr key={s.enrollment_subject_id}><td className="cell-main">{s.course_code}</td><td>{s.course_name}</td><td>{s.section_code}</td><td className="num">{s.units}</td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan={3}>Total units</td><td className="num">{data.fees.units}</td></tr></tfoot>
                </table>
              </div>
              {enr.enrollment_status === 'Submitted' && (
                <div className="card-body"><Button onClick={() => setConfirmCancel(true)}><XCircle /> Cancel application</Button></div>
              )}
            </Card>
            <Card title="Assessment of fees" flush>
              <table className="table">
                <tbody>
                  {data.fees.lines.map((f) => (
                    <tr key={f.fee_name}><td>{f.fee_name}<div className="cell-sub">{f.fee_basis === 'Per Unit' ? `${peso(f.amount)} × ${f.quantity} units` : f.fee_basis}</div></td><td className="num">{peso(f.subtotal)}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td>Total</td><td className="num">{peso(data.fees.total)}</td></tr>
                  <tr><td>Payment</td><td className="num"><StatusBadge status={data.payment.state} /></td></tr>
                </tfoot>
              </table>
            </Card>
          </div>
        )}

        {data.history.length > 0 && (
          <Card title="Enrollment history" flush>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>#</th><th>Term</th><th>Status</th><th>COR No.</th><th>Finalized</th><th /></tr></thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.enrollment_id}>
                      <td>{h.enrollment_id}</td><td>{h.term_label}</td><td><StatusBadge status={h.enrollment_status} /></td>
                      <td className="mono">{h.cor_number || '—'}</td><td>{fmtDate(h.finalized_at)}</td>
                      <td className="actions">{h.enrollment_status === 'Finalized' && <Link className="btn btn-sm" to={`/print/cor/${h.enrollment_id}`}>COR</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={confirmCancel}
        title="Cancel enrollment application?"
        onClose={() => setConfirmCancel(false)}
        footer={<><Button onClick={() => setConfirmCancel(false)}>Keep application</Button><Button variant="danger" loading={busy} onClick={cancel}>Cancel application</Button></>}
      >
        <p>Your application will be marked as Cancelled. It remains in your history and you may submit a new one while enrollment is open.</p>
      </Modal>
    </>
  );
}
