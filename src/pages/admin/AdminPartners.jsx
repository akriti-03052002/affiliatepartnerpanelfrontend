import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, X, Eye, EyeOff, ChevronRight,
  Users, BadgeCheck, Clock, Ban, Wallet, CheckCircle2
} from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "A";

const displayName = (p) => p.legalEntity.businessName || p.primaryContact.name;

// What an admin should do next for this affiliate, if anything.
function nextStep(p) {
  if (!p.legalEntity.businessName) return { tone: "neutral", text: "Profile not completed yet" };
  if (p.status === "pending_verification") return { tone: "warning", text: "KYC & bank waiting for review" };
  if (p.status === "under_review") return { tone: "warning", text: "Under compliance review" };
  if (p.status === "draft") return { tone: "neutral", text: "Documents not submitted yet" };
  if (p.status === "suspended") return { tone: "danger", text: "Suspended — payouts on hold" };
  if (p.status === "rejected") return { tone: "danger", text: "Rejected" };
  return null;
}

function Avatar({ p, size = "md" }) {
  const cls = size === "sm" ? "w-9 h-9 text-xs rounded-xl" : "w-11 h-11 text-sm rounded-2xl";
  const tone = p.status === "active" ? "bg-brand-black text-white" : "bg-slate-200 text-slate-600";
  return <div className={`${cls} ${tone} flex items-center justify-center font-bold shrink-0`}>{initials(displayName(p))}</div>;
}

const BANK_LABEL = { verified: "Verified", pending: "Pending", rejected: "Rejected", not_submitted: "Not added" };

// Every affiliate in one table. All numbers come from `p.live`, which the API
// counts from real leads and rewards on each request.
function PartnerTable({ partners }) {
  const navigate = useNavigate();
  const open = (p) => navigate(`/admin/partners/${p._id}`);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 px-4 font-semibold">Affiliate</th>
              <th className="py-3 px-4 font-semibold">Contact</th>
              <th className="py-3 px-4 font-semibold">Status</th>
              <th className="py-3 px-4 font-semibold text-right">Leads</th>
              <th className="py-3 px-4 font-semibold text-right">Open deals</th>
              <th className="py-3 px-4 font-semibold text-right">Won</th>
              <th className="py-3 px-4 font-semibold text-right">Deal value</th>
              <th className="py-3 px-4 font-semibold text-right">Reward pending</th>
              <th className="py-3 px-4 font-semibold text-right">Reward paid</th>
              <th className="py-3 px-4 font-semibold">Bank</th>
              <th className="py-3 px-4 font-semibold">Joined</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const live = p.live || {};
              const hint = nextStep(p);
              return (
                <tr
                  key={p._id}
                  onClick={() => open(p)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer align-top"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar p={p} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 whitespace-nowrap">{displayName(p)}</p>
                        <p className="text-xs text-slate-400">{p.partnerCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {p.legalEntity.businessName && <p className="text-slate-700 whitespace-nowrap">{p.primaryContact.name}</p>}
                    <p className="text-xs text-slate-500 whitespace-nowrap">{p.primaryContact.email}</p>
                    {p.primaryContact.phone && <p className="text-xs text-slate-400 whitespace-nowrap">{p.primaryContact.phone}</p>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge status={p.status} />
                    {hint && <p className={`text-[11px] mt-1 whitespace-nowrap ${hint.tone === "danger" ? "text-red-600" : hint.tone === "warning" ? "text-amber-600" : "text-slate-400"}`}>{hint.text}</p>}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">{live.leads || 0}</td>
                  <td className="py-3 px-4 text-right">{live.openDeals || 0}</td>
                  <td className="py-3 px-4 text-right">{live.won || 0}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">{live.dealValue ? money(live.dealValue) : "—"}</td>
                  <td className={`py-3 px-4 text-right whitespace-nowrap ${live.rewardsPending || live.rewardsApproved ? "font-semibold text-amber-700" : "text-slate-400"}`}>
                    {money((live.rewardsPending || 0) + (live.rewardsApproved || 0))}
                  </td>
                  <td className={`py-3 px-4 text-right whitespace-nowrap ${live.rewardsPaid ? "font-semibold text-emerald-700" : "text-slate-400"}`}>{money(live.rewardsPaid)}</td>
                  <td className="py-3 px-4"><Badge status={live.bankStatus}>{BANK_LABEL[live.bankStatus] || live.bankStatus}</Badge></td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <Link
                      to={`/admin/partners/${p._id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline whitespace-nowrap"
                    >
                      View <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const EMPTY_FORM = { partnerType: "affiliate", contactName: "", email: "", phone: "", password: "" };

function CreatePartnerModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await adminApi.post("/admin/partners", form);
      onCreated(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong creating the partner.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-partner-title">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 id="create-partner-title" className="text-lg font-semibold text-slate-900">Create affiliate partner</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          They'll get an email with this login. Business details, address and KYC are filled in later from their profile.
        </p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <Input label="Full Name *" name="contactName" value={form.contactName} onChange={set} required autoFocus />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Email *" type="email" name="email" value={form.email} onChange={set} required />
            <Input label="Phone *" name="phone" value={form.phone} onChange={set} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={set}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 pr-11 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create Partner</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SkeletonTable() {
  return (
    <Card className="p-4 space-y-3 animate-pulse">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100" />
          <div className="h-3 bg-slate-100 rounded flex-1" />
          <div className="h-3 bg-slate-100 rounded w-24" />
          <div className="h-3 bg-slate-100 rounded w-16" />
        </div>
      ))}
    </Card>
  );
}

export default function AdminPartners() {
  const [partners, setPartners] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const load = () => adminApi.get("/admin/partners")
    .then((res) => setPartners(res.data.data))
    .catch(() => setPartners([]));

  useEffect(() => { load(); }, []);

  const all = partners || [];
  const count = (statuses) => all.filter((p) => statuses.includes(p.status)).length;
  const sum = (key) => all.reduce((n, p) => n + (p.live?.[key] || 0), 0);

  const SUMMARY = [
    { label: "Total affiliates", value: all.length, sub: `${sum("leads")} leads · ${sum("won")} won`, icon: Users, tone: "bg-slate-100 text-slate-700" },
    { label: "Active", value: count(["active"]), sub: "Verified and earning", icon: BadgeCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Needs review", value: count(["pending_verification", "under_review"]), sub: "Waiting on SPOTX", icon: Clock, tone: "bg-amber-50 text-amber-700" },
    { label: "Suspended / rejected", value: count(["suspended", "rejected"]), sub: "Not earning", icon: Ban, tone: "bg-red-50 text-red-700" },
    { label: "Rewards pending", value: money(sum("rewardsPending") + sum("rewardsApproved")), sub: `${money(sum("rewardsPaid"))} already paid`, icon: Wallet, tone: "bg-brand-red/10 text-brand-red" }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Affiliate Partners</h1>
          <p className="text-sm text-slate-500 mt-1">Live numbers from each affiliate's leads and rewards. Click a row to see its full details and leads.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0">
          <span className="flex items-center gap-2"><Plus size={16} /> Create Partner</span>
        </Button>
      </div>

      {successMessage && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <p className="flex-1">{successMessage}</p>
          <button type="button" onClick={() => setSuccessMessage("")} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {SUMMARY.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.tone}`}><s.icon size={16} /></span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{partners ? s.value : "—"}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* All affiliates, newest first */}
      {partners === null ? (
        <SkeletonTable />
      ) : all.length === 0 ? (
        <Card className="p-12 text-center">
          <Users size={28} className="mx-auto text-slate-300" />
          <p className="font-medium text-slate-700 mt-3">No affiliate partners yet</p>
          <p className="text-sm text-slate-400 mt-1">Create the first one, or share the partner sign-up page.</p>
        </Card>
      ) : (
        <PartnerTable partners={all} />
      )}

      {showCreate && (
        <CreatePartnerModal
          onClose={() => setShowCreate(false)}
          onCreated={(message) => { setShowCreate(false); setSuccessMessage(message); load(); }}
        />
      )}
    </div>
  );
}
