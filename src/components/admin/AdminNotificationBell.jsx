import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import adminApi from "../../services/adminApi";

// New affiliate events should show up without a page reload, so the bell
// re-checks on an interval (only while the tab is visible).
const POLL_MS = 30000;

export default function AdminNotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    adminApi.get("/admin/notifications")
      .then((res) => {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  const recent = notifications.slice(0, 8);

  const markRead = async (id) => {
    await adminApi.patch(`/admin/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await adminApi.patch("/admin/notifications/read-all");
    load();
  };

  const openNotification = (n) => {
    setOpen(false);
    if (!n.read) markRead(n._id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-brand-black transition"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10px] font-bold leading-[18px] text-center border-2 border-white box-content">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-brand-red hover:underline">
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                <p className="text-sm text-slate-400 p-4">Loading...</p>
              ) : recent.length === 0 ? (
                <p className="text-sm text-slate-400 p-4 text-center">You're all caught up.</p>
              ) : (
                recent.map((n) => (
                  <div key={n._id} className={`flex items-start gap-2 ${!n.read ? "bg-brand-red/5" : ""}`}>
                    <button type="button" onClick={() => openNotification(n)} className="flex-1 min-w-0 text-left p-3 hover:bg-slate-50 transition">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </button>
                    {!n.read && (
                      <button type="button" onClick={() => markRead(n._id)} className="shrink-0 text-slate-400 hover:text-brand-red p-3" aria-label="Mark as read">
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <Link
              to="/admin/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-brand-red hover:underline px-4 py-3 border-t border-slate-100"
            >
              View all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
