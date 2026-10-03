import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronRight } from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => adminApi.get("/admin/notifications").then((res) => setNotifications(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await adminApi.patch("/admin/notifications/read-all");
    load();
  };

  const markRead = async (id) => {
    await adminApi.patch(`/admin/notifications/${id}/read`);
    load();
  };

  const openNotification = (n) => {
    if (!n.read) markRead(n._id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Affiliate activity that needs a review or action from your team.</p>
        </div>
        <Button variant="outline" onClick={markAllRead}>Mark all as read</Button>
      </div>

      <Card className="divide-y divide-slate-100">
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-slate-400 text-sm p-6 text-center">No notifications yet.</p>
        ) : (
          notifications.map((n) => (
            <div key={n._id} className={`flex items-start gap-3 ${!n.read ? "bg-brand-red/5" : ""}`}>
              <button type="button" onClick={() => openNotification(n)} className="flex-1 min-w-0 flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition">
                <Bell size={16} className="text-slate-400 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-sm text-slate-500">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {n.link && <ChevronRight size={16} className="text-slate-300 mt-1 shrink-0" />}
              </button>
              {!n.read && (
                <button onClick={() => markRead(n._id)} className="text-slate-400 hover:text-brand-red p-4" aria-label="Mark as read">
                  <Check size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
