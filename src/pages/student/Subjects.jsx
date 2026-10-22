import { Link } from 'react-router-dom';
import { BookOpen, FileText } from 'lucide-react';
import { Card, Empty, ErrorAlert, Loading, PageHeader, StatusBadge } from '../../components/ui';
import { gradeText, useApi } from '../../utils';

export default function Subjects() {
  const { data, error, loading } = useApi('/student/subjects');
  if (loading) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const enr = data.enrollment;
  const units = data.subjects.reduce((a, s) => a + Number(s.units), 0);

  return (
    <>
      <PageHeader
        title="My Subjects"
        subtitle={enr ? `${enr.term_label} · Enrollment status:` : 'Your enrolled subjects for the latest term.'}
        actions={enr?.enrollment_status === 'Finalized' && <Link className="btn btn-primary" to={`/print/cor/${enr.enrollment_id}`}><FileText /> View COR</Link>}
      />
      {enr && <div className="mb-4"><StatusBadge status={enr.enrollment_status} /> {enr.cor_number && <span className="text-sm text-muted">COR <span className="mono">{enr.cor_number}</span></span>}</div>}
      <Card flush>
        {!data.subjects.length ? (
          <Empty icon={BookOpen} title="No subjects yet" text="Your subjects appear here after you submit your enrollment.">
            <Link className="btn btn-primary" to="/student/enrollment">Go to Enrollment</Link>
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Subject</th><th>Section</th><th className="num">Units</th><th>Prerequisites</th><th className="center">Grade</th></tr></thead>
              <tbody>
                {data.subjects.map((s) => (
                  <tr key={s.enrollment_subject_id}>
                    <td className="cell-main">{s.course_code}</td>
                    <td>{s.course_name}</td>
                    <td>{s.section_code}</td>
                    <td className="num">{s.units}</td>
                    <td>{s.prerequisites.length ? s.prerequisites.map((p) => <span key={p.course_code} className="chip">{p.course_code}</span>) : <span className="text-faint">None</span>}</td>
                    <td className="center">{gradeText(s.grade_value, s.special_mark)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total units</td><td className="num">{units}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
