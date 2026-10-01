import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

function ScreenPricingTab() {
  const [basicPrice, setBasicPrice] = useState("");
  const [premiumPrice, setPremiumPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    adminApi.get("/admin/config/screen-pricing")
      .then((res) => {
        setBasicPrice(String(res.data.data.basicPricePerScreen));
        setPremiumPrice(String(res.data.data.premiumPricePerScreen));
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSavedMessage("");
    setSaving(true);
    try {
      await adminApi.put("/admin/config/screen-pricing", {
        basicPricePerScreen: Number(basicPrice),
        premiumPricePerScreen: Number(premiumPrice)
      });
      setSavedMessage("Saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>;

  return (
    <Card className="p-6 max-w-md">
      <p className="text-sm text-slate-500 mb-4">
        Monthly price per screen. The Basic price is used to estimate each lead's value (screens × price) on the Leads page.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Basic — price per screen / month (₹)" type="number" min={0} value={basicPrice} onChange={(e) => setBasicPrice(e.target.value)} required />
        <Input label="Premium — price per screen / month (₹)" type="number" min={0} value={premiumPrice} onChange={(e) => setPremiumPrice(e.target.value)} required />
        <Button type="submit" loading={saving}>Save</Button>
      </form>
      {savedMessage && <p className="text-xs text-emerald-600 mt-3">{savedMessage}</p>}
    </Card>
  );
}

export default function AdminConfig() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Screen Pricing</h1>
      <ScreenPricingTab />
    </div>
  );
}
