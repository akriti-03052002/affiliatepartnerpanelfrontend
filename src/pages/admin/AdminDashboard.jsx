import { useEffect, useState } from "react";
import { Building2, FileCheck, Landmark, Wallet, Users, Trophy, Banknote } from "lucide-react";
import { Link } from "react-router-dom";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";

// Shows every status in `order` even when its count is 0, so "0 rejected"
// is visible rather than the row just disappearing.
function BreakdownCard({ title, data, order }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-slate-900 mb-3">{title}</p>
      <div className="space-y-2">
        {order.map((status) => (
          <div key={status} className="flex items-center justify-between">
            <Badge status={status} />
            <span className="text-sm font-semibold text-slate-700">{data?.[status] || 0}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState(null);
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    Promise.all([
      adminApi.get("/admin/partners", { params: { status: "pending_verification" } }),
      adminApi.get("/admin/documents/pending"),
      adminApi.get("/admin/bank/pending"),
      adminApi.get("/admin/settlements", { params: { status: "approved" } }),
      adminApi.get("/admin/settlements", { params: { status: "on_hold" } }),
      adminApi.get("/admin/stats/kpis")
    ]).then(([partners, documents, bank, readyToPay, onHold, statsRes]) => {
      setCounts({
        pendingPartners: partners.data.data.length,
        pendingDocuments: documents.data.data.length,
        pendingBank: bank.data.data.length,
        readyToPay: readyToPay.data.data.length,
        onHold: onHold.data.data.length
      });
      setKpis(statsRes.data.data);
    });
  }, []);

  if (!counts) return <p className="text-slate-400 text-sm">Loading...</p>;

  const wonLeads = kpis?.leadsByStatus?.won || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/admin/partners"><StatCard label="Pending Partner Verification" value={counts.pendingPartners} icon={Building2} tone="brand" /></Link>
        <Link to="/admin/documents"><StatCard label="Pending KYC Documents" value={counts.pendingDocuments} icon={FileCheck} /></Link>
        <Link to="/admin/bank"><StatCard label="Pending Bank Verification" value={counts.pendingBank} icon={Landmark} /></Link>
        <Link to="/admin/settlements"><StatCard label="Payouts Ready to Pay" value={counts.readyToPay} icon={Wallet} /></Link>
      </div>

      {kpis && (
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Business Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Affiliates" value={kpis.partnersByType?.affiliate || 0} icon={Building2} />
            <Link to="/admin/leads"><StatCard label="Total Leads" value={kpis.totalLeads} icon={Users} /></Link>
            <Link to="/admin/leads"><StatCard label="Deals Won" value={wonLeads} icon={Trophy} /></Link>
            <StatCard label="Total Payouts Paid" value={`₹${kpis.totalPayoutsPaid.toLocaleString()}`} icon={Banknote} />
          </div>
          <p className="text-xs text-slate-400 mt-4">
            {kpis.totalPartners} total partners ({kpis.activePartners} active) · ₹{kpis.totalCommissionGenerated.toLocaleString()} total rewards generated
          </p>
        </Card>
      )}

      {kpis && (
        <div>
          <h2 className="font-semibold text-slate-900 mb-3">Verification Totals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <BreakdownCard
              title="Partners"
              data={kpis.partnersByStatus}
              order={["draft", "pending_verification", "under_review", "active", "suspended", "rejected", "inactive"]}
            />
            <BreakdownCard
              title="KYC Documents"
              data={kpis.documentsByStatus}
              order={["pending", "verified", "rejected"]}
            />
            <BreakdownCard
              title="Bank Accounts"
              data={kpis.bankAccountsByStatus}
              order={["pending", "verified", "rejected"]}
            />
            <BreakdownCard
              title="Referral Rewards"
              data={kpis.commissionsByStatus}
              order={["pending", "approved", "eligible", "settled", "cancelled"]}
            />
            <BreakdownCard
              title="Settlements"
              data={kpis.settlementsByStatus}
              order={["draft", "pending_approval", "approved", "paid", "failed", "cancelled"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
