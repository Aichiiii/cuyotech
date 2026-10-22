import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../../api';
import { Button, Card, Empty, ErrorAlert, Loading, PageHeader, useAction } from '../../components/ui';
import { fmtDateTime, timeAgo, useApi } from '../../utils';

export default function Notifications() {
  const { data, error, loading, reload } = useApi('/notifications');
  const [run, busy] = useAction();

  const markRead = (n) => !Number(n.is_read) && run(() => api.post(`/notifications/${n.notification_id}/read`), { silent: true, onSuccess: reload });

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates on your applications, requests and assigned work."
        actions={<Button onClick={() => run(() => api.post('/notifications/read-all'), { silent: true, onSuccess: reload })} loading={busy} disabled={!data?.unread}><CheckCheck /> Mark all as read</Button>}
      />
      {error && <ErrorAlert error={error} />}
      <Card flush>
        {loading && !data ? <Loading /> : !data?.notifications.length ? (
          <Empty icon={Bell} title="No notifications" text="You're all caught up." />
        ) : (
          <ul className="list">
            {data.notifications.map((n) => (
              <li key={n.notification_id} className={`list-item ${Number(n.is_read) ? '' : 'unread'}`} onClick={() => markRead(n)}>
                <div className="w-full">
                  <div className="row-between">
                    <span className="list-title">{n.title}</span>
                    <span className="list-meta" title={fmtDateTime(n.created_at)}>{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="list-text">{n.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
