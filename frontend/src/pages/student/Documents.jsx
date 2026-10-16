import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { Alert, Button, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader, StatusBadge, useAction } from '../../components/ui';
import { fmtDate, fmtDateTime, peso, useApi } from '../../utils';

const PURPOSES = ['Employment', 'Scholarship', 'Transfer to another school', 'Board / licensure exam', 'Further studies', 'Personal copy', 'Other'];
const CHANNELS = [
  { value: 'Pickup', label: "Pick up at the Registrar's Office" },
  { value: 'Email', label: 'Electronic copy via email' },
];
const STATUS_LABEL = { Submitted: 'Pending review', 'For Correction': 'Needs correction' };
const EMPTY = { group: '', certType: '', purpose: '', otherPurpose: '', copies: 1, delivery_channel: 'Pickup', details: '' };

/** TOR and COR are their own options; every other document type is listed under "Certification". */
const groupOf = (t) => (['TOR', 'COR'].includes(t.document_code) ? t.document_code : 'CERT');
const requestId = (id) => `DR-${String(id).padStart(4, '0')}`;
const channelLabel = (v) => CHANNELS.find((c) => c.value === v)?.label || v;

export default function Documents() {
  const { data, error, loading, reload } = useApi('/student/documents');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [run, busy] = useAction();

  const types = data?.types || [];
  const groups = useMemo(() => {
    const g = [];
    if (types.some((t) => groupOf(t) === 'TOR')) g.push({ value: 'TOR', label: 'Transcript of Records (TOR)' });
    if (types.some((t) => groupOf(t) === 'COR')) g.push({ value: 'COR', label: 'Certificate of Registration (COR)' });
    if (types.some((t) => groupOf(t) === 'CERT')) g.push({ value: 'CERT', label: 'Certification' });
    return g;
  }, [types]);
  const certTypes = types.filter((t) => groupOf(t) === 'CERT');

  const selectedType = form.group === 'CERT'
    ? types.find((t) => String(t.document_type_id) === String(form.certType))
    : types.find((t) => t.document_code === form.group);
  const purposeText = form.purpose === 'Other' ? form.otherPurpose.trim() : form.purpose;
  const fullPurpose = [purposeText, form.details.trim()].filter(Boolean).join(' — ').slice(0, 255);
  const fee = selectedType ? (selectedType.fee_basis === 'Per Copy' ? selectedType.fee_amount * (form.copies || 0) : Number(selectedType.fee_amount || 0)) : null;

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const v = {};
    if (!form.group) v.group = 'Select a document type.';
    if (form.group === 'CERT' && !form.certType) v.certType = 'Select the certification type.';
    if (!form.purpose) v.purpose = 'Select the purpose of your request.';
    if (form.purpose === 'Other' && form.otherPurpose.trim().length < 5) v.otherPurpose = 'Please describe the purpose (at least 5 characters).';
    if (!(form.copies >= 1 && form.copies <= data.max_copies)) v.copies = `Enter 1 to ${data.max_copies} copies.`;
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) return;

    run(() => api.post('/student/documents', {
      document_type_id: selectedType.document_type_id,
      purpose: fullPurpose,
      copies: Number(form.copies),
      delivery_channel: form.delivery_channel,
    }), {
      onSuccess: () => { setForm(EMPTY); reload(); },
      onError: (err) => { setErrors(fieldErrors(err)); setFormError(err.message); },
    });
  };

  const cancel = (r) => run(() => api.post(`/student/documents/${r.request_id}/cancel`), { onSuccess: reload });
  const resubmit = () =>
    run(() => api.put(`/student/documents/${editing.request_id}`, {
      document_type_id: editing.document_type_id, purpose: editing.purpose, copies: Number(editing.copies), delivery_channel: editing.delivery_channel,
    }), {
      onSuccess: () => { setEditing(null); reload(); },
      onError: (err) => setEditing({ ...editing, _errors: fieldErrors(err), _error: err.message }),
    });

  const clearanceText = !selectedType
    ? 'Depends on document'
    : Number(selectedType.requires_clearance)
      ? (data.completed_clearance ? 'Yes — completed ✓' : 'Yes — not yet completed')
      : 'Not required';

  return (
    <>
      <PageHeader title="Request a Document" subtitle="Request a Transcript of Records (TOR), Certificate of Registration (COR), or a certification." />

      <div className="stack">
        <div className="grid grid-sidebar">
          <Card title="Request Details">
            <form className="form" onSubmit={submit} noValidate>
              {formError && <Alert type="danger">{formError}</Alert>}
              <Field label="Document type" required error={errors.group || errors.document_type_id}>
                <select className="select" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value, certType: '' })}>
                  <option value="">Select TOR, COR, or Certification</option>
                  {groups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </Field>
              <Field label="Certification type (if applicable)" error={errors.certType}>
                <select className="select" value={form.certType} onChange={set('certType')} disabled={form.group !== 'CERT'}>
                  <option value="">Select certification</option>
                  {certTypes.map((t) => <option key={t.document_type_id} value={t.document_type_id}>{t.document_name}</option>)}
                </select>
              </Field>
              <Field label="Purpose" required error={errors.purpose || (form.purpose !== 'Other' && errors.purpose)}>
                <select className="select" value={form.purpose} onChange={set('purpose')}>
                  <option value="">Select purpose (e.g. Employment, Scholarship)</option>
                  {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              {form.purpose === 'Other' && (
                <Field label="Specify purpose" required error={errors.otherPurpose}>
                  <input className="input" value={form.otherPurpose} maxLength={120} onChange={set('otherPurpose')} placeholder="e.g. Visa application" />
                </Field>
              )}
              <Field label="Number of copies" required error={errors.copies}>
                <input className="input" type="number" min={1} max={data.max_copies} value={form.copies} onChange={(e) => setForm({ ...form, copies: Number(e.target.value) })} />
              </Field>
              <div className="field">
                <span className="label">Release channel<span className="req">*</span></span>
                <div className="radio-group">
                  {CHANNELS.map((c) => (
                    <label key={c.value} className="checkbox">
                      <input type="radio" name="channel" value={c.value} checked={form.delivery_channel === c.value} onChange={set('delivery_channel')} /> {c.label}
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Additional details (optional)">
                <textarea className="textarea" value={form.details} maxLength={120} onChange={set('details')} placeholder="Add any notes for the Registrar" />
              </Field>
              <div className="note-box">
                <strong>Before you submit</strong>
                <ul>
                  <li>Some documents require completed clearance before release.</li>
                  <li>Fees, if any, are paid to the Cashier and must be confirmed before release.</li>
                  <li>You can cancel a pending request before it is completed.</li>
                </ul>
              </div>
              <div className="form-actions">
                <Button type="button" onClick={() => { setForm(EMPTY); setErrors({}); setFormError(''); }}>Cancel</Button>
                <Button variant="primary" type="submit" loading={busy}>Submit Request</Button>
              </div>
            </form>
          </Card>

          <div className="stack">
            <Card title="Request Summary">
              <dl className="summary-list">
                <div><dt>Document</dt><dd>{selectedType?.document_name || '—'}</dd></div>
                <div><dt>Purpose</dt><dd>{purposeText || '—'}</dd></div>
                <div><dt>Copies</dt><dd>{form.copies || '—'}</dd></div>
                <div><dt>Clearance required</dt><dd>{clearanceText}</dd></div>
                <div><dt>Fee</dt><dd>{fee == null ? 'To be determined' : fee > 0 ? peso(fee) : 'Free'}</dd></div>
                <div><dt>Processing time</dt><dd>{selectedType ? `${selectedType.processing_days} working day(s)` : '—'}</dd></div>
                <div><dt>Release channel</dt><dd>{form.group ? channelLabel(form.delivery_channel) : '—'}</dd></div>
              </dl>
              {selectedType && Number(selectedType.requires_clearance) === 1 && !data.completed_clearance && (
                <div className="mt-3"><Alert type="warning">This document needs a completed clearance. <Link to="/student/clearance">Request clearance</Link></Alert></div>
              )}
            </Card>

            <Card title="Request Progress">
              <ol className="timeline">
                {[
                  ['Submitted', 'Request received by the system'],
                  ['Registrar review', 'Eligibility and document policy checks'],
                  ['Clearance check', 'Only if the document requires it'],
                  ['Payment', 'Only if fees apply; confirmed by the Cashier'],
                  ['Released', 'Document released and recorded'],
                ].map(([t, d], i) => (
                  <li key={t}><span className="timeline-num">{i + 1}</span><div><div className="timeline-title">{t}</div><div className="timeline-text">{d}</div></div></li>
                ))}
              </ol>
            </Card>
          </div>
        </div>

        <Card title="My Document Requests">
          {!data.requests.length ? <Empty icon={FileText} title="No requests yet" text="Your submitted requests will appear here." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Request ID</th><th>Document</th><th>Purpose</th><th>Date</th><th>Fee</th><th>Status</th><th className="actions">Action</th></tr></thead>
                <tbody>
                  {data.requests.map((r) => {
                    const unpaid = r.request_status === 'Approved' && r.fee.total > 0 && r.payment.state === 'Unpaid';
                    return (
                      <tr key={r.request_id}>
                        <td className="mono">{requestId(r.request_id)}</td>
                        <td>{r.document_name}{r.copies > 1 && <span className="text-muted"> ×{r.copies}</span>}</td>
                        <td className="text-sm">{r.purpose}</td>
                        <td className="nowrap">{fmtDate(r.submitted_at)}</td>
                        <td className="nowrap">{r.fee.total > 0 ? <>{peso(r.fee.total)}{r.payment.state !== 'Unpaid' && <div className="cell-sub">{r.payment.state}</div>}</> : 'Free'}</td>
                        <td><StatusBadge status={r.request_status} label={STATUS_LABEL[r.request_status]} /></td>
                        <td className="actions">
                          {r.request_status === 'For Correction' && <Button size="sm" variant="primary" onClick={() => setEditing({ ...r })}>Resolve</Button>}
                          {unpaid && <Link className="btn btn-sm btn-primary" to="/student/payments">Pay</Link>}
                          {(['Submitted', 'For Correction'].includes(r.request_status) || unpaid) && <Button size="sm" onClick={() => cancel(r)} disabled={busy}>Cancel</Button>}
                          {['Approved', 'Released', 'Rejected', 'Cancelled'].includes(r.request_status) && !unpaid && <Button size="sm" onClick={() => setViewing(r)}>View</Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!editing}
        title={`Resolve ${editing ? requestId(editing.request_id) : ''}`}
        onClose={() => setEditing(null)}
        footer={<><Button onClick={() => setEditing(null)}>Close</Button><Button variant="primary" loading={busy} onClick={resubmit}>Resubmit</Button></>}
      >
        {editing && (
          <div className="form">
            <Alert type="warning" title="Registrar's note">{editing.decision_reason}</Alert>
            {editing._error && <Alert type="danger">{editing._error}</Alert>}
            <Field label="Purpose" required error={editing._errors?.purpose}>
              <input className="input" value={editing.purpose} maxLength={255} onChange={(e) => setEditing({ ...editing, purpose: e.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label="Copies" required error={editing._errors?.copies}>
                <input className="input" type="number" min={1} max={data.max_copies} value={editing.copies} onChange={(e) => setEditing({ ...editing, copies: e.target.value })} />
              </Field>
              <Field label="Release channel" required>
                <select className="select" value={editing.delivery_channel} onChange={(e) => setEditing({ ...editing, delivery_channel: e.target.value })}>
                  {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  {editing.delivery_channel === 'Courier' && <option value="Courier">Courier</option>}
                </select>
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewing} title={viewing ? `${requestId(viewing.request_id)} — ${viewing.document_name}` : ''} onClose={() => setViewing(null)} footer={<Button onClick={() => setViewing(null)}>Close</Button>}>
        {viewing && (
          <dl className="summary-list">
            <div><dt>Status</dt><dd><StatusBadge status={viewing.request_status} label={STATUS_LABEL[viewing.request_status]} /></dd></div>
            <div><dt>Purpose</dt><dd>{viewing.purpose}</dd></div>
            <div><dt>Copies</dt><dd>{viewing.copies}</dd></div>
            <div><dt>Release channel</dt><dd>{channelLabel(viewing.delivery_channel)}</dd></div>
            <div><dt>Submitted</dt><dd>{fmtDateTime(viewing.submitted_at)}</dd></div>
            <div><dt>Fee</dt><dd>{viewing.fee.total > 0 ? `${peso(viewing.fee.total)} · ${viewing.payment.state}` : 'Free'}</dd></div>
            {viewing.decision_reason && <div><dt>Registrar's note</dt><dd>{viewing.decision_reason}</dd></div>}
            {viewing.released_at && <div><dt>Released</dt><dd>{fmtDateTime(viewing.released_at)}</dd></div>}
            {viewing.cancelled_at && <div><dt>Cancelled</dt><dd>{fmtDateTime(viewing.cancelled_at)}</dd></div>}
          </dl>
        )}
      </Modal>
    </>
  );
}
