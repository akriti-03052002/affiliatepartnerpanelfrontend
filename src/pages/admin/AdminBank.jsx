import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";

export default function AdminBank() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState({});
  const [error, setError] = useState("");

  const load = () => adminApi.get("/admin/bank/pending").then((res) => setAccounts(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const verify = async (account, status) => {
    setError("");
    const razorpayCheck = account.razorpayCheck;
    const razorpayPassed = razorpayCheck?.paymentStatus === "captured" && razorpayCheck?.nameMatchStatus === "matched";

    let overrideReason;
    if (status === "verified" && !razorpayPassed) {
      overrideReason = window.prompt(
        "The Razorpay bank check hasn't passed (payment not captured, or the name doesn't match). Enter a reason to verify anyway:"
      );
      if (!overrideReason?.trim()) return;
    }

    try {
      await adminApi.patch(`/admin/bank/${account._id}/verify`, { status, overrideReason });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update this bank account.");
    }
  };

  const reveal = async (id) => {
    const res = await adminApi.get(`/admin/bank/${id}/reveal`);
    setRevealed((prev) => ({ ...prev, [id]: res.data.data }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Bank Account Review</h1>
      <p className="text-sm text-slate-500 -mt-4">Revealing full account details is restricted to finance admins and is audit-logged on every access.</p>
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No bank accounts waiting for review."
            rows={accounts}
            columns={[
              { key: "partner", header: "Partner", render: (a) => a.partnerId?.legalEntity?.businessName || "—" },
              { key: "bank", header: "Bank", render: (a) => a.bankName },
              { key: "acct", header: "Account", render: (a) => revealed[a._id] ? `${revealed[a._id].accountNumber} / ${revealed[a._id].ifsc}` : `•••• ${a.accountNumberLast4}` },
              {
                key: "razorpay",
                header: "Razorpay Check",
                render: (a) => (
                  <div className="flex flex-col gap-1 items-start">
                    <Badge status={a.razorpayCheck?.paymentStatus || "not_initiated"}>
                      {(a.razorpayCheck?.paymentStatus || "not_initiated").replace(/_/g, " ")}
                    </Badge>
                    <Badge status={a.razorpayCheck?.nameMatchStatus === "matched" ? "verified" : a.razorpayCheck?.nameMatchStatus === "mismatched" ? "rejected" : "not_submitted"}>
                      {(a.razorpayCheck?.nameMatchStatus || "not_checked").replace(/_/g, " ")}
                    </Badge>
                  </div>
                )
              },
              {
                key: "actions",
                header: "",
                render: (a) => (
                  <div className="flex gap-3">
                    {!revealed[a._id] && (
                      <button onClick={() => reveal(a._id)} className="text-xs font-semibold text-slate-500 hover:underline">Reveal</button>
                    )}
                    <button onClick={() => verify(a, "verified")} className="text-xs font-semibold text-emerald-600 hover:underline">Verify</button>
                    <button onClick={() => verify(a, "rejected")} className="text-xs font-semibold text-brand-red hover:underline">Reject</button>
                  </div>
                )
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
