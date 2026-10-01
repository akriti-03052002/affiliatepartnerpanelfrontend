import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Copy, Check, Mail, Phone, MapPin, CalendarDays } from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import PartnerProfileForm from "../../components/admin/partner/PartnerProfileForm";
import PartnerKycBank from "../../components/admin/partner/PartnerKycBank";
import PartnerTeam from "../../components/admin/partner/PartnerTeam";
import PartnerPayoutSettings from "../../components/admin/partner/PartnerPayoutSettings";
import PartnerRecords from "../../components/admin/partner/PartnerRecords";
import { PARTNER_SECTIONS, partnerSectionPath } from "../../components/admin/partner/partnerSections";

const STATUS_OPTIONS = ["draft", "pending_verification", "under_review", "active", "suspended", "rejected", "inactive"];

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "A";

const actorLabel = (type) => ({ spotx_user: "SPOTX", partner_user: "Affiliate" }[type] || "System");

// One affiliate partner: a header card (identity, status, totals), a tab bar,
// and the selected section below it at full width. The section comes from the
// URL (/admin/partners/:id/:section).
export default function AdminPartnerDetail() {
  const { id, section: sectionParam } = useParams();
  const [searchParams] = useSearchParams();
  const section = PARTNER_SECTIONS.find((s) => s.key === (sectionParam || "details"));
  const legacyTab = searchParams.get("tab");

  const [data, setData] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => adminApi.get(`/admin/partners/${id}`).then((res) => {
    setData(res.data.data);
    setSelectedStatus(res.data.data.partner.status);
  });

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyStatus = async () => {
    let rejectionReason;
    if (selectedStatus === "rejected") {
      rejectionReason = window.prompt("Reason for rejecting this partner? This will be shown to them and sent as a notification.");
      if (rejectionReason === null) return;
      if (!rejectionReason.trim()) {
        window.alert("A reason is required to reject a partner.");
        return;
      }
    }
    setBusy(true);
    try {
      await adminApi.patch(`/admin/partners/${id}/status`, { status: selectedStatus, rejectionReason });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copyReferral = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy the referral link:", text);
    }
  };

  // Old ?tab= links and unknown sections land on the matching (or default) section.
  if (legacyTab && PARTNER_SECTIONS.some((s) => s.key === legacyTab)) return <Navigate to={partnerSectionPath(id, legacyTab)} replace />;
  if (!section) return <Navigate to={partnerSectionPath(id, "details")} replace />;
  const tab = section.key;

  if (!data) return <p className="text-slate-400 text-sm">Loading...</p>;

  const { partner, documents, requiredDocumentTypes, bankAccount, team, settlementSetting, activity } = data;
  const stats = partner.stats || {};
  const name = partner.legalEntity.businessName || partner.primaryContact.name;
  const location = [partner.address?.city, partner.address?.state].filter(Boolean).join(", ");
  const referralText = partner.referral?.referralLink || partner.referral?.referralCode;

  const STATS = [
    { label: "Leads generated", value: stats.totalLeads || 0 },
    { label: "Deals won", value: stats.wonDeals || 0 },
    { label: "Deal value", value: money(stats.totalRevenue) },
    { label: "Rewards pending", value: money(stats.pendingCommission) },
    { label: "Rewards paid", value: money(stats.paidCommission) }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link to="/admin/partners" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Affiliate Partners
      </Link>

      {/* Header: identity + status + totals */}
      <Card className="overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-black text-white flex items-center justify-center text-lg font-bold shrink-0">
            {initials(name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                {partner.legalEntity.businessName || <span className="text-slate-400 italic font-semibold">Incomplete profile</span>}
              </h1>
              <Badge status={partner.status} />
              {partner.verification.overallStatus !== partner.status && <Badge status={partner.verification.overallStatus} />}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{partner.primaryContact.name}</span>
              <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400" />{partner.primaryContact.email}</span>
              {partner.primaryContact.phone && <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />{partner.primaryContact.phone}</span>}
              {location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{location}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1">{partner.partnerCode}</span>
              {referralText && (
                <button
                  type="button"
                  onClick={() => copyReferral(referralText)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1 transition"
                  title="Copy referral link"
                >
                  Referral code {partner.referral.referralCode}
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <CalendarDays size={13} /> Joined {new Date(partner.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="w-full lg:w-72 shrink-0 rounded-xl bg-slate-50 border border-slate-100 p-3">
            <label htmlFor="partner-status" className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Account status</label>
            <div className="flex gap-2">
              <select
                id="partner-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white capitalize outline-none focus:border-slate-400"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
              <Button onClick={applyStatus} loading={busy} disabled={selectedStatus === partner.status} className="!py-2">Apply</Button>
            </div>
          </div>
        </div>

        {partner.status === "rejected" && partner.verification.rejectionReason && (
          <div className="mx-5 sm:mx-6 mb-5 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span><strong>Rejected:</strong> {partner.verification.rejectionReason}</span>
          </div>
        )}

        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-slate-100 bg-slate-50/60">
          {STATS.map((s, i) => (
            <div key={s.label} className={`px-5 sm:px-6 py-4 ${i > 0 ? "lg:border-l border-slate-100" : ""}`}>
              <dt className="text-xs text-slate-500">{s.label}</dt>
              <dd className="text-lg font-bold text-slate-900 mt-0.5">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Section tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Affiliate sections">
        {PARTNER_SECTIONS.map((s) => (
          <NavLink
            key={s.key}
            to={partnerSectionPath(id, s.key)}
            end
            className={({ isActive }) => `inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition ${
              isActive ? "border-brand-red text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            <s.icon size={16} />
            {s.label}
            {s.key === "team" && <span className="text-xs font-medium text-slate-400">{team.length}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Selected section */}
      <section>
        {tab === "details" && <PartnerProfileForm key={partner.updatedAt} partner={partner} onSaved={load} />}
        {(tab === "leads" || tab === "rewards" || tab === "settlements") && <PartnerRecords key={tab} partnerId={id} kind={tab} />}
        {tab === "kyc" && (
          <PartnerKycBank
            partnerId={id}
            partner={partner}
            documents={documents}
            requiredDocumentTypes={requiredDocumentTypes}
            bankAccount={bankAccount}
            onChanged={load}
          />
        )}
        {tab === "payout" && <PartnerPayoutSettings key={settlementSetting?.updatedAt || "new"} partnerId={id} setting={settlementSetting} onSaved={load} />}
        {tab === "team" && <PartnerTeam partnerId={id} team={team} onChanged={load} />}
        {tab === "activity" && (
          <Card className="p-6">
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No activity yet.</p>
            ) : (
              <ol className="relative border-l border-slate-200 ml-2 space-y-5">
                {activity.map((a) => (
                  <li key={a._id} className="pl-5 relative">
                    <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${a.performedBy?.type === "spotx_user" ? "bg-brand-red" : a.performedBy?.type === "partner_user" ? "bg-slate-700" : "bg-slate-300"}`} />
                    <p className="text-sm text-slate-800">{a.description || a.activityType.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {actorLabel(a.performedBy?.type)} · {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}
