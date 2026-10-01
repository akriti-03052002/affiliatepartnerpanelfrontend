import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, History, CalendarClock, RefreshCw, Search, Info, CalendarX2, X, Landmark, Clock3, FileText, Upload } from "lucide-react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import { Select } from "../../components/ui/Input";

const STATUS_OPTIONS = ["draft", "pending_approval", "approved", "processing", "on_hold", "paid", "failed", "cancelled"];

const DURATIONS = [
  { key: "all", label: "All time", days: null },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 3 months", days: 90 },
  { key: "365d", label: "Last 1 year", days: 365 }
];

const money = (n, currency = "INR") =>
  `${currency === "INR" ? "₹" : currency + " "}${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const isToday = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const timeAgo = (date) => {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours > 1 ? "s" : ""} ago`;
};

const fetchSettlementDetails = (settlementId) => Promise.all([
  api.get(`/partner/settlements/${settlementId}`),
  api.get(`/partner/settlements/${settlementId}/bill`),
  api.get(`/partner/settlements/${settlementId}/history`)
]);

export default function Settlements() {
  const [settlements, setSettlements] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [duration, setDuration] = useState("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bill, setBill] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchSettlements = useCallback(() => api.get("/partner/settlements")
    .then((res) => {
      setSettlements(res.data.data);
      setMeta(res.data.meta || {});
      setLastFetchedAt(new Date());
    })
    .finally(() => setLoading(false)), []);

  const load = () => {
    setLoading(true);
    return fetchSettlements();
  };

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  useEffect(() => {
    if (!activeId) return undefined;

    let cancelled = false;
    fetchSettlementDetails(activeId).then(([detailResponse, billResponse, historyResponse]) => {
      if (cancelled) return;
      setDetail(detailResponse.data.data);
      setBill(billResponse.data.data);
      setHistory(historyResponse.data.data);
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeId]);

  const previousSettlement = useMemo(
    () => [...settlements].filter((s) => s.status === "paid").sort((a, b) => new Date(b.payment?.paidAt || 0) - new Date(a.payment?.paidAt || 0))[0],
    [settlements]
  );

  const todaysSettlement = useMemo(
    () => settlements.find((s) => isToday(s.payment?.paidAt)),
    [settlements]
  );

  const holdReason = useMemo(() => {
    if (!meta.availableBalance) return null;

    if (!meta.hasSettlementSetting) {
      return "On hold — your settlement schedule hasn't been set up yet. Contact SPOTX support.";
    }

    const parts = [];
    if (meta.pendingApprovalAmount) parts.push(`${money(meta.pendingApprovalAmount, meta.currency)} pending admin approval`);
    if (meta.approvedAwaitingBatchAmount) parts.push(`${money(meta.approvedAwaitingBatchAmount, meta.currency)} approved, awaiting the next settlement batch`);

    if (meta.settlementType === "threshold" && meta.minimumSettlementAmount > meta.availableBalance) {
      const remaining = meta.minimumSettlementAmount - meta.availableBalance;
      parts.push(`${money(remaining, meta.currency)} more needed to reach the ${money(meta.minimumSettlementAmount, meta.currency)} threshold`);
    }

    return parts.length ? parts.join(" · ") : null;
  }, [meta]);

  const upcomingAmount = useMemo(
    () => settlements
      .filter((s) => !["paid", "failed", "cancelled"].includes(s.status))
      .reduce((sum, s) => sum + (s.amount?.net || 0), 0),
    [settlements]
  );

  const nextSettlementInfo = useMemo(() => {
    if (meta.nextSettlementDate) {
      return { primary: money(upcomingAmount, meta.currency), secondary: `On ${new Date(meta.nextSettlementDate).toLocaleDateString()}`, footnote: "Final amount may vary" };
    }
    if (!meta.hasSettlementSetting) {
      return { primary: "Not configured", secondary: "Contact SPOTX support" };
    }
    if (meta.settlementType === "threshold") {
      return { primary: `Threshold ${money(meta.minimumSettlementAmount, meta.currency)}`, secondary: `${money(meta.availableBalance, meta.currency)} of ${money(meta.minimumSettlementAmount, meta.currency)} so far` };
    }
    if (meta.settlementType === "manual") {
      return { primary: "Manual payout", secondary: "Paid out by SPOTX admin on demand" };
    }
    return { primary: "No fixed schedule", secondary: "Threshold or manual payout" };
  }, [meta, upcomingAmount]);

  const filtered = useMemo(() => {
    const durationDef = DURATIONS.find((d) => d.key === duration);
    const cutoff = durationDef?.days && lastFetchedAt
      ? lastFetchedAt.getTime() - durationDef.days * 24 * 60 * 60 * 1000
      : null;
    const q = search.trim().toLowerCase();

    return settlements.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (cutoff && new Date(s.createdAt).getTime() < cutoff) return false;
      if (q && !(s.settlementNumber?.toLowerCase().includes(q) || s.payment?.transactionId?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [settlements, statusFilter, duration, search, lastFetchedAt]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Settlement Overview</h1>
        {lastFetchedAt && <span className="text-xs text-slate-400">{timeAgo(lastFetchedAt)}</span>}
        <button onClick={load} disabled={loading} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <OverviewItem
            icon={CheckCircle2}
            iconTone="bg-emerald-50 text-emerald-600"
            label="Previous settlement"
            primary={previousSettlement ? money(previousSettlement.amount.net, previousSettlement.amount.currency) : "No settlement"}
            secondary={previousSettlement?.payment?.paidAt ? new Date(previousSettlement.payment.paidAt).toLocaleDateString() : null}
          />
          <OverviewItem
            icon={History}
            iconTone="bg-emerald-50 text-emerald-600"
            label="Today's settlement"
            primary={todaysSettlement ? money(todaysSettlement.amount.net, todaysSettlement.amount.currency) : "No settlement"}
          />
          <OverviewItem
            icon={CalendarClock}
            iconTone="bg-slate-100 text-slate-500"
            label="Next settlement"
            primary={nextSettlementInfo.primary}
            secondary={nextSettlementInfo.secondary}
            footnote={nextSettlementInfo.footnote}
          />
          <div className="pt-4 lg:pt-0 lg:pl-6 lg:max-w-xs">
            <p className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4">Available balance</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{money(meta.availableBalance, meta.currency)}</p>
            {holdReason && (
              <p className="text-xs text-amber-700 mt-2 flex items-start gap-1.5">
                <Clock3 size={13} className="shrink-0 mt-0.5" />
                <span>{holdReason}</span>
              </p>
            )}
          </div>
        </div>
      </Card>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <FilterPill label="All" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {STATUS_OPTIONS.map((s) => (
              <FilterPill key={s} label={s.replace(/_/g, " ")} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-40">
              {DURATIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </Select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search settlement ID / UTR / cheque / receipt"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-3 w-72 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
              />
            </div>
          </div>
        </div>

        <Card>
          {loading ? (
            <p className="text-slate-400 text-sm p-6">Loading...</p>
          ) : (
            <Table
              empty={
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <CalendarX2 size={28} strokeWidth={1.5} />
                  <span>No settlements found</span>
                </div>
              }
              rows={filtered}
              columns={[
                { key: "createdOn", header: "Created On", render: (r) => new Date(r.createdAt).toLocaleDateString() },
                {
                  key: "number",
                  header: "Settlement ID",
                  render: (r) => (
                    <button onClick={() => { setDetailLoading(true); setActiveId(r._id); }} className="font-medium text-brand-red hover:underline">
                      {r.settlementNumber}
                    </button>
                  )
                },
                {
                  key: "utr",
                  header: (
                    <span className="inline-flex items-center gap-1">
                      UTR / Cheque / Receipt No. <span title="Online: UTR / transaction ID · Cheque: cheque number · Cash: receipt number"><Info size={12} className="text-slate-400" /></span>
                    </span>
                  ),
                  render: (r) => r.payment?.transactionId || "—"
                },
                { key: "net", header: "Net Settlement", render: (r) => <span className="font-semibold text-slate-900">{money(r.amount.net, r.amount.currency)}</span> },
                { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> }
              ]}
            />
          )}
        </Card>
      </div>

      {activeId && (
        <SettlementDetailPanel
          settlement={detail}
          bill={bill}
          history={history}
          onBillSubmitted={() => {
            if (activeId) {
              fetchSettlementDetails(activeId).then(([detailResponse, billResponse, historyResponse]) => {
                setDetail(detailResponse.data.data);
                setBill(billResponse.data.data);
                setHistory(historyResponse.data.data);
              });
            }
            load();
          }}
          loading={detailLoading}
          onClose={() => setActiveId(null)}
        />
      )}
    </div>
  );
}

// Only relevant for GST-registered partners — most partners will never
// see anything here since checkBillRequirement (backend) only holds a
// settlement over this in the first place if a verified GST document is
// on file. bill is null when none has been submitted yet.
function BillSection({ bill, canSubmitBill, settlementId, onBillSubmitted, currency }) {
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [gstin, setGstin] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!billNumber || !billDate || !gstin || !file) {
      setError("Bill number, bill date, GSTIN, and a file are all required.");
      return;
    }

    const formData = new FormData();
    formData.append("billNumber", billNumber);
    formData.append("billDate", billDate);
    formData.append("gstin", gstin);
    formData.append("file", file);

    try {
      setSubmitting(true);
      await api.post(`/partner/settlements/${settlementId}/bill`, formData, { headers: { "Content-Type": undefined } });
      setBillNumber(""); setBillDate(""); setGstin(""); setFile(null);
      onBillSubmitted();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong submitting the bill.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!bill && !canSubmitBill) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-400 mb-3">GST bill</p>

      {bill && (
        <div className="border border-slate-100 rounded-xl p-3 space-y-2 text-sm mb-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-600"><FileText size={14} className="text-slate-400" /> {bill.billNumber}</span>
            <Badge status={bill.status} />
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Total on bill</span><span className="text-slate-900">{money(bill.amount.totalBillAmount, currency)}</span></div>
          {bill.status === "rejected" && bill.rejectionReason && (
            <p className="text-xs text-red-600 pt-1">Rejected: {bill.rejectionReason}</p>
          )}
          {bill.status === "submitted" && (
            <p className="text-xs text-amber-700 pt-1">Awaiting SPOTX verification — your settlement stays on hold until then.</p>
          )}
        </div>
      )}

      {canSubmitBill && (
        <div className="border border-slate-100 rounded-xl p-3 space-y-2.5">
          <p className="text-xs text-slate-500">{bill?.status === "rejected" ? "Submit a corrected bill:" : "You're GST-registered — submit a bill to release this settlement:"}</p>
          <input
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            placeholder="Bill / invoice number"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
          />
          <input
            type="date"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
          />
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            placeholder="GSTIN"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
          />
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-brand-red rounded-xl py-2 disabled:opacity-50"
          >
            <Upload size={14} /> {submitting ? "Submitting..." : "Submit bill"}
          </button>
        </div>
      )}
    </div>
  );
}

function OverviewItem({ icon: Icon, iconTone, label, primary, secondary, footnote }) {
  return (
    <div className="pb-4 lg:pb-0 lg:pr-6 lg:first:pr-6">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconTone}`}>
        <Icon size={16} />
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {secondary && <p className="text-xs text-slate-400 mt-0.5">{secondary}</p>}
      <p className="text-xl font-bold text-slate-900 mt-2">{primary}</p>
      {footnote && <p className="text-xs text-slate-400 mt-0.5">{footnote}</p>}
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm capitalize transition ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

const HISTORY_ACTION_LABEL = {
  created: "Settlement batch created",
  approved: "Approved",
  held: "Put on hold",
  released: "Hold released",
  paid_offline: "Marked paid",
  paid_razorpay: "Marked paid",
  failed: "Payout failed",
  retried: "Payout retried",
  bill_submitted: "Bill submitted",
  bill_verified: "Bill verified",
  bill_rejected: "Bill rejected"
};

function SettlementHistoryTimeline({ history }) {
  if (!history || history.length === 0) {
    return <p className="text-sm text-slate-400">No history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {[...history].reverse().map((h) => (
        <div key={h._id} className="flex gap-3 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{HISTORY_ACTION_LABEL[h.action] || h.action}</span>
              <span className="text-xs text-slate-400 shrink-0">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
            {h.reason && <p className="text-slate-500 text-xs mt-0.5">{h.reason}</p>}
            {h.amount?.total > 0 && (
              <p className="text-slate-500 text-xs mt-0.5">{money(h.amount.total, h.amount.currency)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SettlementDetailPanel({ settlement, bill, history, onBillSubmitted, loading, onClose }) {
  const gstAmount = bill?.status === "verified" ? bill.amount.gstAmount : 0;
  const payable = settlement ? settlement.amount.net + gstAmount : 0;
  const canSubmitBill = settlement && !["paid", "cancelled"].includes(settlement.status) && (!bill || bill.status === "rejected");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <div className="relative w-full max-w-md h-full bg-white shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <p className="text-base font-semibold text-slate-900">Settlement details</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {loading || !settlement ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <div className="p-5 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Settlement ID</p>
                <p className="font-semibold text-slate-900">{settlement.settlementNumber}</p>
              </div>
              <Badge status={settlement.status} />
            </div>

            {/* Amount waterfall: gross -> deductions/TDS -> net, the
                same line-item breakdown Razorpay shows per settlement. */}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Amount breakdown</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Gross Amount</span><span className="text-slate-900">{money(settlement.amount.gross, settlement.amount.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Deductions</span><span className="text-red-600">- {money(settlement.amount.deductions, settlement.amount.currency)}</span></div>
                {settlement.tax?.tdsRate > 0 && (
                  <div className="flex justify-between pl-4"><span className="text-slate-400">TDS ({settlement.tax.tdsRate}%)</span><span className="text-slate-400">- {money(settlement.tax.tdsAmount, settlement.amount.currency)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-900 font-medium">Net Reward</span><span className="text-slate-900">{money(settlement.amount.net, settlement.amount.currency)}</span></div>
                {gstAmount > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">+ GST ({bill.amount.gstRatePercent}%)</span><span className="text-emerald-600">+ {money(gstAmount, settlement.amount.currency)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold"><span className="text-slate-900">Payable to You</span><span className="text-slate-900">{money(payable, settlement.amount.currency)}</span></div>
              </div>
            </div>

            <BillSection bill={bill} canSubmitBill={canSubmitBill} settlementId={settlement._id} onBillSubmitted={onBillSubmitted} currency={settlement.amount.currency} />

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Payment info</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="text-slate-900 capitalize">{settlement.payment?.method?.replace(/_/g, " ") || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">UTR / Cheque / Receipt No.</span><span className="text-slate-900">{settlement.payment?.transactionId || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Settled On</span><span className="text-slate-900">{settlement.payment?.paidAt ? new Date(settlement.payment.paidAt).toLocaleString() : "—"}</span></div>
              </div>
            </div>

            {settlement.status === "on_hold" && settlement.hold?.reason && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <span className="font-semibold">On hold:</span> {settlement.hold.reason}
              </div>
            )}

            {settlement.status === "failed" && settlement.failureReason && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {settlement.failureReason}
              </div>
            )}

            {settlement.commissionIds?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 mb-3">
                  Included transactions ({settlement.commissionIds.length})
                </p>
                <div className="space-y-2">
                  {settlement.commissionIds.map((c) => (
                    <div key={c._id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Landmark size={14} className="text-slate-400" />
                        {c.referralId?.customer?.companyName || "—"}
                      </div>
                      <span className="font-medium text-slate-900">{money(c.calculation?.netCommission, settlement.amount.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">History</p>
              <SettlementHistoryTimeline history={history} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
