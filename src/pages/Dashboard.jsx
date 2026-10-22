import { Link } from 'react-router-dom';
import {
  Activity, Banknote, BookOpenCheck, ClipboardCheck, ClipboardList, FileCheck2, FileText, GraduationCap,
  Library, Lock, PenLine, Receipt, ShieldCheck, UserCheck, Users, Wallet,
} from 'lucide-react';
import { useAuth } from '../auth';
import { Card, Empty, ErrorAlert, Loading, PageHeader, Stat, StatusBadge } from '../components/ui';
import { fmtDate, fmtDateTime, gradeText, gwaText, initials, peso, useApi, yearLevel } from '../utils';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useApi('/dashboard');
  if (loading) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const views = { STUDENT: StudentDash, REGISTRAR: RegistrarDash, CASHIER: CashierDash, DEPARTMENT: DepartmentDash, ADMIN: AdminDash };
  const View = views[user.role_code] || (() => <Empty title="Welcome" />);
  return <View data={data} user={user} />;
}

const ENROLL_CARD = {
  Finalized: { value: 'Enrolled', tone: 'green' },
  Approved: { value: 'Approved', tone: 'gold' },
  Submitted: { value: 'Under review', tone: 'gold' },
  'For Correction': { value: 'Needs correction', tone: 'red' },
  Draft: { value: 'Draft', tone: 'gold' },
};
const docShort = (d) => (['TOR', 'COR'].includes(d.document_code) ? d.document_code : d.document_name);
const DOC_LABEL = { Submitted: 'Pending review', 'For Correction': 'Needs correction' };

function StudentDash({ data, user }) {
  const s = user.student;
  const enr = data.enrollment;
  const ec = (enr && ENROLL_CARD[enr.enrollment_status]) || { value: 'Not Enrolled', tone: 'red' };
  const enrHint = !enr || !ENROLL_CARD[enr.enrollment_status]
    ? 'Not enrolled in the current semester.'
    : {
        Finalized: `Officially enrolled · ${enr.cor_number}`,
        Approved: 'Approved. Pay your fees to be finalized.',
        Submitted: 'Application submitted. Awaiting Registrar.',
        'For Correction': 'Returned by the Registrar for correction.',
        Draft: 'Draft saved. Submit it to the Registrar.',
      }[enr.enrollment_status];

  const c = data.clearance;
  const cTotal = c?.decisions?.length || 0;
  const clearanceCard = !c
    ? { value: 'Not requested', hint: 'Request clearance when you need it.', tone: 'green' }
    : c.clearance_status === 'Completed'
      ? { value: 'Cleared', hint: `All ${cTotal} offices approved.`, tone: 'green' }
      : { value: `${c.approved_count} of ${cTotal} offices`, hint: c.pending_count ? `${c.pending_count} office${c.pending_count > 1 ? 's' : ''} pending requirements.` : 'Waiting for office review.', tone: 'green' };

  const latestDoc = data.recent_documents[0];
  const balance = Number(data.balance_due);

  return (
    <div className="stack">
      <div className="hero">
        <div className="avatar avatar-lg">{initials(user.display_name)}</div>
        <div className="hero-text">
          <h2>Welcome back, {s.first_name} {s.last_name}</h2>
          <p>Student ID: {s.student_number} &nbsp;•&nbsp; Program: {s.program_name} &nbsp;•&nbsp; {yearLevel(s.year_level)}</p>
        </div>
        <Link className="btn btn-primary" to="/student/documents"><FileText /> Request a Document</Link>
      </div>

      <div className="grid grid-4">
        <Stat tone={ec.tone} icon={BookOpenCheck} label="Enrollment" value={ec.value} hint={enrHint} to="/student/enrollment" />
        <Stat tone={clearanceCard.tone} icon={ClipboardCheck} label="Clearance" value={clearanceCard.value} hint={clearanceCard.hint} to="/student/clearance" />
        <Stat tone="blue" icon={FileText} label="Document requests" value={`${data.pending_documents} active`}
          hint={latestDoc ? `${docShort(latestDoc)} • ${DOC_LABEL[latestDoc.request_status] || latestDoc.request_status}` : 'No requests yet.'} to="/student/documents" />
        <Stat tone="gold" icon={Wallet} label="Balance due" value={peso(balance)}
          hint={balance > 0 ? 'Pay under Payments & Receipts.' : data.receipts_count ? 'No fees due. Receipts are available.' : 'No fees due.'} to="/student/payments" />
      </div>

      <div className="grid grid-sidebar">
        <div className="stack">
          <Card title="My Subjects" subtitle={enr ? `${data.open_term?.label} · ${enr.units} units` : data.open_term?.label}>
            {!data.subjects.length ? (
              <Empty icon={BookOpenCheck} title="No subjects yet" text="Your subjects appear here after you enroll.">
                <Link className="btn btn-primary" to="/student/enrollment">Go to Enrollment</Link>
              </Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Code</th><th>Subject</th><th className="num">Units</th><th>Section</th></tr></thead>
                  <tbody>
                    {data.subjects.map((x) => (
                      <tr key={x.enrollment_subject_id}><td>{x.course_code}</td><td>{x.course_name}</td><td className="num">{x.units}</td><td>{x.section_code}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Published Grades" subtitle={data.recent_grades_term} actions={<Link className="btn btn-sm" to="/student/grades">All grades</Link>}>
            {!data.recent_grades.length ? <Empty icon={GraduationCap} title="No published grades yet" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Subject</th><th className="center">Grade</th><th>Remarks</th></tr></thead>
                  <tbody>
                    {data.recent_grades.map((g) => (
                      <tr key={g.course_code}><td>{g.course_code} – {g.course_name}</td><td className="center fw-600">{gradeText(g.grade_value, g.special_mark)}</td><td>{g.remarks}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted mt-3">Only grades published by the Registrar are shown. GWA: <strong>{gwaText(data.gwa)}</strong></p>
          </Card>
        </div>

        <div className="stack">
          <Card title="Clearance Status">
            {!c ? (
              <Empty icon={ClipboardCheck} title="No clearance request"><Link className="btn" to="/student/clearance">Request clearance</Link></Empty>
            ) : (
              <>
                {c.decisions.map((d) => (
                  <div className="office-row" key={d.decision_id}>
                    <div>
                      <div className="office-name">{d.office_type === 'Department' ? 'Department' : d.office_type}</div>
                      <div className="office-sub">{d.office_name}</div>
                    </div>
                    <StatusBadge status={d.decision_status === 'Pending Requirements' ? 'Pending' : d.decision_status} />
                  </div>
                ))}
                <p className="text-xs text-muted mt-3">Clearance is complete only when every required office approves.</p>
                {c.pending_count > 0 && <Link className="btn btn-block mt-3" to="/student/clearance">Resolve pending requirements</Link>}
              </>
            )}
          </Card>

          <Card title="Recent Document Requests">
            {!data.recent_documents.length ? <Empty icon={FileText} title="No requests yet" /> : data.recent_documents.map((r) => (
              <div className="office-row" key={r.request_id}>
                <div>
                  <div className="office-name">{docShort(r)}</div>
                  <div className="office-sub">Requested {fmtDate(r.submitted_at)}</div>
                </div>
                <StatusBadge status={r.request_status} label={DOC_LABEL[r.request_status]} />
              </div>
            ))}
            <Link className="btn btn-block mt-3" to="/student/documents">View all requests</Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RegistrarDash({ data, user }) {
  const s = data.stats;
  return (
    <div className="stack">
      <PageHeader title={`Good day, ${user.display_name}`} subtitle={`Office of the University Registrar · ${data.open_term?.label || 'No open term'}`} />
      <div className="grid grid-3">
        <Stat icon={ClipboardList} tone="gold" label="Enrollments for review" value={s.enrollments_for_review} to="/registrar/enrollments" />
        <Stat icon={UserCheck} tone="blue" label="Approved, awaiting finalization" value={s.enrollments_to_finalize} to="/registrar/enrollments" />
        <Stat icon={PenLine} label="Encoded grades not yet published" value={s.grades_unpublished} to="/registrar/grades" />
        <Stat icon={FileCheck2} tone="gold" label="Document requests for review" value={s.documents_for_review} to="/registrar/documents" />
        <Stat icon={FileText} tone="green" label="Documents ready for release" value={s.documents_to_release} to="/registrar/documents" />
        <Stat icon={ShieldCheck} tone="gold" label="Clearance items for review" value={s.clearance_for_review} to="/clearance" />
      </div>
    </div>
  );
}

function CashierDash({ data, user }) {
  const s = data.stats;
  return (
    <div className="stack">
      <PageHeader title={`Good day, ${user.display_name}`} subtitle="Cashier's Office" />
      <div className="grid grid-3">
        <Stat icon={Banknote} tone="gold" label="Payments to verify" value={s.payments_to_verify} to="/cashier/payments" />
        <Stat icon={Receipt} tone="blue" label="Receipts to issue" value={s.receipts_to_issue} to="/cashier/payments" />
        <Stat icon={ShieldCheck} tone="gold" label="Financial clearance for review" value={s.clearance_for_review} to="/clearance" />
        <Stat icon={Wallet} tone="green" label="Collected today" value={peso(s.collected_today)} />
        <Stat icon={Wallet} label="Total confirmed collections" value={peso(s.collected_total)} />
      </div>
    </div>
  );
}

function DepartmentDash({ data, user }) {
  const s = data.stats;
  return (
    <div className="stack">
      <PageHeader title={`Good day, ${user.display_name}`} subtitle={user.staff.office_name} />
      <div className="grid grid-3">
        <Stat icon={ShieldCheck} tone="gold" label="Clearance for review" value={s.clearance_for_review} to="/clearance" />
        <Stat icon={ClipboardCheck} tone="red" label="Pending student requirements" value={s.clearance_pending} to="/clearance" />
        <Stat icon={UserCheck} tone="green" label="Clearances approved" value={s.clearance_approved} />
        <Stat icon={Library} label="Active courses" value={s.active_courses} to="/department/courses" />
        <Stat icon={Users} tone="blue" label="Active students in department" value={s.students} />
      </div>
    </div>
  );
}

function AdminDash({ data, user }) {
  const s = data.stats;
  return (
    <div className="stack">
      <PageHeader title={`Good day, ${user.display_name}`} subtitle="System Administration" />
      <div className="grid grid-3">
        <Stat icon={Users} label="User accounts" value={s.users} hint={`${s.active_users} active`} to="/admin/users" />
        <Stat icon={Lock} tone="red" label="Locked accounts" value={s.locked_users} to="/admin/users" />
        <Stat icon={Activity} tone="blue" label="Audit events today" value={s.audit_today} to="/admin/audit" />
      </div>
      <div className="grid grid-sidebar">
        <Card title="Recent activity" flush actions={<Link className="btn btn-sm" to="/admin/audit">View all</Link>}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Action</th><th>Record</th><th>User</th><th>When</th></tr></thead>
              <tbody>
                {data.recent_activity.map((a, i) => (
                  <tr key={i}>
                    <td className="mono">{a.action}</td><td>{a.table_name}{a.record_id ? ` #${a.record_id}` : ''}</td>
                    <td>{a.username || '—'}</td><td className="nowrap">{fmtDateTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Accounts by role" flush>
          <table className="table">
            <tbody>
              {data.users_by_role.map((r) => (
                <tr key={r.role_name}><td>{r.role_name}</td><td className="num fw-600">{r.total}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
