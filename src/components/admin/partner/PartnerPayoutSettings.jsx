import { useState } from "react";
import adminApi from "../../../services/adminApi";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { Input, Select } from "../../ui/Input";

const toForm = (s) => ({
  settlementType: s?.settlementType || "monthly",
  settlementDay: s?.settlementDay ?? "",
  minimumSettlementAmount: s?.minimumSettlementAmount ?? 0,
  paymentMethod: s?.paymentMethod || "bank_transfer",
  tdsEnabled: s?.tax?.tdsEnabled || false,
  tdsRate: s?.tax?.tdsRate ?? 0
});

// How and when this affiliate's approved rewards are paid out.
export default function PartnerPayoutSettings({ partnerId, setting, onSaved }) {
  const [form, setForm] = useState(() => toForm(setting));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const set = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await adminApi.put("/admin/config/settlement-settings", {
        partnerId,
        settlementType: form.settlementType,
        settlementDay: form.settlementDay === "" ? undefined : Number(form.settlementDay),
        minimumSettlementAmount: Number(form.minimumSettlementAmount) || 0,
        paymentMethod: form.paymentMethod,
        tax: { tdsEnabled: form.tdsEnabled, tdsRate: form.tdsEnabled ? Number(form.tdsRate) || 0 : 0 }
      });
      setMessage({ tone: "ok", text: "Payout settings saved." });
      onSaved();
    } catch (err) {
      setMessage({ tone: "error", text: err.response?.data?.message || "Couldn't save payout settings." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <p className="text-sm text-slate-500 mb-4">
        How often this affiliate is paid, the minimum payout, and tax deducted at source.
        {!setting && " No settings saved yet — defaults are shown."}
      </p>
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${message.tone === "ok" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Payout Frequency" name="settlementType" value={form.settlementType} onChange={set}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="threshold">When minimum is reached</option>
          <option value="manual">Manual</option>
        </Select>
        <Input label="Payout Day of Month (1–31)" type="number" min={1} max={31} name="settlementDay" value={form.settlementDay} onChange={set} />
        <Input label="Minimum Payout (₹)" type="number" min={0} name="minimumSettlementAmount" value={form.minimumSettlementAmount} onChange={set} />
        <Select label="Payment Method" name="paymentMethod" value={form.paymentMethod} onChange={set}>
          <option value="bank_transfer">Bank transfer</option>
          <option value="upi">UPI</option>
          <option value="other">Other</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
          <input type="checkbox" checked={form.tdsEnabled} onChange={(e) => setForm((prev) => ({ ...prev, tdsEnabled: e.target.checked }))} />
          Deduct TDS from payouts
        </label>
        {form.tdsEnabled && (
          <Input label="TDS Rate (%)" type="number" min={0} max={100} step="0.01" name="tdsRate" value={form.tdsRate} onChange={set} />
        )}
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" loading={saving}>Save Payout Settings</Button>
        </div>
      </form>
    </Card>
  );
}
