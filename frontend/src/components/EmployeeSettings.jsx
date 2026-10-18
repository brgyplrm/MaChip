import { useState, useEffect } from "react";
import { fetchWithAuth } from "../utils/api";
import { getStoredUser } from "../utils/authStorage";
import { formatUserId } from "../utils/formatUserId";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

// Icons
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Bell,
  Sliders,
  Cpu,
  UserCheck,
  KeyRound,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Sparkles,
  ExternalLink
} from "lucide-react";

export default function EmployeeSettings() {
  const currentUser = getStoredUser();
  const [activeTab, setActiveTab] = useState("privacy");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preference States
  const [privacyShield, setPrivacyShield] = useState(false);
  const [notifyPayslipRelease, setNotifyPayslipRelease] = useState(true);
  const [notifyAttendanceAnomaly, setNotifyAttendanceAnomaly] = useState(true);
  const [notifyRequestLifecycle, setNotifyRequestLifecycle] = useState(true);
  const [notifyLoanPreview, setNotifyLoanPreview] = useState(true);
  const [defaultLandingPage, setDefaultLandingPage] = useState("dashboard");
  const [calendarViewMode, setCalendarViewMode] = useState("cutoff");
  const [bilingualLabels, setBilingualLabels] = useState(false);
  const [timeFormat, setTimeFormat] = useState("12h"); // "12h" (05:30 PM) or "24h" (17:30 Military)

  // Live Profile & Financial Data States
  const [userProfile, setUserProfile] = useState(null);
  const [latestNetPay, setLatestNetPay] = useState(null);

  // Modal Dialog States
  const [showLostCardModal, setShowLostCardModal] = useState(false);
  const [showRescanModal, setShowRescanModal] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      // 1. Read from localStorage fallback
      const cached = localStorage.getItem(`machip_user_pref_${currentUser?.user_Id}`);
      if (cached) {
        applyPrefState(JSON.parse(cached));
      }

      // 2. Fetch from backend System_State store
      const res = await fetchWithAuth("/api/users/preferences/my");
      if (res.ok) {
        const data = await res.json();
        if (data.preferences && Object.keys(data.preferences).length > 0) {
          applyPrefState(data.preferences);
          localStorage.setItem(`machip_user_pref_${currentUser?.user_Id}`, JSON.stringify(data.preferences));
        }
      }

      // 3. Fetch live user profile and payroll records for dynamic display
      if (currentUser?.user_Id) {
        try {
          const [uRes, pRes] = await Promise.all([
            fetchWithAuth(`/api/users/${currentUser.user_Id}`).catch(() => null),
            fetchWithAuth("/api/payroll/my-history").catch(() => null)
          ]);
          if (uRes && uRes.ok) {
            const uData = await uRes.json();
            setUserProfile(uData);
          }
          if (pRes && pRes.ok) {
            const pData = await pRes.json();
            if (Array.isArray(pData) && pData.length > 0) {
              setLatestNetPay(pData[0].netSalary);
            }
          }
        } catch (liveErr) {
          console.warn("[PREFERENCES] Failed to load live profile or payroll history:", liveErr);
        }
      }
    } catch (err) {
      console.warn("[PREFERENCES] Failed to load remote preferences, using cached values:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyPrefState = (p) => {
    if (p.privacyShield !== undefined) setPrivacyShield(p.privacyShield);
    if (p.notifyPayslipRelease !== undefined) setNotifyPayslipRelease(p.notifyPayslipRelease);
    if (p.notifyAttendanceAnomaly !== undefined) setNotifyAttendanceAnomaly(p.notifyAttendanceAnomaly);
    if (p.notifyRequestLifecycle !== undefined) setNotifyRequestLifecycle(p.notifyRequestLifecycle);
    if (p.notifyLoanPreview !== undefined) setNotifyLoanPreview(p.notifyLoanPreview);
    if (p.defaultLandingPage !== undefined) setDefaultLandingPage(p.defaultLandingPage);
    if (p.calendarViewMode !== undefined) setCalendarViewMode(p.calendarViewMode);
    if (p.bilingualLabels !== undefined) setBilingualLabels(p.bilingualLabels);
    if (p.timeFormat !== undefined) setTimeFormat(p.timeFormat);
  };

  const handleSavePreferences = async (overrides = {}) => {
    setSaving(true);
    setSaveSuccess(false);

    const newPrefs = {
      privacyShield,
      notifyPayslipRelease,
      notifyAttendanceAnomaly,
      notifyRequestLifecycle,
      notifyLoanPreview,
      defaultLandingPage,
      calendarViewMode,
      bilingualLabels,
      timeFormat,
      ...overrides
    };

    try {
      // 1. Cache immediately in localStorage
      localStorage.setItem(`machip_user_pref_${currentUser?.user_Id}`, JSON.stringify(newPrefs));
      localStorage.setItem("machip_privacy_shield", String(newPrefs.privacyShield));
      localStorage.setItem("machip_time_format", newPrefs.timeFormat);

      // 2. Dispatch cross-component events
      window.dispatchEvent(new CustomEvent("privacyShieldChange", { detail: { enabled: newPrefs.privacyShield } }));
      window.dispatchEvent(new CustomEvent("machip_preferences_updated", { detail: newPrefs }));
      window.dispatchEvent(new CustomEvent("machip_time_format_change", { detail: { format: newPrefs.timeFormat } }));

      // 3. Persist to backend
      const res = await fetchWithAuth("/api/users/preferences/my", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: newPrefs })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("[PREFERENCES] Error saving preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  // Dynamic compensation resolution
  const resolvedNetPay = latestNetPay !== null
    ? Number(latestNetPay)
    : (userProfile?.dailyRate ? Number(userProfile.dailyRate) * 11 : null);

  const displayNetPay = privacyShield
    ? "₱••••••••"
    : (resolvedNetPay !== null
        ? `₱${resolvedNetPay.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "₱0.00");

  const netPayLabel = latestNetPay !== null ? "Latest Net Pay" : "Projected Cutoff Pay";

  // Dynamic Bank Account resolution
  const rawAccount = userProfile?.account_Number || currentUser?.account_Number;
  const displayAccount = rawAccount
    ? (privacyShield
        ? (rawAccount.length > 4 ? `••••••••${rawAccount.slice(-4)}` : "••••••••")
        : rawAccount)
    : "No Bank Linked";

  // Dynamic Hardware credentials
  const machipUid = userProfile?.user_MachipId || currentUser?.user_MachipId;
  const displayRfid = machipUid
    ? (privacyShield ? `•••• •••• ••${String(machipUid).slice(-4)}` : `Card #${machipUid}`)
    : "Unassigned";

  const fpSlot = userProfile?.user_FingerprintId !== undefined && userProfile?.user_FingerprintId !== null
    ? userProfile.user_FingerprintId
    : (currentUser?.user_FingerprintId !== undefined && currentUser?.user_FingerprintId !== null ? currentUser.user_FingerprintId : null);

  const displayFingerprint = fpSlot !== null
    ? `Optical Sensor R307 (Slot #${fpSlot})`
    : "Sensor Template Not Enrolled";

  const userRoleBadge = userProfile?.user_Role || currentUser?.user_Role || "Employee Portal";

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-brand-primary/10 via-purple-50 to-white p-6 rounded-2xl border border-brand-primary/20 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl md:text-2xl font-extrabold text-brand-primary">Employee Self-Service & Preferences</h2>
            <Badge variant="outline" className="bg-purple-100 text-brand-primary border-brand-primary/30 text-[10px] font-bold uppercase tracking-wider">
              {userRoleBadge}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Customize your public screen privacy shields, operational notifications, preferred attendance calendar views, and monitor hardware credential diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Preferences Saved!
            </span>
          )}
          <Button
            onClick={() => handleSavePreferences()}
            disabled={saving}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs h-10 px-5 shadow-xs cursor-pointer"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-slate-100 p-1 rounded-xl h-auto border border-slate-200/80 gap-1">
          <TabsTrigger
            value="privacy"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-brand-primary" /> Privacy & Security Shield
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-xs"
          >
            <Bell className="w-4 h-4 text-brand-primary" /> Notifications & Alerts
          </TabsTrigger>
          <TabsTrigger
            value="display"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-xs"
          >
            <Sliders className="w-4 h-4 text-brand-primary" /> Display & Localization
          </TabsTrigger>
          <TabsTrigger
            value="hardware"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-brand-primary data-[state=active]:shadow-xs"
          >
            <Cpu className="w-4 h-4 text-brand-primary" /> Hardware & Biometrics
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Privacy & Security Shield ── */}
        <TabsContent value="privacy" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Public Screen Privacy Masking Shield (RA 10173 DPA)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">
                    Prevents shoulder-surfing when accessing your account in shared office areas or on personal mobile devices.
                  </CardDescription>
                </div>
                <Switch
                  checked={privacyShield}
                  onCheckedChange={(val) => {
                    setPrivacyShield(val);
                    handleSavePreferences({ privacyShield: val });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                When enabled, sensitive compensation numbers, gross/net earnings, and bank accounts are automatically masked across all portal views. You can hover or click the reveal icon anytime to peek at values.
              </p>

              {/* Interactive Preview Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Live Privacy Masking Simulation:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">{netPayLabel}</span>
                      <p className="font-bold text-sm text-slate-900">
                        {displayNetPay}
                      </p>
                    </div>
                    {privacyShield ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Bank Account</span>
                      <p className="font-mono font-bold text-sm text-slate-900">
                        {displayAccount}
                      </p>
                    </div>
                    {privacyShield ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                  </div>
                </div>
              </div>

              {/* Data Access Transparency Card */}
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-brand-primary" />
                    Data Access Transparency Log (&quot;Who Viewed My Data?&quot;)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Under RA 10173, inspect whenever HR or an administrator unmasks or views your personal data.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10 font-bold text-xs h-9 cursor-pointer shrink-0"
                >
                  <a href="/profile?tab=transparency">
                    Open Transparency Hub <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
              </div>

              {/* Active Session & Device Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  Current Active Session
                </h4>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <Laptop className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">Web Portal Session (Current Device)</p>
                      <span className="text-[11px] text-slate-500 block">
                        Logged in as {currentUser?.user_FirstName} {currentUser?.user_LastName} ({currentUser ? formatUserId(currentUser.user_Id) : "SYS"})
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold uppercase">
                    Active & Encrypted
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Notifications & Operational Alerts ── */}
        <TabsContent value="notifications" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-primary" />
                Operational Notification Preferences
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Choose which instant notifications and alerts you receive while working in the portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 divide-y divide-slate-100 text-xs">
              
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Instant Payslip Release Notification</Label>
                  <p className="text-slate-500 text-[11px]">
                    Receive an immediate popup alert the moment the accounting cutoff transitions your payslip to Released.
                  </p>
                </div>
                <Switch checked={notifyPayslipRelease} onCheckedChange={setNotifyPayslipRelease} />
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Attendance Anomaly & Missing Punch Alert</Label>
                  <p className="text-slate-500 text-[11px]">
                    Pings you if your daily record shows a missing punch-out, allowing you to file a Time Adjustment immediately.
                  </p>
                </div>
                <Switch checked={notifyAttendanceAnomaly} onCheckedChange={setNotifyAttendanceAnomaly} />
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Request Status Lifecycle Updates</Label>
                  <p className="text-slate-500 text-[11px]">
                    Notifies you when Leave, Overtime, or Cash Advance requests are approved, endorsed, or returned with feedback.
                  </p>
                </div>
                <Switch checked={notifyRequestLifecycle} onCheckedChange={setNotifyRequestLifecycle} />
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Pre-Cutoff Deduction Preview Alert</Label>
                  <p className="text-slate-500 text-[11px]">
                    Sends a 3-day preview of scheduled loan amortizations (SSS, Pag-IBIG, Cash Advances) ahead of payout day.
                  </p>
                </div>
                <Switch checked={notifyLoanPreview} onCheckedChange={setNotifyLoanPreview} />
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Display & Localization Preferences ── */}
        <TabsContent value="display" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-primary" />
                Portal Display & Localization Preferences
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Tailor your view layout, landing tab, and language labels for day-to-day warehouse or office ergonomics.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Default Portal Landing View</Label>
                  <Select value={defaultLandingPage} onValueChange={setDefaultLandingPage}>
                    <SelectTrigger className="h-10 text-xs bg-white border-slate-200 rounded-lg">
                      <SelectValue placeholder="Select landing page" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">Dashboard / Home Overview</SelectItem>
                      <SelectItem value="calendar">My Attendance Calendar</SelectItem>
                      <SelectItem value="payslip">Latest Official Payslip</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-slate-400">The first screen displayed upon signing in.</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-800 text-xs">Attendance Calendar View Format</Label>
                  <Select value={calendarViewMode} onValueChange={setCalendarViewMode}>
                    <SelectTrigger className="h-10 text-xs bg-white border-slate-200 rounded-lg">
                      <SelectValue placeholder="Select calendar view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cutoff">Cutoff Split View (1st–15th / 16th–31st)</SelectItem>
                      <SelectItem value="monthly">Full Calendar Month Grid</SelectItem>
                      <SelectItem value="weekly">Weekly Operational Agenda</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-slate-400">Preferred layout for your attendance records.</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Bilingual Terminology Support (English / Tagalog)</Label>
                  <p className="text-slate-500 text-[11px]">
                    Displays friendly Tagalog labels alongside English terms (e.g. &quot;Huli / Late&quot;, &quot;Dagdag Oras / Overtime&quot;, &quot;Bakasyon / Leave&quot;).
                  </p>
                </div>
                <Switch checked={bilingualLabels} onCheckedChange={setBilingualLabels} />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="font-bold text-slate-900 text-xs">Time Display Format (Standard vs Military)</Label>
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 font-mono">
                      {timeFormat === "24h" ? "24H (17:30)" : "12H (05:30 PM)"}
                    </Badge>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Switch between 12-Hour standard clock (e.g. 05:30 PM) and 24-Hour military/logistics format (e.g. 17:30) used on airport cargo manifests.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-bold ${timeFormat === "12h" ? "text-brand-primary" : "text-slate-400"}`}>12-Hour</span>
                  <Switch 
                    checked={timeFormat === "24h"} 
                    onCheckedChange={(checked) => setTimeFormat(checked ? "24h" : "12h")} 
                  />
                  <span className={`text-[11px] font-bold ${timeFormat === "24h" ? "text-brand-primary" : "text-slate-400"}`}>24-Hour (Military)</span>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Hardware & Biometrics Health Status ── */}
        <TabsContent value="hardware" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                Physical Hardware & Biometric Health (CTPAT Access Control)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Inspect the operational status of your assigned RFID badge card and enrolled biometric fingerprint sensor template.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* RFID Card Health Card */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <CreditCardIcon className="w-4 h-4 text-brand-primary" /> RFID Card Badge
                    </span>
                    <Badge className={machipUid ? "bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold uppercase" : "bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold uppercase"}>
                      {machipUid ? "Active & Enrolled" : "Not Enrolled"}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Badge Identifier</span>
                    <p className="font-mono font-bold text-sm text-slate-900">
                      {displayRfid}
                    </p>
                    <span className="text-[11px] text-slate-500 block">
                      {machipUid ? "Enrolled on ESP32 / MFRC522 Turnstile Reader" : "Visit HR office to enroll physical RFID card"}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLostCardModal(true)}
                      disabled={!machipUid}
                      className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs h-8 cursor-pointer disabled:opacity-50"
                    >
                      Report Lost / Stolen Badge
                    </Button>
                  </div>
                </div>

                {/* Biometric Sensor Status Card */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <FingerprintIcon className="w-4 h-4 text-emerald-600" /> Optical Fingerprint
                    </span>
                    <Badge className={fpSlot !== null ? "bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold uppercase" : "bg-slate-200 text-slate-700 border-slate-300 text-[10px] font-bold uppercase"}>
                      {fpSlot !== null ? "Sensor Synced" : "Not Enrolled"}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sensor Template Slot</span>
                    <p className="font-mono font-bold text-sm text-slate-900">
                      {displayFingerprint}
                    </p>
                    <span className="text-[11px] text-slate-500 block">
                      {fpSlot !== null ? "Biometric template secured on sensor hardware" : "No fingerprint template enrolled in optical sensor"}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRescanModal(true)}
                      className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs h-8 cursor-pointer"
                    >
                      Request Sensor Re-Scan
                    </Button>
                  </div>
                </div>
              </div>

              {ticketSubmitted && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{ticketSubmitted}</span>
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lost Card Modal */}
      <Dialog open={showLostCardModal} onOpenChange={setShowLostCardModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Report Lost or Stolen RFID Badge
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Immediately notify the HR administrator to deactivate door access for this card in compliance with CTPAT security protocols.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <p className="text-slate-700 leading-relaxed">
              Are you sure you want to flag your badge card as lost? Once reported, HR will temporarily freeze turnstile access for this credential and prepare a replacement badge for you.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowLostCardModal(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowLostCardModal(false);
                setTicketSubmitted("Incident report submitted to HR: RFID badge flagged as lost for immediate deactivation.");
                setTimeout(() => setTicketSubmitted(null), 6000);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              Confirm Report to HR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-Scan Modal */}
      <Dialog open={showRescanModal} onOpenChange={setShowRescanModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FingerprintIcon className="w-5 h-5 text-emerald-600" />
              Request Fingerprint Sensor Re-Enrollment
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Submit a service ticket if warehouse manual labor has worn down fingerprint ridges, causing repeated sensor read errors.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 text-xs">
            <p className="text-slate-700 leading-relaxed">
              A notification will be routed to the HR Admin station. You will be scheduled to re-scan your fingerprint on the Optical R307 terminal during your next shift break.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowRescanModal(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowRescanModal(false);
                setTicketSubmitted("Biometric re-enrollment request sent to HR. Please visit the admin console during shift break.");
                setTimeout(() => setTicketSubmitted(null), 6000);
              }}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs"
            >
              Submit Re-Scan Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditCardIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function FingerprintIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  );
}
