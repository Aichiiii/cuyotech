import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { Alert, Button, Card, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, Tabs, useAction } from '../../components/ui';
import { fmtDate, peso, useApi } from '../../utils';

const TABS = [
  { value: 'fees', label: 'Fees' },
  { value: 'documents', label: 'Document types' },
  { value: 'terms', label: 'Academic terms' },
  { value: 'offices', label: 'Clearance offices' },
];
const NEW_TERM = { school_year: '', semester: 'First', start_date: '', end_date: '', enrollment_start: '', enrollment_end: '', term_status: 'Upcoming' };

export default function Policies() {
  const [tab, setTab] = useState('fees');
  const { data, error, loading, reload } = useApi('/admin/policies');
  const [edit, setEdit] = useState(null); // { kind, row }
  const [errors, setErrors] = useState({});
  const [run, busy] = useAction();

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const open = (kind, row) => { setErrors({}); setEdit({ kind, row: { ...row } }); };
  const setRow = (k, v) => setEdit((e) => ({ ...e, row: { ...e.row, [k]: v } }));
  const save = () => {
    const { kind, row } = edit;
    const call = {
      fee: () => api.put(`/admin/fees/${row.fee_id}`, { amount: Number(row.amount), fee_status: row.fee_status }),
      doc: () => api.put(`/admin/document-types/${row.document_type_id}`, { requires_clearance: !!Number(row.requires_clearance), fee_id: row.fee_id ? Number(row.fee_id) : null, processing_days: Number(row.processing_days), document_status: row.document_status }),
      term: () => (row.term_id ? api.put(`/admin/terms/${row.term_id}`, row) : api.post('/admin/terms', row)),
      office: () => api.put(`/admin/offices/${row.office_id}`, { requires_clearance: !!Number(row.requires_clearance), office_status: row.office_status }),
    }[kind];
    run(call, { onSuccess: () => { setEdit(null); reload(); }, onError: (e) => setErrors({ ...fieldErrors(e), _: e.message }) });
  };

  const docFees = data.fees.filter((f) => f.applies_to === 'Document');
  const r = edit?.row;

  return (
    <>
      <PageHeader title="Service Policies" subtitle="Fees, document rules, academic terms and which offices must approve clearance." />
      <Card flush>
        <div className="card-header">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'terms' && <Button size="sm" variant="primary" onClick={() => open('term', NEW_TERM)}><Plus /> New term</Button>}
        </div>
        <div className="table-wrap">
          {tab === 'fees' && (
            <table className="table">
              <thead><tr><th>Code</th><th>Fee</th><th>Applies to</th><th>Basis</th><th className="num">Amount</th><th>Status</th><th /></tr></thead>
              <tbody>{data.fees.map((f) => (
                <tr key={f.fee_id}>
                  <td className="mono">{f.fee_code}</td><td className="cell-main">{f.fee_name}</td><td>{f.applies_to}</td><td>{f.fee_basis}</td>
                  <td className="num">{peso(f.amount)}</td><td><StatusBadge status={f.fee_status} /></td>
                  <td className="actions"><Button size="sm" onClick={() => open('fee', f)}><Pencil /> Edit</Button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {tab === 'documents' && (
            <table className="table">
              <thead><tr><th>Document</th><th>Requires clearance</th><th>Fee</th><th className="num">Processing days</th><th>Status</th><th /></tr></thead>
              <tbody>{data.document_types.map((d) => (
                <tr key={d.document_type_id}>
                  <td><div className="cell-main">{d.document_name}</div><div className="cell-sub mono">{d.document_code}</div></td>
                  <td>{Number(d.requires_clearance) ? 'Yes' : 'No'}</td><td>{d.fee_name || 'Free'}</td>
                  <td className="num">{d.processing_days}</td><td><StatusBadge status={d.document_status} /></td>
                  <td className="actions"><Button size="sm" onClick={() => open('doc', d)}><Pencil /> Edit</Button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {tab === 'terms' && (
            <table className="table">
              <thead><tr><th>Term</th><th>Classes</th><th>Enrollment period</th><th>Status</th><th /></tr></thead>
              <tbody>{data.terms.map((t) => (
                <tr key={t.term_id}>
                  <td className="cell-main">{t.label}</td>
                  <td className="text-sm">{fmtDate(t.start_date)} – {fmtDate(t.end_date)}</td>
                  <td className="text-sm">{fmtDate(t.enrollment_start)} – {fmtDate(t.enrollment_end)}</td>
                  <td><StatusBadge status={t.term_status} /></td>
                  <td className="actions"><Button size="sm" onClick={() => open('term', t)}><Pencil /> Edit</Button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {tab === 'offices' && (
            <table className="table">
              <thead><tr><th>Office</th><th>Type</th><th>Requires clearance approval</th><th>Status</th><th /></tr></thead>
              <tbody>{data.offices.map((o) => (
                <tr key={o.office_id}>
                  <td><div className="cell-main">{o.office_name}</div><div className="cell-sub mono">{o.office_code}</div></td>
                  <td>{o.office_type}</td><td>{Number(o.requires_clearance) ? 'Yes' : 'No'}</td><td><StatusBadge status={o.office_status} /></td>
                  <td className="actions"><Button size="sm" onClick={() => open('office', o)}><Pencil /> Edit</Button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </Card>

      <Modal
        open={!!edit}
        title={{ fee: `Edit ${r?.fee_name}`, doc: `Edit ${r?.document_name}`, term: r?.term_id ? `Edit ${r?.label}` : 'New academic term', office: `Edit ${r?.office_name}` }[edit?.kind]}
        onClose={() => setEdit(null)}
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></>}
      >
        {edit && (
          <div className="form">
            {errors._ && <Alert type="danger">{errors._}</Alert>}
            {edit.kind === 'fee' && (
              <div className="form-grid">
                <Field label={`Amount (${r.fee_basis})`} required error={errors.amount}><input className="input" type="number" min={0} step="0.01" value={r.amount} onChange={(e) => setRow('amount', e.target.value)} /></Field>
                <Field label="Status" required><select className="select" value={r.fee_status} onChange={(e) => setRow('fee_status', e.target.value)}><option>Active</option><option>Inactive</option></select></Field>
                <p className="text-xs text-muted span-2">Set a fee Inactive (or to 0) to waive it. Transactions with no fees skip the payment step.</p>
              </div>
            )}
            {edit.kind === 'doc' && (
              <div className="form-grid">
                <Field label="Fee"><select className="select" value={r.fee_id || ''} onChange={(e) => setRow('fee_id', e.target.value)}><option value="">Free</option>{docFees.map((f) => <option key={f.fee_id} value={f.fee_id}>{f.fee_name} ({peso(f.amount)})</option>)}</select></Field>
                <Field label="Processing days" required error={errors.processing_days}><input className="input" type="number" min={1} value={r.processing_days} onChange={(e) => setRow('processing_days', e.target.value)} /></Field>
                <Field label="Status"><select className="select" value={r.document_status} onChange={(e) => setRow('document_status', e.target.value)}><option>Active</option><option>Inactive</option></select></Field>
                <label className="checkbox"><input type="checkbox" checked={!!Number(r.requires_clearance)} onChange={(e) => setRow('requires_clearance', e.target.checked ? 1 : 0)} /> Requires completed clearance</label>
              </div>
            )}
            {edit.kind === 'term' && (
              <div className="form-grid">
                <Field label="School year" required error={errors.school_year} hint="e.g. 2027-2028"><input className="input" value={r.school_year} onChange={(e) => setRow('school_year', e.target.value)} /></Field>
                <Field label="Semester" required><select className="select" value={r.semester} onChange={(e) => setRow('semester', e.target.value)}><option>First</option><option>Second</option><option>Summer</option></select></Field>
                <Field label="Classes start" required error={errors.start_date}><input className="input" type="date" value={r.start_date} onChange={(e) => setRow('start_date', e.target.value)} /></Field>
                <Field label="Classes end" required error={errors.end_date}><input className="input" type="date" value={r.end_date} onChange={(e) => setRow('end_date', e.target.value)} /></Field>
                <Field label="Enrollment opens" required error={errors.enrollment_start}><input className="input" type="date" value={r.enrollment_start} onChange={(e) => setRow('enrollment_start', e.target.value)} /></Field>
                <Field label="Enrollment closes" required error={errors.enrollment_end}><input className="input" type="date" value={r.enrollment_end} onChange={(e) => setRow('enrollment_end', e.target.value)} /></Field>
                <Field label="Status" required hint="Only one term can be Open; opening this term closes the other."><select className="select" value={r.term_status} onChange={(e) => setRow('term_status', e.target.value)}><option>Upcoming</option><option>Open</option><option>Closed</option></select></Field>
              </div>
            )}
            {edit.kind === 'office' && (
              <div className="form-grid">
                <label className="checkbox span-2"><input type="checkbox" checked={!!Number(r.requires_clearance)} onChange={(e) => setRow('requires_clearance', e.target.checked ? 1 : 0)} /> This office must approve student clearance</label>
                <Field label="Status"><select className="select" value={r.office_status} onChange={(e) => setRow('office_status', e.target.value)}><option>Active</option><option>Inactive</option></select></Field>
                <p className="text-xs text-muted span-2">Applies to new clearance requests. Department offices only receive requests from their own students.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
