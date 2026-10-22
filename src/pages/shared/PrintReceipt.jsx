import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button, ErrorAlert, Loading } from '../../components/ui';
import { fmtDateTime, peso, useApi } from '../../utils';
import { PaperHead } from './PrintCor';

export default function PrintReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useApi(`/print/receipt/${id}`);
  const r = data?.receipt;

  return (
    <div className="print-page">
      <div className="print-toolbar">
        <Button onClick={() => navigate(-1)}><ArrowLeft /> Back</Button>
        <Button variant="primary" onClick={() => window.print()} disabled={!data}><Printer /> Print / Save as PDF</Button>
      </div>
      {loading ? <Loading /> : error ? <div className="paper receipt"><ErrorAlert error={error} /></div> : (
        <div className="paper receipt">
          <PaperHead />
          <div className="paper-title">Official Receipt</div>
          <dl className="info-list">
            <dt>OR No.</dt><dd className="mono">{r.receipt_number}</dd>
            <dt>Date issued</dt><dd>{fmtDateTime(r.issued_at)}</dd>
            <dt>Received from</dt><dd>{data.student_name} ({data.student.student_number})</dd>
            <dt>Program</dt><dd>{data.student.program_code}</dd>
            <dt>Payment for</dt><dd>{r.description}</dd>
            <dt>Method</dt><dd>{r.payment_method}{r.reference_number ? ` — Ref. ${r.reference_number}` : ''}</dd>
          </dl>
          <div className="amount-big">{peso(r.amount)}</div>
          <div className="signature">
            <div><strong>{r.issued_by_name}</strong><br />Cashier</div>
          </div>
          <div className="paper-foot">This receipt is system-generated and valid only for the transaction stated above.</div>
        </div>
      )}
    </div>
  );
}
