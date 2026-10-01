import { UserCircle, Users, Trophy, Landmark, FileCheck, Wallet, UserCog, History } from "lucide-react";

// Sections of one affiliate partner, shown as the menu on its admin page and
// routed as /admin/partners/:id/:section (details has no suffix).
export const PARTNER_SECTIONS = [
  { key: "details", label: "Details", icon: UserCircle },
  { key: "leads", label: "Leads", icon: Users },
  { key: "rewards", label: "Rewards", icon: Trophy },
  { key: "settlements", label: "Settlements", icon: Landmark },
  { key: "kyc", label: "KYC & Bank", icon: FileCheck },
  { key: "payout", label: "Payout Settings", icon: Wallet },
  { key: "team", label: "Team", icon: UserCog },
  { key: "activity", label: "Activity", icon: History }
];

export const partnerSectionPath = (id, key) =>
  key === "details" ? `/admin/partners/${id}` : `/admin/partners/${id}/${key}`;
