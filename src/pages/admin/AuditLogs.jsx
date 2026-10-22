import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, ScrollText, Search } from 'lucide-react';
import { Card, Empty, ErrorAlert, Loading, PageHeader } from '../../components/ui';
import { fmtDateTime, useApi } from '../../utils';

const pretty = (v) => {
  if (!v) return '—';
  try { return JSON.stringify(JSON.parse(v), null, 1); } catch { return v; }
};

export default function AuditLogs() {
  const [filters, setFilters] = useState({ action: '', user: '', table: '' });
  const { data, error, loading } = useApi(`/admin/audit-logs?${new URLSearchParams(filters)}`);
  const [expanded, setExpanded] = useState(null);

  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Read-only trail of logins, status changes, decisions, receipts, grade publication and releases." />
      <Card flush>
        <div className="card-header">
          <div className="filters">
            <div className="input-icon"><Search /><input className="input" placeholder="Action (e.g. ENROLLMENT)" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} /></div>
            <input className="input" placeholder="Username" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} />
            <select className="select" value={filters.table} onChange={(e) => setFilters({ ...filters, table: e.target.value })}>
              <option value="">All records</option>
              {data?.tables.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="card-body"><ErrorAlert error={error} /></div>}
        {loading && !data ? <Loading /> : !data?.logs.length ? <Empty icon={ScrollText} title="No audit entries" /> : (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: '640px' }}>
              <thead><tr><th /><th>When</th><th>User</th><th>Action</th><th>Record</th><th>IP address</th></tr></thead>
              <tbody>
                {data.logs.map((a) => (
                  <Fragment key={a.audit_id}>
                    <tr onClick={() => setExpanded(expanded === a.audit_id ? null : a.audit_id)}>
                      <td>{a.old_value || a.new_value ? (expanded === a.audit_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}</td>
                      <td className="text-sm nowrap">{fmtDateTime(a.created_at)}</td>
                      <td>{a.username ? <><div className="cell-main">{a.username}</div><div className="cell-sub">{a.role_name}</div></> : <span className="text-faint">—</span>}</td>
                      <td className="mono text-sm">{a.action}</td>
                      <td className="text-sm">{a.table_name}{a.record_id ? ` #${a.record_id}` : ''}</td>
                      <td className="mono text-xs">{a.ip_address || '—'}</td>
                    </tr>
                    {expanded === a.audit_id && (
                      <tr>
                        <td />
                        <td colSpan={5}>
                          <div className="grid grid-2">
                            <div><div className="label">Old value</div><pre className="mono text-xs">{pretty(a.old_value)}</pre></div>
                            <div><div className="label">New value</div><pre className="mono text-xs">{pretty(a.new_value)}</pre></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
