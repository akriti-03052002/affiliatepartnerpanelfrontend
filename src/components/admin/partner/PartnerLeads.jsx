import { useEffect, useState } from "react";
import { Monitor, Phone, Mail, Trophy, XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import adminApi from "../../../services/adminApi";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";

const DEAL_STAGES = ["qualification", "demo", "proposal", "negotiation"];

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const screensOf = (l) => l.closure?.screenCount || l.deal?.expectedScreenCount || l.requirement?.screenCount || 0;

const STEPS = ["new", "contacted", "deal", "won"];
const STEP_LABEL = { new: "Lead", contacted: "Contacted", deal: "Deal", won: "Won" };

// Lead → Contacted → Deal → Won, with the current step highlighted.
function Progress({ lead }) {
  if (lead.status === "lost" || lead.status === "rejected") {
    return <Badge status={lead.status}>{lead.status === "lost" ? "Deal lost" : "Not a fit"}</Badge>;
  }
  const current = STEPS.indexOf(lead.status);
  return (
    <div className="flex items-center gap-1 text-[11px] font-semibold">
      {STEPS.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span className={`px-2 py-0.5 rounded-full ${
            i < current ? "bg-slate-100 text-slate-500" : i === current ? (s === "won" ? "bg-emerald-600 text-white" : "bg-brand-black text-white") : "text-slate-300"
          }`}>
            {s === "deal" && lead.status === "deal" ? `Deal · ${lead.deal?.stage}` : STEP_LABEL[s]}
          </span>
          {i < STEPS.length - 1 && <ArrowRight size={11} className="text-slate-300" />}
        </span>
      ))}
    </div>
  );
}

// Form shown inside a deal's card to close it as won and set the reward.
function WinForm({ lead, pricePerScreen, onCancel, onDone }) {
  const [form, setForm] = useState({
    dealValue: String(lead.estimatedValue || ""),
    screenCount: String(screensOf(lead) || ""),
    commissionAmount: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await adminApi.patch(`/admin/leads/${lead._id}/win`, {
        dealValue: Number(form.dealValue),
        screenCount: Number(form.screenCount) || 0,
        commissionAmount: Number(form.commissionAmount)
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't close this deal.");
      setBusy(false);
    }
  };

  const field = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <p className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Trophy size={16} className="text-emerald-600" /> Close deal as won</p>
      <p className="text-xs text-slate-500 mt-0.5">
        Estimated {screensOf(lead)} screens × {money(pricePerScreen)} = {money(lead.estimatedValue)}. The reward is paid to the affiliate once, for this deal only.
      </p>
      {error && <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <label className="text-xs font-medium text-slate-600">Final deal value (₹) *
          <input name="dealValue" type="number" min={1} value={form.dealValue} onChange={set} required className={`${field} mt-1`} />
        </label>
        <label className="text-xs font-medium text-slate-600">Screens
          <input name="screenCount" type="number" min={0} value={form.screenCount} onChange={set} className={`${field} mt-1`} />
        </label>
        <label className="text-xs font-semibold text-emerald-800">Reward for affiliate (₹) *
          <input name="commissionAmount" type="number" min={1} value={form.commissionAmount} onChange={set} required autoFocus className={`${field} mt-1 border-emerald-300`} />
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="!py-2">Cancel</Button>
        <Button type="submit" loading={busy} className="!py-2 !bg-emerald-600 hover:!bg-emerald-700">Confirm Won</Button>
      </div>
    </form>
  );
}

// All leads of one affiliate, with the admin actions to move each one along
// and set the reward when its deal is won.
export default function PartnerLeads({ partnerId, onChanged }) {
  const [leads, setLeads] = useState(null);
  const [pricePerScreen, setPricePerScreen] = useState(0);
  const [winning, setWinning] = useState(null); // lead id with the win form open

  const load = () => adminApi.get("/admin/leads", { params: { partnerId } })
    .then((res) => { setLeads(res.data.data); setPricePerScreen(res.data.pricePerScreen || 0); })
    .catch(() => setLeads([]));

  useEffect(() => { load(); }, [partnerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => { setWinning(null); load(); onChanged?.(); };

  const act = async (id, action, body = {}) => {
    try {
      await adminApi.patch(`/admin/leads/${id}/${action}`, body);
      refresh();
    } catch (err) {
      window.alert(err.response?.data?.message || "Something went wrong.");
    }
  };

  const closeWithReason = (id, action, question) => {
    const reason = window.prompt(question);
    if (reason !== null) act(id, action, { reason });
  };

  if (leads === null) return <Card className="p-6 text-sm text-slate-400">Loading leads...</Card>;

  if (leads.length === 0) {
    return (
      <Card className="p-10 text-center">
        <Monitor size={26} className="mx-auto text-slate-300" />
        <p className="font-medium text-slate-700 mt-3">No leads yet</p>
        <p className="text-sm text-slate-400 mt-1">Leads this affiliate generates will appear here.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((l) => (
        <Card key={l._id} className={`p-4 sm:p-5 ${l.status === "deal" ? "border-amber-200" : ""}`}>
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            {/* Who */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{l.customer.companyName}</p>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">
                  <Monitor size={12} /> {screensOf(l)} screens
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                {l.customer.contactName && <span>{l.customer.contactName}</span>}
                {l.customer.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{l.customer.phone}</span>}
                {l.customer.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{l.customer.email}</span>}
                <span className="text-slate-400">Generated {new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-3"><Progress lead={l} /></div>
              {l.closure?.reason && <p className="text-xs text-slate-500 mt-2">Reason: {l.closure.reason}</p>}
              {l.requirement?.notes && <p className="text-xs text-slate-400 mt-1">Note: {l.requirement.notes}</p>}
            </div>

            {/* Money */}
            <div className="lg:w-44 lg:text-right shrink-0">
              {l.status === "won" ? (
                <>
                  <p className="text-xs text-slate-400">Deal value</p>
                  <p className="font-semibold text-slate-900">{money(l.closure.dealValue)}</p>
                  <p className="text-xs text-slate-400 mt-1.5">Reward</p>
                  <p className="font-bold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={14} />{money(l.closure.commissionAmount)}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-400">Estimated value</p>
                  <p className="font-semibold text-slate-700">{l.estimatedValue ? `~${money(l.estimatedValue)}` : "—"}</p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="lg:w-56 shrink-0 flex flex-wrap lg:flex-col gap-2">
              {(l.status === "new" || l.status === "contacted") && (
                <>
                  <Button onClick={() => act(l._id, "deal")} className="!py-2 w-full">Convert to Deal</Button>
                  {l.status === "new" && <Button variant="outline" onClick={() => act(l._id, "contacted")} className="!py-2 w-full">Mark Contacted</Button>}
                  <button type="button" onClick={() => closeWithReason(l._id, "reject", "Why is this lead not a fit? (shown to the affiliate)")} className="text-xs font-semibold text-brand-red hover:underline inline-flex items-center gap-1 justify-center py-1">
                    <XCircle size={13} /> Reject lead
                  </button>
                </>
              )}
              {l.status === "deal" && winning !== l._id && (
                <>
                  <Button onClick={() => setWinning(l._id)} className="!py-2 w-full !bg-emerald-600 hover:!bg-emerald-700">
                    <span className="inline-flex items-center gap-1.5"><Trophy size={15} /> Won — add reward</span>
                  </Button>
                  <select
                    value={l.deal?.stage || "qualification"}
                    onChange={(e) => act(l._id, "stage", { stage: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white capitalize"
                    aria-label="Deal stage"
                  >
                    {DEAL_STAGES.map((s) => <option key={s} value={s}>Stage: {s}</option>)}
                  </select>
                  <button type="button" onClick={() => closeWithReason(l._id, "lose", "Why was this deal lost? (shown to the affiliate)")} className="text-xs font-semibold text-brand-red hover:underline inline-flex items-center gap-1 justify-center py-1">
                    <XCircle size={13} /> Mark deal lost
                  </button>
                </>
              )}
              {["won", "lost", "rejected"].includes(l.status) && (
                <p className="text-xs text-slate-400 lg:text-right">Closed {l.closure?.closedAt ? new Date(l.closure.closedAt).toLocaleDateString() : ""}</p>
              )}
            </div>
          </div>

          {winning === l._id && (
            <WinForm lead={l} pricePerScreen={pricePerScreen} onCancel={() => setWinning(null)} onDone={refresh} />
          )}
        </Card>
      ))}
    </div>
  );
}
