import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import adminApi from "../../../services/adminApi";
import Card from "../../ui/Card";
import Table from "../../ui/Table";
import Badge from "../../ui/Badge";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const date = (d) => (d ? new Date(d).toLocaleDateString() : "—");

// Read-only lists of one affiliate's leads, rewards and settlements. Actions
// on them stay on the main pages (linked below each list).
const LISTS = {
  leads: {
    url: "/admin/leads",
    manageAt: "/admin/leads",
    manageLabel: "Manage in Leads",
    empty: "This affiliate hasn't generated any leads yet.",
    columns: [
      {
        key: "company",
        header: "Lead",
        render: (l) => (
          <div>
            <p className="font-medium text-slate-900">{l.customer.companyName}</p>
            <p className="text-xs text-slate-400">{[l.customer.contactName, l.customer.phone].filter(Boolean).join(" · ") || "—"}</p>
          </div>
        )
      },
      { key: "screens", header: "Screens", render: (l) => l.closure?.screenCount || l.requirement?.screenCount || 0 },
      { key: "status", header: "Status", render: (l) => <Badge status={l.status} /> },
      { key: "value", header: "Value", render: (l) => (l.status === "won" ? money(l.closure.dealValue) : l.estimatedValue ? `~${money(l.estimatedValue)}` : "—") },
      { key: "reward", header: "Reward", render: (l) => (l.status === "won" ? money(l.closure.commissionAmount) : "—") },
      { key: "date", header: "Generated On", render: (l) => date(l.createdAt) }
    ]
  },
  rewards: {
    url: "/admin/commissions",
    manageAt: "/admin/settlements",
    manageLabel: "Pay in Settlements",
    empty: "No rewards yet.",
    columns: [
      { key: "lead", header: "Lead", render: (c) => c.referralId?.customer?.companyName || "—" },
      { key: "value", header: "Deal Value", render: (c) => (c.transaction?.revenue ? money(c.transaction.revenue) : "—") },
      { key: "reward", header: "Reward", render: (c) => <span className="font-semibold">{money(c.calculation.netCommission)}</span> },
      { key: "status", header: "Status", render: (c) => <Badge status={c.settlement.status} /> },
      { key: "date", header: "Earned", render: (c) => date(c.createdAt) }
    ]
  },
  settlements: {
    url: "/admin/settlements",
    manageAt: "/admin/settlements",
    manageLabel: "Pay out in Settlements",
    empty: "No settlements yet.",
    columns: [
      { key: "number", header: "Settlement", render: (s) => s.settlementNumber || "—" },
      { key: "count", header: "Rewards", render: (s) => s.commissionIds?.length || 0 },
      { key: "net", header: "Net Payout", render: (s) => <span className="font-semibold">{money(s.amount?.net)}</span> },
      { key: "status", header: "Status", render: (s) => <Badge status={s.status} /> },
      { key: "paid", header: "Paid On", render: (s) => date(s.payment?.paidAt) },
      { key: "date", header: "Created", render: (s) => date(s.createdAt) }
    ]
  }
};

export default function PartnerRecords({ partnerId, kind }) {
  const list = LISTS[kind];
  const [rows, setRows] = useState(null);

  useEffect(() => {
    adminApi.get(list.url, { params: { partnerId } })
      .then((res) => setRows(res.data.data))
      .catch(() => setRows([]));
  }, [partnerId, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  // (remounted per tab via key in AdminPartnerDetail, so rows start as null)

  return (
    <div className="space-y-3">
      <Card>
        {rows === null
          ? <p className="text-slate-400 text-sm p-6">Loading...</p>
          : <Table empty={list.empty} rows={rows} columns={list.columns} />}
      </Card>
      <div className="flex justify-end">
        <Link to={list.manageAt} className="text-sm font-semibold text-brand-red hover:underline">{list.manageLabel} →</Link>
      </div>
    </div>
  );
}
