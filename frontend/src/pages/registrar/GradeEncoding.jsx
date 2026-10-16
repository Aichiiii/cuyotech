import { useEffect, useState } from 'react';
import { ArrowLeft, PenLine, Save, Send } from 'lucide-react';
import { api } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Loading, Modal, PageHeader, StatusBadge, useAction } from '../../components/ui';
import { gradeText, useApi } from '../../utils';

export default function GradeEncoding() {
  const terms = useApi('/terms');
  const [termId, setTermId] = useState('');
  const [offering, setOffering] = useState(null);

  useEffect(() => {
    if (terms.data && !termId) setTermId(String(terms.data.open_term?.term_id || terms.data.terms[0]?.term_id || ''));
  }, [terms.data, termId]);

  const offerings = useApi(termId ? `/registrar/offerings?term_id=${termId}` : null);

  if (offering) return <GradeSheet offeringId={offering} onBack={() => { setOffering(null); offerings.reload(); }} />;

  return (
    <>
      <PageHeader
        title="Grade Encoding"
        subtitle="Encode grades for officially enrolled students, then publish them so students can see them."
        actions={terms.data && (
          <select className="select" value={termId} onChange={(e) => setTermId(e.target.value)}>
            {terms.data.terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.label}</option>)}
          </select>
        )}
      />
      <Card flush>
        {offerings.error && <div className="card-body"><ErrorAlert error={offerings.error} /></div>}
        {offerings.loading && !offerings.data ? <Loading /> : !offerings.data?.offerings.length ? <Empty icon={PenLine} title="No classes for this term" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Subject</th><th>Section</th><th>Dept.</th><th className="num">Students</th><th className="num">Encoded</th><th className="num">Published</th><th /></tr></thead>
              <tbody>
                {offerings.data.offerings.map((o) => (
                  <tr key={o.offering_id}>
                    <td><div className="cell-main">{o.course_code}</div><div className="cell-sub">{o.course_name} · {o.units} units</div></td>
                    <td>{o.section_code}</td>
                    <td>{o.department_code}</td>
                    <td className="num">{o.students}</td>
                    <td className="num">{o.encoded > 0 ? <span className="badge badge-warning plain">{o.encoded}</span> : 0}</td>
                    <td className="num">{o.published}{o.students > 0 && o.published === o.students && ' ✓'}</td>
                    <td className="actions"><Button size="sm" variant="primary" disabled={!o.students} onClick={() => setOffering(o.offering_id)}><PenLine /> Open grade sheet</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function GradeSheet({ offeringId, onBack }) {
  const { data, error, loading, reload } = useApi(`/registrar/offerings/${offeringId}/grades`);
  const [values, setValues] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [run, busy] = useAction();

  useEffect(() => {
    if (data) setValues(Object.fromEntries(data.students.map((s) => [s.enrollment_subject_id, s.special_mark || (s.grade_value ?? '')])));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const o = data.offering;
  const dirty = data.students.some((s) => s.grade_status !== 'Published' && String(values[s.enrollment_subject_id] ?? '') !== String(s.special_mark || (s.grade_value ?? '')));
  const encodedCount = data.students.filter((s) => s.grade_status === 'Encoded').length;

  const save = () => {
    setSaveError(null);
    return run(() => api.post(`/registrar/offerings/${offeringId}/grades`, {
      grades: data.students.filter((s) => s.grade_status !== 'Published').map((s) => ({ enrollment_subject_id: s.enrollment_subject_id, value: values[s.enrollment_subject_id] })),
    }), { onSuccess: reload, onError: setSaveError });
  };
  const publish = () => run(() => api.post(`/registrar/offerings/${offeringId}/publish`), { onSuccess: () => { setConfirm(false); reload(); } });

  return (
    <>
      <PageHeader
        title={`${o.course_code} — ${o.course_name}`}
        subtitle={`Section ${o.section_code} · ${o.units} units · ${o.term_label}`}
        actions={<>
          <Button onClick={onBack}><ArrowLeft /> Back to classes</Button>
          <Button onClick={save} loading={busy} disabled={!dirty}><Save /> Save grades</Button>
          <Button variant="primary" onClick={() => setConfirm(true)} disabled={dirty || !encodedCount}><Send /> Publish ({encodedCount})</Button>
        </>}
      />
      <div className="stack">
        {saveError && <ErrorAlert error={saveError} />}
        {dirty && <Alert type="warning">You have unsaved changes. Save before publishing.</Alert>}
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Student</th><th>Program</th><th>Grade</th><th>Status</th></tr></thead>
              <tbody>
                {data.students.map((s, i) => {
                  const locked = s.grade_status === 'Published';
                  return (
                    <tr key={s.enrollment_subject_id}>
                      <td>{i + 1}</td>
                      <td><div className="cell-main">{s.last_name}, {s.first_name} {s.middle_name ? `${s.middle_name[0]}.` : ''}</div><div className="cell-sub">{s.student_number}</div></td>
                      <td>{s.program_code} {s.year_level}</td>
                      <td>
                        {locked ? <span className="fw-600">{gradeText(s.grade_value, s.special_mark)}</span> : (
                          <select className="select select-sm" value={values[s.enrollment_subject_id] ?? ''} onChange={(e) => setValues({ ...values, [s.enrollment_subject_id]: e.target.value })} aria-label={`Grade for ${s.student_number}`}>
                            <option value="">— Not encoded —</option>
                            {data.valid_grades.map((g) => <option key={g} value={g}>{g}{g === '5.00' ? ' (Failed)' : ''}</option>)}
                            <option value="INC">INC (Incomplete)</option>
                            <option value="DRP">DRP (Dropped)</option>
                          </select>
                        )}
                      </td>
                      <td><StatusBadge status={s.grade_status || 'Draft'} label={s.grade_status || 'Not encoded'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="text-xs text-muted">Grading scale: 1.00 (highest) to 3.00 (passing); 5.00 failed. Published grades are locked; corrections require a formal grade change.</p>
      </div>

      <Modal
        open={confirm}
        title="Publish grades?"
        onClose={() => setConfirm(false)}
        footer={<><Button onClick={() => setConfirm(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={publish}>Publish {encodedCount} grade(s)</Button></>}
      >
        <p>Published grades become visible to students immediately and can no longer be edited. Students will be notified.</p>
      </Modal>
    </>
  );
}
