import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, History, Landmark, RefreshCw, Search, Info, CalendarX2, X, Plus, Clock3, FileText, Download, FolderOpen } from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import { Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";

const STATUS_OPTIONS = ["draft", "pending_approval", "approved", "processing", "on_hold", "paid", "failed", "cancelled"];
const OWED_STATUSES = ["draft", "pending_approval", "approved", "processing", "on_hold"];
const HOLDABLE_STATUSES = ["draft", "pending_approval", "approved", "processing"];

// Settlement cycle, Razorpay-style: how often this partner's payouts run,
// not a per-transaction T+N promise — see SettlementSetting.settlementType.
const CYCLE_LABEL = {
  monthly: "Monthly cycle",
  quarterly: "Quarterly cycle",
  threshold: "Threshold-based",
  manual: "Manual"
};

const maskedAccount = (bankAccount) =>
  bankAccount ? `${bankAccount.bankName} •••• ${bankAccount.accountNumberLast4}` : "—";

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

export default function AdminSettlements() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [duration, setDuration] = useState("all");
  const [search, setSearch] = useState("");
  const [affiliateFilter, setAffiliateFilter] = useState("");
  const [affiliates, setAffiliates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bill, setBill] = useState(null);
  const [billActionError, setBillActionError] = useState("");
  const [history, setHistory] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [approvedCommissions, setApprovedCommissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // { settlementId, paymentId, fetching, payment, error, submitting }
  const [payModal, setPayModal] = useState(null);
  // { mode: "hold" | "fail", settlementId, reason, submitting, error }
  const [reasonModal, setReasonModal] = useState(null);

  const load = () => {
    setLoading(true);
    return adminApi.get("/admin/settlements", { params: { partnerId: affiliateFilter || undefined } })
      .then((res) => { setSettlements(res.data.data); setLastFetchedAt(new Date()); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [affiliateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    adminApi.get("/admin/partners", { params: { partnerType: "affiliate" } }).then((res) => setAffiliates(res.data.data));
  }, []);

  useEffect(() => {
    if (showCreate) adminApi.get("/admin/partners", { params: { status: "active" } }).then((res) => setPartners(res.data.data));
  }, [showCreate]);

  useEffect(() => {
    if (partnerId) {
      adminApi.get("/admin/commissions", { params: { status: "approved", partnerId } })
        .then((res) => { setApprovedCommissions(res.data.data); setSelectedIds([]); });
    }
  }, [partnerId]);

  const loadBill = (id) => adminApi.get(`/admin/settlements/${id}/bill`).then((res) => setBill(res.data.data));

  useEffect(() => {
    if (!activeId) { setDetail(null); setBill(null); setHistory([]); return; }
    setDetailLoading(true);
    setBillActionError("");
    Promise.all([
      adminApi.get(`/admin/settlements/${activeId}`).then((res) => setDetail(res.data.data)),
      loadBill(activeId),
      adminApi.get(`/admin/settlements/${activeId}/history`).then((res) => setHistory(res.data.data))
    ]).finally(() => setDetailLoading(false));
  }, [activeId]);

  const verifyBillAction = async (status) => {
    setBillActionError("");
    const rejectionReason = status === "rejected" ? window.prompt("Reason for rejecting this bill:") : undefined;
    if (status === "rejected" && rejectionReason === null) return;
    try {
      await adminApi.patch(`/admin/settlements/${activeId}/bill/verify`, { status, rejectionReason });
      await Promise.all([loadBill(activeId), adminApi.get(`/admin/settlements/${activeId}`).then((res) => setDetail(res.data.data))]);
      load();
    } catch (err) {
      setBillActionError(err.response?.data?.message || "Something went wrong verifying the bill.");
    }
  };

  const previousPayout = useMemo(
    () => [...settlements].filter((s) => s.status === "paid").sort((a, b) => new Date(b.payment?.paidAt || 0) - new Date(a.payment?.paidAt || 0))[0],
    [settlements]
  );

  const todaysPayoutTotal = useMemo(
    () => settlements.filter((s) => isToday(s.payment?.paidAt)).reduce((sum, s) => sum + (s.amount?.net || 0), 0),
    [settlements]
  );

  const pendingApproval = useMemo(() => {
    const rows = settlements.filter((s) => ["draft", "pending_approval"].includes(s.status));
    return { count: rows.length, amount: rows.reduce((sum, s) => sum + (s.amount?.net || 0), 0) };
  }, [settlements]);

  const totalOwed = useMemo(
    () => settlements.filter((s) => OWED_STATUSES.includes(s.status)).reduce((sum, s) => sum + (s.amount?.net || 0), 0),
    [settlements]
  );

  const filtered = useMemo(() => {
    const durationDef = DURATIONS.find((d) => d.key === duration);
    const cutoff = durationDef?.days ? Date.now() - durationDef.days * 24 * 60 * 60 * 1000 : null;
    const q = search.trim().toLowerCase();

    return settlements.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (cutoff && new Date(s.createdAt).getTime() < cutoff) return false;
      if (q && !(s.settlementNumber?.toLowerCase().includes(q) || s.payment?.transactionId?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [settlements, statusFilter, duration, search]);

  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const createBatch = async () => {
    setError("");
    if (selectedIds.length === 0) { setError("Select at least one approved reward."); return; }
    setCreating(true);

    try {
      await adminApi.post("/admin/settlements", { partnerId, commissionIds: selectedIds });
      setShowCreate(false);
      setPartnerId("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong creating the settlement.");
    } finally {
      setCreating(false);
    }
  };

  const approve = async (id) => {
    await adminApi.patch(`/admin/settlements/${id}/approve`);
    load();
  };

  // Pay a settlement: offline (cash / cheque) or online (paid through
  // RazorpayX to the account shown, then the transaction ID is checked
  // against RazorpayX before anything is marked paid).
  const openMarkPaid = (id) => {
    setPayModal({
      settlementId: id, tab: "offline",
      details: null, detailsError: "",
      offlineMethod: "cash", referenceNumber: "", note: "",
      transactionId: "", checking: false, check: null,
      error: "", submitting: false
    });
    adminApi.get(`/admin/settlements/${id}/payout-details`)
      .then((res) => setPayModal((m) => (m && m.settlementId === id ? { ...m, details: res.data.data } : m)))
      .catch((err) => setPayModal((m) => (m ? { ...m, detailsError: err.response?.data?.message || "Couldn't load payment details." } : m)));
  };

  const checkOnlinePayment = async () => {
    const transactionId = payModal.transactionId.trim();
    if (!transactionId) return;
    setPayModal((m) => ({ ...m, checking: true, error: "", check: null }));
    try {
      const res = await adminApi.get(`/admin/settlements/${payModal.settlementId}/online-check`, { params: { transactionId } });
      setPayModal((m) => ({ ...m, checking: false, check: res.data.data }));
    } catch (err) {
      setPayModal((m) => ({ ...m, checking: false, error: err.response?.data?.message || "Couldn't check this transaction." }));
    }
  };

  const confirmMarkPaid = async () => {
    setPayModal((m) => ({ ...m, submitting: true, error: "" }));
    try {
      await adminApi.patch(`/admin/settlements/${payModal.settlementId}/mark-paid`, { transactionId: payModal.transactionId.trim() });
      setPayModal(null);
      load();
    } catch (err) {
      setPayModal((m) => ({ ...m, submitting: false, error: err.response?.data?.message || "Couldn't mark this settlement paid." }));
    }
  };

  const confirmMarkPaidOffline = async () => {
    if (payModal.offlineMethod === "cheque" && !payModal.referenceNumber.trim()) {
      setPayModal((m) => ({ ...m, error: "Enter the cheque number." }));
      return;
    }
    setPayModal((m) => ({ ...m, submitting: true, error: "" }));
    try {
      await adminApi.patch(`/admin/settlements/${payModal.settlementId}/mark-paid-offline`, {
        method: payModal.offlineMethod,
        referenceNumber: payModal.referenceNumber.trim(),
        note: payModal.note.trim() || undefined
      });
      setPayModal(null);
      load();
    } catch (err) {
      setPayModal((m) => ({ ...m, submitting: false, error: err.response?.data?.message || "Couldn't mark this settlement paid." }));
    }
  };

  // window.prompt() used to be used here — swapped for a real modal since
  // native dialogs silently do nothing in browsers/extensions that block
  // them, and the old code had no error handling either, so any backend
  // rejection (e.g. wrong status) failed completely silently too.
  const openReasonModal = (mode, id) => setReasonModal({ mode, settlementId: id, reason: "", submitting: false, error: "" });

  const submitReasonModal = async () => {
    setReasonModal((m) => ({ ...m, submitting: true, error: "" }));
    try {
      const path = reasonModal.mode === "hold" ? "hold" : "fail";
      await adminApi.patch(`/admin/settlements/${reasonModal.settlementId}/${path}`, { reason: reasonModal.reason });
      setReasonModal(null);
      load();
    } catch (err) {
      setReasonModal((m) => ({ ...m, submitting: false, error: err.response?.data?.message || `Couldn't ${reasonModal.mode === "hold" ? "hold" : "fail"} this settlement.` }));
    }
  };

  const releaseSettlement = async (id) => {
    try {
      await adminApi.patch(`/admin/settlements/${id}/release`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Couldn't release this hold.");
    }
  };

  const retrySettlement = async (id) => {
    await adminApi.patch(`/admin/settlements/${id}/retry`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Settlements</h1>
          {lastFetchedAt && <span className="text-xs text-slate-400">{timeAgo(lastFetchedAt)}</span>}
          <button onClick={load} disabled={loading} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <span className="flex items-center gap-2"><Plus size={16} /> New Settlement Batch</span>
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <OverviewItem
            icon={CheckCircle2}
            iconTone="bg-emerald-50 text-emerald-600"
            label="Previous Payout"
            primary={previousPayout ? money(previousPayout.amount.net, previousPayout.amount.currency) : "No payout yet"}
            secondary={previousPayout?.payment?.paidAt ? new Date(previousPayout.payment.paidAt).toLocaleDateString() : null}
          />
          <OverviewItem
            icon={History}
            iconTone="bg-emerald-50 text-emerald-600"
            label="Today's Payouts"
            primary={money(todaysPayoutTotal)}
          />
          <OverviewItem
            icon={Info}
            iconTone="bg-amber-50 text-amber-600"
            label="Awaiting Approval"
            primary={`${pendingApproval.count} batch${pendingApproval.count === 1 ? "" : "es"}`}
            secondary={money(pendingApproval.amount)}
          />
          <div className="pt-4 lg:pt-0 lg:pl-6">
            <p className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4">Total Owed to Partners</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{money(totalOwed)}</p>
          </div>
        </div>
      </Card>

      {showCreate && (
        <Card className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          <Select label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Select a partner</option>
            {partners.map((p) => <option key={p._id} value={p._id}>{p.legalEntity.businessName || `${p.partnerCode} (incomplete profile)`}</option>)}
          </Select>

          {partnerId && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Approved rewards available</p>
              {approvedCommissions.length === 0 ? (
                <p className="text-sm text-slate-400">No approved rewards for this partner.</p>
              ) : (
                <div className="space-y-2">
                  {approvedCommissions.map((c) => (
                    <label key={c._id} className="flex items-center gap-3 text-sm border border-slate-100 rounded-xl p-3">
                      <input type="checkbox" checked={selectedIds.includes(c._id)} onChange={() => toggleSelect(c._id)} />
                      ₹{c.calculation.netCommission.toLocaleString()} — earned {new Date(c.createdAt).toLocaleDateString()}
                    </label>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <Button onClick={createBatch} loading={creating}>Create Batch</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <FilterPill label="All" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {STATUS_OPTIONS.map((s) => (
              <FilterPill key={s} label={s.replace(/_/g, " ")} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select value={affiliateFilter} onChange={(e) => setAffiliateFilter(e.target.value)} className="w-56">
              <option value="">All affiliates</option>
              {affiliates.map((affiliate) => (
                <option key={affiliate._id} value={affiliate._id}>{affiliate.legalEntity.businessName} ({affiliate.partnerCode})</option>
              ))}
            </Select>
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
                { key: "createdOn", header: "Created On", render: (s) => new Date(s.createdAt).toLocaleDateString() },
                {
                  key: "number",
                  header: "Settlement ID",
                  render: (s) => (
                    <button onClick={() => setActiveId(s._id)} className="font-medium text-brand-red hover:underline">
                      {s.settlementNumber}
                    </button>
                  )
                },
                {
                  key: "partner",
                  header: "Partner",
                  render: (s) => (
                    <div className="flex flex-col gap-0.5">
                      <span>{s.partnerId?.legalEntity?.businessName || s.partnerId?.partnerCode || "—"}</span>
                      {s.partnerId?._id && (
                        <Link
                          to={`/admin/partners/${s.partnerId._id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                        >
                          <FolderOpen size={12} /> View documents
                        </Link>
                      )}
                    </div>
                  )
                },
                {
                  key: "cycle",
                  header: "Cycle",
                  render: (s) => (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Clock3 size={12} className="text-slate-400" /> {CYCLE_LABEL[s.settlementType] || s.settlementType}
                    </span>
                  )
                },
                {
                  key: "bankAccount",
                  header: "Bank Account",
                  render: (s) => <span className="text-slate-600">{maskedAccount(s.bankAccount)}</span>
                },
                {
                  key: "utr",
                  header: (
                    <span className="inline-flex items-center gap-1">
                      UTR / Cheque / Receipt No. <span title="Online: UTR / transaction ID · Cheque: cheque number · Cash: receipt number"><Info size={12} className="text-slate-400" /></span>
                    </span>
                  ),
                  render: (s) => s.payment?.transactionId || "—"
                },
                {
                  key: "net",
                  header: "Net Settlement",
                  render: (s) => (
                    <div>
                      <span className="font-semibold text-slate-900">{money(s.amount.net, s.amount.currency)}</span>
                      {s.amount.deductions > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {money(s.amount.gross, s.amount.currency)} − {money(s.amount.deductions, s.amount.currency)} fees/tax
                        </p>
                      )}
                    </div>
                  )
                },
                {
                  key: "bill",
                  header: "Bill",
                  render: (s) => s.bill ? (
                    <div className="flex flex-col gap-1 items-start">
                      <Badge status={s.bill.status} />
                      <BillDownloadButton settlementId={s._id} originalName={s.bill.file?.originalName} />
                    </div>
                  ) : ["approved", "on_hold", "failed"].includes(s.status) ? (
                    <span className="text-amber-600 text-xs font-medium">Awaiting bill</span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )
                },
                { key: "status", header: "Status", render: (s) => <Badge status={s.status} /> },
                {
                  key: "actions",
                  header: "",
                  render: (s) => (
                    <div className="flex gap-3">
                      {["draft", "pending_approval"].includes(s.status) && (
                        <button onClick={() => approve(s._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
                      )}
                      {/* Approved → affiliate uploads bill → admin verifies → Pay. */}
                      {s.status === "approved" && (
                        <>
                          {s.bill?.status === "verified" ? (
                            <button onClick={() => openMarkPaid(s._id)} className="text-xs font-semibold text-brand-red hover:underline">Pay</button>
                          ) : s.bill?.status === "submitted" ? (
                            <button onClick={() => setActiveId(s._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Review bill</button>
                          ) : (
                            <span className="text-xs text-slate-400" title="The affiliate needs to upload a bill (or a corrected one) before this can be paid.">Pay after bill</span>
                          )}
                          <button onClick={() => openReasonModal("fail", s._id)} className="text-xs font-semibold text-red-600 hover:underline">Mark Failed</button>
                        </>
                      )}
                      {s.status === "failed" && (
                        <button onClick={() => retrySettlement(s._id)} className="text-xs font-semibold text-amber-600 hover:underline">Retry</button>
                      )}
                      {HOLDABLE_STATUSES.includes(s.status) && (
                        <button onClick={() => openReasonModal("hold", s._id)} className="text-xs font-semibold text-slate-500 hover:underline">Hold</button>
                      )}
                      {s.status === "on_hold" && (
                        <button onClick={() => releaseSettlement(s._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Release</button>
                      )}
                    </div>
                  )
                }
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
          billActionError={billActionError}
          onVerifyBill={verifyBillAction}
          loading={detailLoading}
          onClose={() => setActiveId(null)}
        />
      )}

      {payModal && (
        <MarkPaidModal
          state={payModal}
          setState={setPayModal}
          onCheck={checkOnlinePayment}
          onConfirmOnline={confirmMarkPaid}
          onConfirmOffline={confirmMarkPaidOffline}
          onClose={() => setPayModal(null)}
        />
      )}

      {reasonModal && (
        <ReasonModal
          state={reasonModal}
          setState={setReasonModal}
          onConfirm={submitReasonModal}
          onClose={() => setReasonModal(null)}
        />
      )}
    </div>
  );
}

// Real modal instead of window.prompt() — native browser dialogs are
// increasingly blocked by browsers/extensions (silently return null, no
// visible failure), and the old code had no error handling either, so any
// backend rejection (wrong status, etc) failed completely invisibly too.
function ReasonModal({ state, setState, onConfirm, onClose }) {
  const isHold = state.mode === "hold";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-slate-900">{isHold ? "Hold settlement" : "Mark payout failed"}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
          <textarea
            autoFocus
            rows={3}
            value={state.reason}
            onChange={(e) => setState((m) => ({ ...m, reason: e.target.value }))}
            placeholder={isHold ? "Why is this settlement being held?" : "Why did the payout fail?"}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm resize-none"
          />
        </div>

        {state.error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{state.error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={onConfirm} loading={state.submitting}>
            {isHold ? "Put on Hold" : "Mark Failed"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OverviewItem({ icon: Icon, iconTone, label, primary, secondary }) {
  return (
    <div className="pb-4 lg:pb-0 lg:pr-6 lg:first:pr-6">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconTone}`}>
        <Icon size={16} />
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {secondary && <p className="text-xs text-slate-400 mt-0.5">{secondary}</p>}
      <p className="text-xl font-bold text-slate-900 mt-2">{primary}</p>
    </div>
  );
}

function BillDownloadButton({ settlementId, originalName }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const res = await adminApi.get(`/admin/settlements/${settlementId}/bill/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = originalName || "bill";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Couldn't download this bill.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline disabled:opacity-50">
      <Download size={12} /> {downloading ? "Downloading..." : "Download bill"}
    </button>
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
  paid_offline: "Marked paid (offline)",
  paid_razorpay: "Marked paid (Razorpay verified)",
  failed: "Marked failed",
  retried: "Moved back to approved for retry",
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
            <p className="text-slate-400 text-xs mt-0.5 capitalize">{h.performedByType.replace(/_/g, " ")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettlementDetailPanel({ settlement, bill, history, billActionError, onVerifyBill, loading, onClose }) {
  const gstAmount = bill?.status === "verified" ? bill.amount.gstAmount : 0;
  const payable = settlement ? settlement.amount.net + gstAmount : 0;
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
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock3 size={12} className="text-slate-400" /> {CYCLE_LABEL[settlement.settlementType] || settlement.settlementType}
                </span>
                <Badge status={settlement.status} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Landmark size={14} className="text-slate-400 shrink-0" />
                <span className="text-slate-600 truncate">{settlement.partnerId?.legalEntity?.businessName || settlement.partnerId?.partnerCode || "—"}</span>
              </div>
              {settlement.partnerId?._id && (
                <Link
                  to={`/admin/partners/${settlement.partnerId._id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline shrink-0"
                >
                  <FolderOpen size={12} /> View documents
                </Link>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Amount breakdown</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Gross Amount</span><span className="text-slate-900">{money(settlement.amount.gross, settlement.amount.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Fees &amp; Tax Deductions</span><span className="text-red-600">- {money(settlement.amount.deductions, settlement.amount.currency)}</span></div>
                {settlement.tax?.tdsRate > 0 && (
                  <div className="flex justify-between pl-4"><span className="text-slate-400">TDS ({settlement.tax.tdsRate}%)</span><span className="text-slate-400">- {money(settlement.tax.tdsAmount, settlement.amount.currency)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-900 font-medium">Net Reward</span><span className="text-slate-900">{money(settlement.amount.net, settlement.amount.currency)}</span></div>
                {gstAmount > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">+ GST ({bill.amount.gstRatePercent}%, per verified bill)</span><span className="text-emerald-600">+ {money(gstAmount, settlement.amount.currency)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold"><span className="text-slate-900">Payable to Partner</span><span className="text-slate-900">{money(payable, settlement.amount.currency)}</span></div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Bill</p>
              {!bill ? (
                <p className="text-sm text-slate-400">
                  {["draft", "pending_approval"].includes(settlement.status)
                    ? "The affiliate can upload a bill once this settlement is approved."
                    : "No bill submitted yet. This settlement can be paid once the affiliate uploads a bill and it's verified."}
                </p>
              ) : (
                <div className="border border-slate-100 rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 min-w-0">
                      <FileText size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{bill.file?.originalName || "Bill"}</span>
                    </span>
                    <Badge status={bill.status} />
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">Uploaded</span><span className="text-slate-900">{new Date(bill.updatedAt || bill.createdAt).toLocaleString()}</span></div>
                  {/* What the uploaded bill should add up to — check it against the document. */}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bill should total{bill.amount.gstAmount > 0 ? ` (incl. ${bill.amount.gstRatePercent}% GST)` : ""}</span>
                    <span className="text-slate-900">{money(bill.amount.totalBillAmount, settlement.amount.currency)}</span>
                  </div>
                  <BillDownloadButton settlementId={settlement._id} originalName={bill.file.originalName} />
                  {bill.status === "rejected" && bill.rejectionReason && (
                    <p className="text-xs text-red-600 pt-1">Rejected: {bill.rejectionReason}</p>
                  )}
                  {billActionError && <p className="text-xs text-red-600">{billActionError}</p>}
                  {bill.status === "submitted" && (
                    <div className="pt-1 space-y-2">
                      <p className="text-xs text-slate-500">Check the bill file and amount, then verify it to enable payment.</p>
                      <div className="flex gap-2">
                        <button onClick={() => onVerifyBill("verified")} className="text-xs font-semibold text-white bg-emerald-600 rounded-lg px-3 py-1.5 hover:bg-emerald-700 transition">Verify bill</button>
                        <button onClick={() => onVerifyBill("rejected")} className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition">Reject</button>
                      </div>
                    </div>
                  )}
                  {bill.status === "verified" && settlement.status === "approved" && (
                    <p className="text-xs text-emerald-700 pt-1">Verified — ready to pay.</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Payout account</p>
              {settlement.bankAccount ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="text-slate-900">{settlement.bankAccount.bankName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Account</span><span className="text-slate-900">•••• {settlement.bankAccount.accountNumberLast4}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">IFSC</span><span className="text-slate-900">{settlement.bankAccount.ifscMasked || "—"}</span></div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No bank account on file for this partner.</p>
              )}
            </div>

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

const PAY_TABS = [
  { key: "offline", label: "Offline" },
  { key: "online", label: "Online" }
];

const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm";

function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {}); }}
      className="text-xs font-semibold text-brand-red hover:underline shrink-0"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Pay a settlement, one of two ways:
// - Offline: paid in cash or by cheque — recorded on the admin's word.
// - Online: pay the partner through RazorpayX to the account shown here,
//   then enter the payout's transaction ID. It's checked against RazorpayX
//   (processed, right amount, this partner's account number) before the
//   settlement can be marked paid.
function MarkPaidModal({ state, setState, onCheck, onConfirmOnline, onConfirmOffline, onClose }) {
  const setTab = (tab) => setState((m) => ({ ...m, tab, error: "" }));
  const bank = state.details?.bank;
  const payable = state.details?.payable;
  const checkRow = (ok, label) => (
    <li className={`flex items-center gap-2 ${ok ? "text-emerald-700" : "text-red-700"}`}>
      <span className="font-bold">{ok ? "✓" : "✕"}</span>{label}
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-slate-900">Pay settlement</p>
            {state.details && <p className="text-xs text-slate-400">{state.details.settlementNumber}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">Amount to pay</p>
          <p className="text-2xl font-bold text-slate-900">{payable ? money(payable.total) : "…"}</p>
          {payable?.gst > 0 && <p className="text-xs text-slate-400">Reward {money(payable.net)} + GST {money(payable.gst)}</p>}
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {PAY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-sm font-semibold py-2 rounded-lg transition ${state.tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {state.error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{state.error}</div>}

        {state.tab === "offline" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Paid by</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ key: "cash", label: "Cash" }, { key: "cheque", label: "Cheque" }].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setState((m) => ({ ...m, offlineMethod: o.key, error: "" }))}
                    className={`py-2.5 rounded-xl border text-sm font-semibold transition ${state.offlineMethod === o.key ? "border-brand-black bg-brand-black text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {state.offlineMethod === "cheque" ? "Cheque number *" : "Receipt number (optional)"}
              </label>
              <input
                value={state.referenceNumber}
                onChange={(e) => setState((m) => ({ ...m, referenceNumber: e.target.value }))}
                placeholder={state.offlineMethod === "cheque" ? "e.g. 000123" : "e.g. cash receipt no."}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Note (optional)</label>
              <input value={state.note} onChange={(e) => setState((m) => ({ ...m, note: e.target.value }))} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={onConfirmOffline} loading={state.submitting}>Mark Paid</Button>
            </div>
          </div>
        )}

        {state.tab === "online" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1.5">1. Pay to this account</p>
              {state.detailsError ? (
                <p className="text-sm text-red-600">{state.detailsError}</p>
              ) : !state.details ? (
                <p className="text-sm text-slate-400">Loading bank details…</p>
              ) : !bank ? (
                <p className="text-sm text-red-600">This partner has no bank account on file.</p>
              ) : (
                <dl className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-sm">
                  {[
                    ["Account holder", bank.accountHolderName],
                    ["Bank", bank.bankName],
                    ["Account number", bank.accountNumber],
                    ["IFSC", bank.ifsc]
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="flex items-center gap-3 min-w-0">
                        <span className="font-semibold text-slate-900 truncate">{value}</span>
                        {(label === "Account number" || label === "IFSC") && <CopyValue value={value} />}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-1.5">2. Enter the transaction ID</p>
              <div className="flex gap-2">
                <input
                  value={state.transactionId}
                  onChange={(e) => setState((m) => ({ ...m, transactionId: e.target.value, check: null, error: "" }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCheck(); } }}
                  placeholder="pout_xxxxxxxxxxxxxx"
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <Button type="button" onClick={onCheck} loading={state.checking} disabled={!state.transactionId.trim()} className="shrink-0 !px-3 !py-2">Check</Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">The RazorpayX payout ID. It's checked against RazorpayX before anything is marked paid.</p>
            </div>

            {state.check && (
              <div className={`rounded-xl border p-3 text-sm space-y-2 ${state.check.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <ul className="space-y-1">
                  {checkRow(state.check.checks.processed, `Payment status: ${state.check.payout.status}`)}
                  {checkRow(state.check.checks.amountMatches, `Amount: ${money(state.check.payout.amount)} (payable ${money(state.check.payout.expectedAmount)})`)}
                  {checkRow(state.check.checks.accountMatches && state.check.checks.ifscMatches, `Paid to account ending ${state.check.payout.paidToAccountLast4 || "?"}${state.check.payout.paidToIfsc ? ` · ${state.check.payout.paidToIfsc}` : ""}`)}
                </ul>
                {state.check.payout.utr && <p className="text-xs text-slate-500">UTR: {state.check.payout.utr}</p>}
                <p className={`text-xs font-semibold ${state.check.ok ? "text-emerald-700" : "text-red-700"}`}>
                  {state.check.ok ? "Payment verified — you can mark this settlement paid." : "This transaction doesn't match this settlement."}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={onConfirmOnline} loading={state.submitting} disabled={!state.check?.ok}>Mark Paid</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
