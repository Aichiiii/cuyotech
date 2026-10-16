import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { Alert, Button, Card, ErrorAlert, Loading, PageHeader, useAction } from '../../components/ui';
import { useApi } from '../../utils';

export default function Roles() {
  const { refresh } = useAuth();
  const { data, error, loading, reload } = useApi('/admin/roles');
  const [matrix, setMatrix] = useState({});
  const [run, busy] = useAction();

  useEffect(() => {
    if (data) setMatrix(Object.fromEntries(data.roles.map((r) => [r.role_id, r.permission_ids])));
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  const toggle = (roleId, permId) =>
    setMatrix((m) => ({ ...m, [roleId]: m[roleId].includes(permId) ? m[roleId].filter((x) => x !== permId) : [...m[roleId], permId] }));
  const changed = (r) => [...(matrix[r.role_id] || [])].sort().join() !== [...r.permission_ids].sort().join();
  const save = (r) => run(() => api.put(`/admin/roles/${r.role_id}/permissions`, { permission_ids: matrix[r.role_id] }), { onSuccess: async () => { await reload(); refresh(); } });

  return (
    <>
      <PageHeader title="Roles & Permissions" subtitle="Control what each role can do. Changes apply on the users' next request." />
      <div className="stack">
        <Alert type="info">Separation of duties: the Administrator manages access but should not hold academic or financial approval permissions.</Alert>
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Permission</th>
                  {data.roles.map((r) => <th key={r.role_id} className="center">{r.role_name}<div className="cell-sub">{r.user_count} user(s)</div></th>)}
                </tr>
              </thead>
              <tbody>
                {data.permissions.map((p) => (
                  <tr key={p.permission_id}>
                    <td><div className="mono fw-600">{p.permission_code}</div><div className="cell-sub">{p.description}</div></td>
                    {data.roles.map((r) => (
                      <td key={r.role_id} className="center">
                        <input type="checkbox" checked={matrix[r.role_id]?.includes(p.permission_id) || false} onChange={() => toggle(r.role_id, p.permission_id)} aria-label={`${r.role_name}: ${p.permission_code}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  {data.roles.map((r) => (
                    <td key={r.role_id} className="center">
                      <Button size="sm" variant={changed(r) ? 'primary' : ''} disabled={!changed(r) || busy} onClick={() => save(r)}><Save /> Save</Button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
