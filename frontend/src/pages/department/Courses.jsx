import { useEffect, useState } from 'react';
import { Library, Pencil, Plus } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, useAction } from '../../components/ui';
import { useApi } from '../../utils';

const EMPTY_COURSE = { course_code: '', course_name: '', units: 3, course_status: 'Active', prerequisite_ids: [] };

export default function Courses() {
  const { data, error, loading, reload } = useApi('/department/courses');
  const terms = useApi('/terms');
  const [termId, setTermId] = useState('');
  const offerings = useApi(termId ? `/department/offerings?term_id=${termId}` : null);
  const [course, setCourse] = useState(null); // form state for create/edit
  const [offering, setOffering] = useState(null);
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  useEffect(() => {
    if (terms.data && !termId) setTermId(String(terms.data.open_term?.term_id || terms.data.terms[0]?.term_id || ''));
  }, [terms.data, termId]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const saveCourse = () => {
    setErrors({});
    const body = { ...course, units: Number(course.units) };
    run(() => (course.course_id ? api.put(`/department/courses/${course.course_id}`, body) : api.post('/department/courses', body)), {
      onSuccess: () => { setCourse(null); reload(); },
      onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }),
    });
  };
  const saveOffering = () => {
    setErrors({});
    const body = { ...offering, capacity: Number(offering.capacity), course_id: Number(offering.course_id), term_id: Number(termId) };
    run(() => (offering.offering_id ? api.put(`/department/offerings/${offering.offering_id}`, body) : api.post('/department/offerings', body)), {
      onSuccess: () => { setOffering(null); offerings.reload(); },
      onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }),
    });
  };
  const togglePrereq = (id) =>
    setCourse((c) => ({ ...c, prerequisite_ids: c.prerequisite_ids.includes(id) ? c.prerequisite_ids.filter((x) => x !== id) : [...c.prerequisite_ids, id] }));

  const term = terms.data?.terms.find((t) => String(t.term_id) === termId);

  return (
    <>
      <PageHeader title="Courses & Offerings" subtitle={data.department.department_name} />
      <div className="stack">
        <Card
          title="Courses"
          subtitle="Subjects maintained by your department, with prerequisites."
          actions={<Button variant="primary" onClick={() => { setErrors({}); setCourse(EMPTY_COURSE); }}><Plus /> Add course</Button>}
          flush
        >
          {!data.courses.length ? <Empty icon={Library} title="No courses yet" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Code</th><th>Title</th><th className="num">Units</th><th>Prerequisites</th><th className="num">Offerings</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.courses.map((c) => (
                    <tr key={c.course_id}>
                      <td className="cell-main">{c.course_code}</td><td>{c.course_name}</td><td className="num">{c.units}</td>
                      <td>{c.prerequisites.length ? c.prerequisites.map((p) => <span key={p.course_id} className="chip">{p.course_code}</span>) : <span className="text-faint">None</span>}</td>
                      <td className="num">{c.offerings}</td>
                      <td><StatusBadge status={c.course_status} /></td>
                      <td className="actions">
                        <Button size="sm" onClick={() => { setErrors({}); setCourse({ ...c, prerequisite_ids: c.prerequisites.map((p) => p.course_id) }); }}><Pencil /> Edit</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Term offerings"
          subtitle="Sections students can enroll in."
          actions={<>
            {terms.data && (
              <select className="select select-sm" value={termId} onChange={(e) => setTermId(e.target.value)}>
                {terms.data.terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.label} ({t.term_status})</option>)}
              </select>
            )}
            <Button variant="primary" disabled={term?.term_status === 'Closed'} onClick={() => { setErrors({}); setOffering({ course_id: '', section_code: '', capacity: 40, offering_status: 'Open' }); }}><Plus /> Add offering</Button>
          </>}
          flush
        >
          {offerings.loading && !offerings.data ? <Loading /> : !offerings.data?.offerings.length ? <Empty title="No offerings for this term" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Subject</th><th>Section</th><th className="num">Seats taken</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {offerings.data.offerings.map((o) => (
                    <tr key={o.offering_id}>
                      <td><div className="cell-main">{o.course_code}</div><div className="cell-sub">{o.course_name}</div></td>
                      <td>{o.section_code}</td>
                      <td className="num">{o.seats_taken}/{o.capacity}</td>
                      <td><StatusBadge status={o.offering_status} /></td>
                      <td className="actions">{term?.term_status !== 'Closed' && <Button size="sm" onClick={() => { setErrors({}); setOffering({ ...o }); }}><Pencil /> Edit</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!course}
        title={course?.course_id ? `Edit ${course.course_code}` : 'Add course'}
        size="lg"
        onClose={() => setCourse(null)}
        footer={<><Button onClick={() => setCourse(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={saveCourse}>Save</Button></>}
      >
        {course && (
          <div className="form">
            {errors._ && <Alert type="danger">{errors._}</Alert>}
            <div className="form-grid">
              <Field label="Course code" required error={errors.course_code} hint={course.course_id ? 'The code cannot be changed.' : 'e.g. IT401'}>
                <input className="input" value={course.course_code} disabled={!!course.course_id} onChange={(e) => setCourse({ ...course, course_code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Units" required error={errors.units}>
                <input className="input" type="number" min={1} max={6} value={course.units} onChange={(e) => setCourse({ ...course, units: e.target.value })} />
              </Field>
              <Field label="Course title" required error={errors.course_name} className="span-2">
                <input className="input" value={course.course_name} onChange={(e) => setCourse({ ...course, course_name: e.target.value })} />
              </Field>
              {course.course_id && (
                <Field label="Status">
                  <select className="select" value={course.course_status} onChange={(e) => setCourse({ ...course, course_status: e.target.value })}>
                    <option>Active</option><option>Archived</option>
                  </select>
                </Field>
              )}
            </div>
            <div>
              <div className="label mb-2">Prerequisites</div>
              <div className="grid grid-3">
                {data.all_courses.filter((c) => c.course_id !== course.course_id).map((c) => (
                  <label key={c.course_id} className="checkbox">
                    <input type="checkbox" checked={course.prerequisite_ids.includes(c.course_id)} onChange={() => togglePrereq(c.course_id)} />
                    {c.course_code} <span className="text-faint">{c.course_name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!offering}
        title={offering?.offering_id ? `Edit ${offering.course_code} ${offering.section_code}` : `Add offering — ${term?.label || ''}`}
        onClose={() => setOffering(null)}
        footer={<><Button onClick={() => setOffering(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={saveOffering}>Save</Button></>}
      >
        {offering && (
          <div className="form">
            {errors._ && <Alert type="danger">{errors._}</Alert>}
            {!offering.offering_id && (
              <>
                <Field label="Course" required error={errors.course_id}>
                  <select className="select" value={offering.course_id} onChange={(e) => setOffering({ ...offering, course_id: e.target.value })}>
                    <option value="">Select…</option>
                    {data.courses.filter((c) => c.course_status === 'Active').map((c) => <option key={c.course_id} value={c.course_id}>{c.course_code} — {c.course_name}</option>)}
                  </select>
                </Field>
                <Field label="Section code" required error={errors.section_code} hint="e.g. 3IT-B">
                  <input className="input" value={offering.section_code} onChange={(e) => setOffering({ ...offering, section_code: e.target.value.toUpperCase() })} />
                </Field>
              </>
            )}
            <div className="form-grid">
              <Field label="Capacity" required error={errors.capacity}>
                <input className="input" type="number" min={1} value={offering.capacity} onChange={(e) => setOffering({ ...offering, capacity: e.target.value })} />
              </Field>
              {offering.offering_id && (
                <Field label="Status" required>
                  <select className="select" value={offering.offering_status} onChange={(e) => setOffering({ ...offering, offering_status: e.target.value })}>
                    <option>Open</option><option>Closed</option><option>Cancelled</option>
                  </select>
                </Field>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
