import { GraduationCap, Printer } from 'lucide-react';
import { Button, Card, Empty, ErrorAlert, Loading, PageHeader, StatusBadge } from '../../components/ui';
import { fmtDate, gradeText, gwaText, useApi } from '../../utils';

export default function Grades() {
  const { data, error, loading } = useApi('/student/grades');
  if (loading) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <>
      <PageHeader
        title="Grades"
        subtitle={`Only grades published by the Registrar are shown. Cumulative GWA: ${gwaText(data.gwa)}`}
        actions={<Button className="no-print" onClick={() => window.print()}><Printer /> Print</Button>}
      />
      {!data.terms.length ? (
        <Card><Empty icon={GraduationCap} title="No published grades yet" /></Card>
      ) : (
        <div className="stack">
          {data.terms.map((t) => (
            <Card key={t.term_id} title={t.label} subtitle={`${t.units} units · Term GWA ${gwaText(t.gwa)}`} flush>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Code</th><th>Subject</th><th>Section</th><th className="num">Units</th><th className="center">Grade</th><th>Remarks</th><th>Published</th></tr>
                  </thead>
                  <tbody>
                    {t.grades.map((g) => (
                      <tr key={g.course_code}>
                        <td className="cell-main">{g.course_code}</td>
                        <td>{g.course_name}</td>
                        <td>{g.section_code}</td>
                        <td className="num">{g.units}</td>
                        <td className="center fw-600">{gradeText(g.grade_value, g.special_mark)}</td>
                        <td><StatusBadge status={g.remarks} /></td>
                        <td className="text-xs text-muted">{fmtDate(g.published_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
