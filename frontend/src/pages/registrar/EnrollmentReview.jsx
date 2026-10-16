import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, ClipboardList, Eye, FileText, RotateCcw, Search, XCircle } from 'lucide-react';
import { api } from '../../api';
import { Alert, Button, Card, CheckList, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, Tabs, useAction } from '../../components/ui';
import { fmtDateTime, peso, useApi, yearLevel } from '../../utils';

const TABS = ['Submitted', 'Approved', 'For Correction', 'Finalized', 'Rejected', 'Cancelled', 'All'];

export default function EnrollmentReview() {
  const [tab, setTab] = useState('Submitted');
  const [search, setSearch] = useState('');
  const query = `/registrar/enrollments?${new URLSearchParams({ status: tab === 'All' ? '' : tab, search })}`;
  const { data, error, loading, reload } = useApi(query);
  const [openId, setOpenId] = useState(null);

  return (
    <>
      <PageHeader title="Enrollment Review" subtitle="Check prerequisites, capacity and eligibility, then approve, return or reject. Finalize after payment to generate the COR." />
      <Card flush>
        <div className="card-header">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          <div className="input-icon"><Search /><input className="input input-sm" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        {error && <div className="card-body"><ErrorAlert error={error} /></div>}
        {loading && !data ? <Loading /> : !data?.enrollments.length ? <Empty icon={ClipboardList} title="No applications" text={`No enrollment applications under "${tab}".`} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Student</th><th>Term</th><th className="num">Units</th><th>Submitted</th><th>Status</th><th>Payment</th><th /></tr></thead>
              <tbody>
                {data.enrollments.map((e) => (
                  <tr key={e.enrollment_id}>
                    <td>{e.enrollment_id}</td>
                    <td><div className="cell-main">{e.last_name}, {e.first_name}</div><div className="cell-sub">{e.student_number} · {e.program_code} {yearLevel(e.year_level)}</div></td>
                    <td className="text-sm">{e.term_label}</td>
                    <td className="num">{e.units}</td>
                    <td className="text-sm nowrap">{fmtDateTime(e.submitted_at)}</td>
                    <td><StatusBadge status={e.enrollment_status} /></td>
                    <td><StatusBadge status={e.payment_state} /></td>
                    <td className="actions"><Button size="sm" onClick={() => setOpenId(e.enrollment_id)}><Eye /> {['Submitted', 'Approved'].includes(e.enrollment_status) ? 'Review' : 'View'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {openId && <ReviewModal id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </>
  );
}

function ReviewModal({ id, onClose, onChanged }) {
  const { data, error, loading, reload } = useApi(`/registrar/enrollments/${id}`);
  const [reasonFor, setReasonFor] = useState(null); // 'correct' | 'reject'
  const [reason, setReason] = useState('');
  const [run, busy] = useAction();

  const done = async () => { setReasonFor(null); setReason(''); await reload(); onChanged(); };
  const decide = (action) => run(() => api.post(`/registrar/enrollments/${id}/decision`, { action, reason }), { onSuccess: done });
  const finalize = () => run(() => api.post(`/registrar/enrollments/${id}/finalize`), { onSuccess: done });

  const e = data?.enrollment;
  const paidOk = data && (data.fees.total === 0 || data.payment.state === 'Confirmed');

  const footer = e && (
    <>
      <Button onClick={onClose}>Close</Button>
      {e.enrollment_status === 'Submitted' && !reasonFor && (
        <>
          <Button variant="danger" onClick={() => setReasonFor('reject')}><XCircle /> Reject</Button>
          <Button variant="warning" onClick={() => setReasonFor('correct')}><RotateCcw /> Return for correction</Button>
          <Button variant="success" loading={busy} disabled={!data.eligible} onClick={() => decide('approve')}><BadgeCheck /> Approve</Button>
        </>
      )}
      {reasonFor && (
        <>
          <Button onClick={() => setReasonFor(null)}>Back</Button>
          <Button variant={reasonFor === 'reject' ? 'danger' : 'primary'} loading={busy} onClick={() => decide(reasonFor)}>
            Confirm {reasonFor === 'reject' ? 'rejection' : 'return for correction'}
          </Button>
        </>
      )}
      {e.enrollment_status === 'Approved' && <Button variant="primary" loading={busy} disabled={!paidOk} onClick={finalize}><BadgeCheck /> Finalize & generate COR</Button>}
      {e.enrollment_status === 'Finalized' && <Link className="btn btn-primary" to={`/print/cor/${id}`}><FileText /> View COR</Link>}
    </>
  );

  return (
    <Modal open title={`Enrollment application #${id}`} onClose={onClose} size="xl" footer={footer}>
      {loading && !data ? <Loading /> : error ? <ErrorAlert error={error} /> : (
        <div className="stack">
          <div className="grid grid-3">
            <dl className="info-list">
              <dt>Student</dt><dd>{data.student.first_name} {data.student.last_name}</dd>
              <dt>Student no.</dt><dd>{data.student.student_number}</dd>
              <dt>Program</dt><dd>{data.student.program_code} · {yearLevel(data.student.year_level)}</dd>
            </dl>
            <dl className="info-list">
              <dt>Term</dt><dd>{e.term_label}</dd>
              <dt>Status</dt><dd><StatusBadge status={e.enrollment_status} /></dd>
              <dt>Reviewed by</dt><dd>{e.reviewed_by_name ? `${e.reviewed_by_name}, ${fmtDateTime(e.reviewed_at)}` : '—'}</dd>
            </dl>
            <div>
              <div className="label mb-2">Eligibility checks</div>
              <CheckList items={data.checks} />
            </div>
          </div>

          {e.decision_reason && <Alert type="info" title="Decision reason">{e.decision_reason}</Alert>}
          {e.enrollment_status === 'Approved' && !paidOk && <Alert type="warning">Finalization is locked until the Cashier confirms the {peso(data.fees.total)} payment (current: {data.payment.state}).</Alert>}

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Subject</th><th>Section</th><th className="num">Units</th><th>Prerequisites</th><th className="num">Seats taken</th></tr></thead>
              <tbody>
                {data.subjects.map((s) => (
                  <tr key={s.enrollment_subject_id}>
                    <td className="cell-main">{s.course_code}</td><td>{s.course_name}</td><td>{s.section_code}</td><td className="num">{s.units}</td>
                    <td>{s.prerequisites.length ? s.prerequisites.map((p) => <span key={p.course_code} className={`chip ${p.met ? 'ok' : 'no'}`}>{p.course_code} {p.met ? '✓' : '✗'}</span>) : <span className="text-faint">None</span>}</td>
                    <td className={`num ${s.has_seat ? '' : 'text-danger'}`}>{s.seats_taken}/{s.capacity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total units · Assessment</td><td className="num">{data.fees.units}</td><td colSpan={2} className="text-right">{peso(data.fees.total)} · Payment: {data.payment.state}</td></tr></tfoot>
            </table>
          </div>

          {reasonFor && (
            <Field label={reasonFor === 'reject' ? 'Reason for rejection' : 'What should the student correct?'} required>
              <textarea className="textarea" autoFocus value={reason} onChange={(ev) => setReason(ev.target.value)} />
            </Field>
          )}

          {data.history.length > 0 && (
            <div>
              <div className="label mb-2">History</div>
              <ul className="list text-sm">
                {data.history.map((h, i) => <li key={i} className="row"><span className="mono text-xs">{h.action}</span><span className="text-muted">by {h.actor || 'system'} · {fmtDateTime(h.created_at)}</span></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
