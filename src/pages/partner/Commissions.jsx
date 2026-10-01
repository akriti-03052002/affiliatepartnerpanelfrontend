import { useEffect, useState } from "react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";

export default function Commissions() {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/partner/commissions").then((res) => setCommissions(res.data.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Referral Rewards</h1>

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No rewards yet. You earn a reward when a lead you referred becomes a won deal."
            rows={commissions}
            columns={[
              { key: "lead", header: "Lead", render: (r) => r.referralId?.customer?.companyName || "—" },
              { key: "net", header: "Reward", render: (r) => `₹${r.calculation.netCommission.toLocaleString()}` },
              { key: "status", header: "Status", render: (r) => <Badge status={r.settlement.status} /> },
              { key: "date", header: "Earned", render: (r) => new Date(r.createdAt).toLocaleDateString() }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
