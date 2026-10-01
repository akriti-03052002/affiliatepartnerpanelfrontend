import { useState } from "react";
import adminApi from "../../../services/adminApi";
import Card from "../../ui/Card";
import Table from "../../ui/Table";
import Badge from "../../ui/Badge";

const ROLES = ["admin", "sales", "finance", "viewer"];

// The affiliate's team logins. Admin can change a member's role or block /
// unblock their login; the owner account is fixed.
export default function PartnerTeam({ partnerId, team, onChanged }) {
  const [busyId, setBusyId] = useState(null);

  const update = async (member, body) => {
    setBusyId(member._id);
    try {
      await adminApi.patch(`/admin/partners/${partnerId}/team/${member._id}`, body);
      onChanged();
    } catch (err) {
      window.alert(err.response?.data?.message || "Couldn't update this team member.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <Table
        empty="No team members."
        rows={team}
        columns={[
          {
            key: "name",
            header: "Member",
            render: (m) => (
              <div>
                <p className="font-medium text-slate-900">{m.name}</p>
                <p className="text-xs text-slate-400">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
              </div>
            )
          },
          {
            key: "role",
            header: "Role",
            render: (m) => (m.role === "owner" ? (
              <Badge tone="info">owner</Badge>
            ) : (
              <select
                value={m.role}
                disabled={busyId === m._id}
                onChange={(e) => update(m, { role: e.target.value })}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white capitalize"
                aria-label={`Role for ${m.name}`}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ))
          },
          { key: "status", header: "Status", render: (m) => <Badge status={m.status} /> },
          { key: "login", header: "Last Login", render: (m) => (m.auth?.lastLoginAt ? new Date(m.auth.lastLoginAt).toLocaleDateString() : "—") },
          {
            key: "actions",
            header: "",
            render: (m) => (m.role === "owner" ? null : (
              <button
                type="button"
                disabled={busyId === m._id}
                onClick={() => update(m, { status: m.status === "blocked" ? "active" : "blocked" })}
                className={`text-xs font-semibold hover:underline disabled:opacity-50 ${m.status === "blocked" ? "text-emerald-600" : "text-brand-red"}`}
              >
                {m.status === "blocked" ? "Unblock" : "Block login"}
              </button>
            ))
          }
        ]}
      />
    </Card>
  );
}
