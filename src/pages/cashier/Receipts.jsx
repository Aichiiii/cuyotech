import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Search } from 'lucide-react';
import { Card, Empty, ErrorAlert, Loading, PageHeader } from '../../components/ui';
import { fmtDateTime, peso, useApi } from '../../utils';

export default function Receipts() {
  const { data, error, loading } = useApi('/cashier/receipts');
  const [search, setSearch] = useState('');
  if (loading) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const s = search.toLowerCase();
  const rows = data.receipts.filter((r) => !s || [r.receipt_number, r.student_name, r.student_number].some((v) => v.toLowerCase().includes(s)));
  const total = rows.reduce((a, r) => a + Number(r.amount), 0);

  return (
    <>
      <PageHeader title="Official Receipts" subtitle="All receipts issued for confirmed payments." />
      <Card
        flush
        actions={<div className="input-icon"><Search /><input className="input input-sm" placeholder="Search OR no. or student…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>}
        title={`${rows.length} receipt(s)`}
        subtitle={`Total ${peso(total)}`}
      >
        {!rows.length ? <Empty icon={Receipt} title="No receipts found" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>OR No.</th><th>Issued</th><th>Student</th><th>Method</th><th className="num">Amount</th><th>Issued by</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.receipt_id}>
                    <td className="mono fw-600">{r.receipt_number}</td>
                    <td className="text-sm nowrap">{fmtDateTime(r.issued_at)}</td>
                    <td><div className="cell-main">{r.student_name}</div><div className="cell-sub">{r.student_number}</div></td>
                    <td>{r.payment_method}</td>
                    <td className="num">{peso(r.amount)}</td>
                    <td className="text-sm">{r.issued_by_name}</td>
                    <td className="actions"><Link className="btn btn-sm" to={`/print/receipt/${r.receipt_id}`}>View / Print</Link></td>
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
