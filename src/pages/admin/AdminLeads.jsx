import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";

const FILTERS = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "won", label: "Won" },
  { key: "rejected", label: "Rejected" }
];

const formatMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const actionClass = (tone) => `text-xs font-semibold hover:underline ${
  { green: "text-emerald-600", red: "text-brand-red", blue: "text-blue-600" }[tone]
}`;

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [pricePerScreen, setPricePerScreen] = useState(0);
  const [planPrices, setPlanPrices] = useState({ basic: 0, premium: 0 });
  const [winTarget, setWinTarget] = useState(null);
  const [winForm, setWinForm] = useState({ plan: "basic", screenCount: "", commissionAmount: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.get("/admin/leads", { params: { status: filter || undefined } })
    .then((res) => { setLeads(res.data.data); setPricePerScreen(res.data.pricePerScreen || 0); setPlanPrices(res.data.planPrices || { basic: 0, premium: 0 }); })
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, action, body = {}) => {
    try {
      await adminApi.patch(`/admin/leads/${id}/${action}`, body);
      load();
    } catch (err) {
      window.alert(err.response?.data?.message || "Something went wrong.");
    }
  };

  const closeWithReason = (id, action, question) => {
    const reason = window.prompt(question);
    if (reason === null) return;
    act(id, action, { reason });
  };

  const openWin = (lead) => {
    setError("");
    setWinTarget(lead);
    setWinForm({
      plan: "basic",
      screenCount: String(lead.requirement?.screenCount || ""),
      commissionAmount: ""
    });
  };

  const submitWin = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await adminApi.patch(`/admin/leads/${winTarget._id}/win`, {
        plan: winForm.plan,
        screenCount: Number(winForm.screenCount),
        commissionAmount: Number(winForm.commissionAmount)
      });
      setWinTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong marking the lead won.");
    } finally {
      setBusy(false);
    }
  };

  const winPrice = planPrices[winForm.plan] || 0;
  const winDealValue = (Number(winForm.screenCount) || 0) * winPrice;

  const renderActions = (l) => {
    if (l.status !== "new" && l.status !== "contacted") return null;
    return (
      <div className="flex flex-wrap gap-3">
        {l.status === "new" && <button onClick={() => act(l._id, "contacted")} className={actionClass("blue")}>Mark Contacted</button>}
        <button onClick={() => openWin(l)} className={actionClass("green")}>Mark Won</button>
        <button onClick={() => closeWithReason(l._id, "reject", "Why is this lead rejected? (shown to the partner)")} className={actionClass("red")}>Reject</button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500 mt-1">
          Partners give leads with a screen count. Contact them, then mark each lead Won or Rejected. When it is won, enter the deal value, screens and the partner&apos;s one-time Referral Reward. Estimated value = screens × {formatMoney(pricePerScreen)} (Basic price per screen).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setLoading(true); setFilter(f.key); }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              filter === f.key ? "border-brand-red text-brand-red" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {winTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setWinTarget(null)}>
          <Card className="p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-slate-900">Mark lead as won</h2>
            <p className="text-sm text-slate-500 mb-4">
              {winTarget.customer.companyName} · referred by {winTarget.partnerId?.legalEntity?.businessName || winTarget.partnerId?.partnerCode}
            </p>
            {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            <form onSubmit={submitWin} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Plan" value={winForm.plan} onChange={(e) => setWinForm({ ...winForm, plan: e.target.value })}>
                  <option value="basic">Basic — {formatMoney(planPrices.basic)} / screen</option>
                  <option value="premium">Premium — {formatMoney(planPrices.premium)} / screen</option>
                </Select>
                <Input label="Number of screens" type="number" min={1} step={1} value={winForm.screenCount} onChange={(e) => setWinForm({ ...winForm, screenCount: e.target.value })} required />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                <p className="text-xs text-slate-500">Deal value (calculated)</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{formatMoney(winDealValue)}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {Number(winForm.screenCount) || 0} screens × {formatMoney(winPrice)} ({winForm.plan === "premium" ? "Premium" : "Basic"} plan, per month)
                </p>
              </div>

              <Input label="Referral Reward for the partner (₹, one-time)" type="number" min={1} value={winForm.commissionAmount} onChange={(e) => setWinForm({ ...winForm, commissionAmount: e.target.value })} required />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setWinTarget(null)}>Cancel</Button>
                <Button type="submit" loading={busy}>Confirm Won</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No leads here."
            rows={leads}
            columns={[
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
              { key: "partner", header: "Partner", render: (l) => l.partnerId?.legalEntity?.businessName || l.partnerId?.partnerCode || "—" },
              {
                key: "status",
                header: "Status",
                render: (l) => (
                  <div>
                    <Badge status={l.status} />
                    {l.closure?.reason && <p className="text-xs text-slate-400 mt-1">{l.closure.reason}</p>}
                  </div>
                )
              },
              {
                key: "value",
                header: "Value",
                render: (l) => {
                  if (l.status === "won") return formatMoney(l.closure.dealValue);
                  return l.estimatedValue ? <span className="text-slate-500" title="Estimated: screens × price per screen">~{formatMoney(l.estimatedValue)}</span> : "—";
                }
              },
              {
                key: "commission",
                header: "Reward",
                render: (l) => (l.status === "won" ? <span className="font-semibold text-emerald-700">{formatMoney(l.closure.commissionAmount)}</span> : "—")
              },
              { key: "date", header: "Generated On", render: (l) => new Date(l.createdAt).toLocaleDateString() },
              { key: "actions", header: "", render: renderActions }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
