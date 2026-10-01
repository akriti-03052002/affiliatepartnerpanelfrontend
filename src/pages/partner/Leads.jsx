import { useEffect, useState } from "react";
import { Plus, Users, Handshake, Trophy, Wallet } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import StatCard from "../../components/ui/StatCard";
import { Input } from "../../components/ui/Input";
import { usePartnerAuth } from "../../context/PartnerAuthContext";

const EMPTY_FORM = { companyName: "", contactName: "", email: "", phone: "", screenCount: "", notes: "" };

const formatMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// What the partner sees for each point in the pipeline. SPOTX moves the
// lead along; the partner only generates it.
function leadProgress(lead) {
  switch (lead.status) {
    case "new": return { status: "new", label: "Lead Generated" };
    case "contacted": return { status: "contacted", label: "Contacted" };
    case "won": return { status: "won", label: "Won" };
    case "rejected": return { status: "rejected", label: "Not a fit" };
    default: return { status: lead.status, label: lead.status };
  }
}

export default function Leads() {
  const { hasPermission } = usePartnerAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.get("/partner/referrals").then((res) => setLeads(res.data.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.post("/partner/referrals", {
        customer: { companyName: form.companyName, contactName: form.contactName, email: form.email, phone: form.phone },
        requirement: { screenCount: Number(form.screenCount), notes: form.notes }
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong generating the lead.");
    } finally {
      setSubmitting(false);
    }
  };

  const inProgress = leads.filter((l) => ["new", "contacted"].includes(l.status)).length;
  const won = leads.filter((l) => l.status === "won");
  const commissionEarned = won.reduce((sum, l) => sum + (l.closure?.commissionAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tell us about a business and how many screens they need. SPOTX handles pricing and the deal. When the lead becomes a won deal, you get a one-time Referral Reward decided by SPOTX.
          </p>
        </div>
        {hasPermission("referrals:create") && (
          <Button onClick={() => setShowForm((v) => !v)}>
            <span className="flex items-center gap-2"><Plus size={16} /> New Lead</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Leads Generated" value={leads.length} icon={Users} />
        <StatCard label="In Progress" value={inProgress} icon={Handshake} />
        <StatCard label="Deals Won" value={won.length} icon={Trophy} tone="brand" />
        <StatCard label="Rewards Earned" value={formatMoney(commissionEarned)} icon={Wallet} />
      </div>

      {showForm && (
        <Card className="p-6">
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Company Name *" name="companyName" value={form.companyName} onChange={handleChange} required />
            <Input label="Contact Name" name="contactName" value={form.contactName} onChange={handleChange} />
            <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange} />
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
            <Input label="Number of Screens *" type="number" min={1} step={1} name="screenCount" value={form.screenCount} onChange={handleChange} required />
            <div className="md:col-span-2">
              <Input label="Notes" name="notes" value={form.notes} onChange={handleChange} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" loading={submitting}>Generate Lead</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <Table
            empty="No leads generated yet."
            rows={leads}
            columns={[
              {
                key: "company",
                header: "Company",
                render: (l) => (
                  <div>
                    <p className="font-medium text-slate-900">{l.customer.companyName}</p>
                    <p className="text-xs text-slate-400">{[l.customer.contactName, l.customer.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                )
              },
              { key: "screens", header: "Screens", render: (l) => l.closure?.screenCount || l.requirement?.screenCount || 0 },
              {
                key: "progress",
                header: "Progress",
                render: (l) => {
                  const p = leadProgress(l);
                  return (
                    <div>
                      <Badge status={p.status}>{p.label}</Badge>
                      {l.closure?.reason && l.status === "rejected" && (
                        <p className="text-xs text-slate-400 mt-1">{l.closure.reason}</p>
                      )}
                    </div>
                  );
                }
              },
              {
                key: "commission",
                header: "Reward",
                render: (l) => (l.status === "won"
                  ? <span className="font-semibold text-emerald-700">{formatMoney(l.closure.commissionAmount)}</span>
                  : "—")
              },
              { key: "date", header: "Generated On", render: (l) => new Date(l.createdAt).toLocaleDateString() }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
