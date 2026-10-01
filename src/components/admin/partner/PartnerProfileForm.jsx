import { useState } from "react";
import adminApi from "../../../services/adminApi";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { Input, Select } from "../../ui/Input";

const ENTITY_TYPES = ["proprietorship", "partnership", "llp", "private_limited", "public_limited", "individual", "other"];

const toForm = (p) => ({
  businessName: p.legalEntity.businessName || "",
  legalName: p.legalEntity.legalName || "",
  entityType: p.legalEntity.entityType || "",
  website: p.legalEntity.website || "",
  industry: p.legalEntity.industry || "",
  contactName: p.primaryContact.name || "",
  phone: p.primaryContact.phone || "",
  designation: p.primaryContact.designation || "",
  addressLine1: p.address.addressLine1 || "",
  addressLine2: p.address.addressLine2 || "",
  city: p.address.city || "",
  state: p.address.state || "",
  pincode: p.address.pincode || "",
  country: p.address.country || "India"
});

const Section = ({ title, hint, className = "", children }) => (
  <Card className={`p-5 sm:p-6 ${className}`}>
    <h3 className="font-semibold text-slate-900">{title}</h3>
    {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">{children}</div>
  </Card>
);

// Admin-side edit of the affiliate's business, contact and address details.
export default function PartnerProfileForm({ partner, onSaved }) {
  const [form, setForm] = useState(() => toForm(partner));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { tone, text }

  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.patch(`/admin/partners/${partner._id}`, form);
      setMessage({ tone: "ok", text: "Details saved." });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: err.response?.data?.message || "Couldn't save the details." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {message && (
        <div className={`p-3 rounded-xl text-sm border ${message.tone === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Business" hint="Legal and business identity">
          <Input label="Business Name *" name="businessName" value={form.businessName} onChange={set} required />
          <Input label="Legal Name" name="legalName" value={form.legalName} onChange={set} />
          <Select label="Entity Type" name="entityType" value={form.entityType} onChange={set}>
            <option value="">Select entity type</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </Select>
          <Input label="Industry" name="industry" value={form.industry} onChange={set} />
          <Input label="Website" name="website" value={form.website} onChange={set} placeholder="https://" className="sm:col-span-2" />
        </Section>

        <Section title="Primary Contact" hint="The person SPOTX talks to">
          <Input label="Contact Name *" name="contactName" value={form.contactName} onChange={set} required />
          <Input label="Designation" name="designation" value={form.designation} onChange={set} />
          <Input label="Phone" name="phone" value={form.phone} onChange={set} />
          <Input label="Login Email" value={partner.primaryContact.email} disabled />
        </Section>
      </div>

      <Section title="Address">
        <Input label="Address Line 1" name="addressLine1" value={form.addressLine1} onChange={set} />
        <Input label="Address Line 2" name="addressLine2" value={form.addressLine2} onChange={set} />
        <div className="sm:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="City" name="city" value={form.city} onChange={set} />
          <Input label="State" name="state" value={form.state} onChange={set} />
          <Input label="Pincode" name="pincode" value={form.pincode} onChange={set} />
          <Input label="Country" name="country" value={form.country} onChange={set} />
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => { setForm(toForm(partner)); setMessage(null); }}>Reset</Button>
        <Button type="submit" loading={saving}>Save Changes</Button>
      </div>
    </form>
  );
}
