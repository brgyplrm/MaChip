import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";
import { getStoredUser } from "../utils/authStorage";
import { formatUserId } from "../utils/formatUserId";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesModal from "./UnsavedChangesModal";

// Icons
import {
  Users,
  Clock,
  ShieldCheck,
  Bell,
  AlertTriangle,
  FileCheck,
  Calendar,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  Edit3,
  Save,
  X
} from "lucide-react";

export default function SupervisorSettings() {
  const currentUser = getStoredUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { showPrompt, confirmNavigation, cancelNavigation } = useUnsavedChanges(isEditing);

  // 1. Team & Shift States
  const [minimumStaffingThreshold, setMinimumStaffingThreshold] = useState(25);
  const [irregularitiesFirst, setIrregularitiesFirst] = useState(true);

  // 2. Approval Routing States
  const [notificationMode, setNotificationMode] = useState("digest"); // 'instant' or 'digest'
  const [escalationWarning48h, setEscalationWarning48h] = useState(true);
  const [safeQuickEndorse, setSafeQuickEndorse] = useState(true);

  // 3. Personal Privacy States
  const [privacyShield, setPrivacyShield] = useState(false);

  // Live Staff & Operational Settings States
  const [staffUsers, setStaffUsers] = useState([]);
  const [systemSettings, setSystemSettings] = useState(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const cached = localStorage.getItem(`machip_supervisor_pref_${currentUser?.user_Id}`);
      if (cached) {
        applyPrefState(JSON.parse(cached));
      }

      const res = await fetchWithAuth("/api/users/preferences/my");
      if (res.ok) {
        const data = await res.json();
        if (data.preferences && Object.keys(data.preferences).length > 0) {
          applyPrefState(data.preferences);
          localStorage.setItem(`machip_supervisor_pref_${currentUser?.user_Id}`, JSON.stringify(data.preferences));
        }
      }

      // Fetch live staff members and system shift rules
      try {
        const [usersRes, settingsRes] = await Promise.all([
          fetchWithAuth("/api/users/all").catch(() => null),
          fetchWithAuth("/api/system/settings").catch(() => null)
        ]);

        if (usersRes && usersRes.ok) {
          const allUsers = await usersRes.json();
          if (Array.isArray(allUsers)) {
            setStaffUsers(allUsers);
          }
        }

        if (settingsRes && settingsRes.ok) {
          const sData = await settingsRes.json();
          setSystemSettings(sData);
        }
      } catch (liveErr) {
        console.warn("[PREFERENCES] Failed to load staff or system settings:", liveErr);
      }
    } catch (err) {
      console.warn("[PREFERENCES] Failed to load remote supervisor preferences:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyPrefState = (p) => {
    if (p.minimumStaffingThreshold !== undefined) setMinimumStaffingThreshold(p.minimumStaffingThreshold);
    if (p.irregularitiesFirst !== undefined) setIrregularitiesFirst(p.irregularitiesFirst);
    if (p.notificationMode !== undefined) setNotificationMode(p.notificationMode);
    if (p.escalationWarning48h !== undefined) setEscalationWarning48h(p.escalationWarning48h);
    if (p.safeQuickEndorse !== undefined) setSafeQuickEndorse(p.safeQuickEndorse);
    if (p.privacyShield !== undefined) setPrivacyShield(p.privacyShield);
  };

  const handleSavePreferences = async (overrides = {}) => {
    setSaving(true);
    setSaveSuccess(false);

    const newPrefs = {
      minimumStaffingThreshold,
      irregularitiesFirst,
      notificationMode,
      escalationWarning48h,
      safeQuickEndorse,
      privacyShield,
      ...overrides
    };

    try {
      localStorage.setItem(`machip_supervisor_pref_${currentUser?.user_Id}`, JSON.stringify(newPrefs));
      localStorage.setItem("machip_privacy_shield", String(newPrefs.privacyShield));

      window.dispatchEvent(new CustomEvent("privacyShieldChange", { detail: { enabled: newPrefs.privacyShield } }));
      window.dispatchEvent(new CustomEvent("machip_preferences_updated", { detail: newPrefs }));

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
      console.error("[PREFERENCES] Error saving supervisor preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  // Dynamic Shift & Operational Parameters from live SystemSettings
  const morningStart = systemSettings?.morningShiftStart ? systemSettings.morningShiftStart.substring(0, 5) : "08:30";
  const morningEnd = systemSettings?.morningShiftEnd ? systemSettings.morningShiftEnd.substring(0, 5) : "17:30";
  const graceTime = systemSettings?.gracePeriod ? systemSettings.gracePeriod.substring(0, 5) : "08:35";
  const nightEnabled = systemSettings?.enableNightShift ?? false;
  const eveningStart = systemSettings?.eveningShiftStart ? systemSettings.eveningShiftStart.substring(0, 5) : "20:30";
  const eveningEnd = systemSettings?.eveningShiftEnd ? systemSettings.eveningShiftEnd.substring(0, 5) : "05:30";
  const nightDiffPct = systemSettings?.nightDiffRate
    ? Math.round((Number(systemSettings.nightDiffRate) - 1.0) * 100)
    : 10;

  const userRoleBadge = currentUser?.user_Role ? `${currentUser.user_Role} Hub` : "Department Supervisor";

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-brand-primary text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/10 rounded-lg border border-white/10 shrink-0">
            <Users className="w-6 h-6 text-purple-200" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white">Supervisor Operations & Team Settings</h1>
              <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {userRoleBadge}
              </Badge>
            </div>
            <p className="text-sm text-purple-200/90 mt-1">
              Configure departmental staffing coverage thresholds, approval notification routing, and personal privacy controls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold bg-white/10 border border-white/20 px-3 py-1.5 rounded-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Settings Saved!
            </span>
          )}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  loadPreferences();
                  setIsEditing(false);
                }}
                disabled={saving}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs h-9 px-3.5 shadow-sm rounded-lg transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
              <Button
                onClick={async () => {
                  await handleSavePreferences();
                  setIsEditing(false);
                }}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 shadow-sm rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-1" /> {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-[#FF6B00] hover:bg-[#e66000] text-white font-semibold text-xs h-9 px-4 shadow-sm rounded-lg transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Preferences
            </Button>
          )}
        </div>
      </div>

      {/* ── Section 1: Team & Shift Rules ── */}
      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-primary-light text-brand-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Team Staffing Coverage & Shift Safeguards
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Protect warehouse and logistics operations from under-staffing during peak shipping cutoffs.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold text-slate-500 bg-slate-100 border-slate-200 px-2.5 py-1 rounded-md">
            Live Safeguard
          </Badge>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          
          {/* Coverage Alert Slider */}
          <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold text-slate-900 text-sm">Workforce Absence Threshold Warning</Label>
                <p className="text-slate-500 text-xs mt-0.5">
                  Warns before approving subordinate leaves that leave your department under-staffed.
                </p>
              </div>
              <span className="font-mono font-bold text-sm text-brand-primary bg-brand-primary-light border border-brand-primary/20 px-3 py-1 rounded-lg">
                {minimumStaffingThreshold}%
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400 font-bold">10%</span>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={minimumStaffingThreshold}
                disabled={!isEditing}
                onChange={(e) => setMinimumStaffingThreshold(parseInt(e.target.value, 10))}
                className="w-full accent-[#1058c7] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-slate-400 font-bold">50%</span>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50/80 border border-amber-200/90 text-amber-900 flex items-start gap-2.5 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                When reviewing Leave requests, the system checks current shift schedule density. If scheduled absences exceed <strong>{minimumStaffingThreshold}%</strong>, an approval confirmation modal prompts for staffing coverage justification.
              </span>
            </div>
          </div>

          {/* Irregularities First Toggle */}
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <Label className="font-bold text-slate-900 text-sm">Default &quot;Irregularities First&quot; Attendance View</Label>
                <p className="text-slate-500 text-xs mt-0.5">
                  Automatically prioritize subordinate rows with missing punches, tardiness, or unscheduled absences to the top of your team attendance roster.
                </p>
              </div>
            </div>
            <Switch checked={irregularitiesFirst} onCheckedChange={setIrregularitiesFirst} disabled={!isEditing} />
          </div>

          {/* Department Shift Rules (Dynamic Sync) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-primary" />
                Active Departmental Shift Parameters (Governing Subordinates)
              </h3>
              <span className="text-[11px] font-medium text-brand-primary bg-brand-primary-light px-2.5 py-0.5 rounded-full">
                Synced with System Settings
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Morning Shift Card */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Standard Morning Shift</span>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border-emerald-200">
                    Active Routine
                  </Badge>
                </div>
                <p className="font-mono font-bold text-slate-900 text-lg">{morningStart} – {morningEnd}</p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Grace period active until {graceTime} AM</span>
                </div>
              </div>

              {/* Night Shift Card */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Night Differential Shift</span>
                  <Badge variant="outline" className={nightEnabled ? "text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-primary-light text-brand-primary border-brand-primary/20" : "text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-600 border-slate-300"}>
                    {nightEnabled ? "22:00 – 06:00 Active" : "Disabled"}
                  </Badge>
                </div>
                <p className="font-mono font-bold text-slate-900 text-lg">
                  {nightEnabled ? `${eveningStart} – ${eveningEnd}` : "Not Scheduled"}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-brand-primary font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{nightDiffPct}% Night Differential statutory rate active</span>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── Section 2: Approval Routing & Alerts ── */}
      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-primary-light text-brand-primary flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Request Approval Workflow & Notification Routing
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Streamline subordinate leave, overtime, and field punch endorsements without alert overload.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold text-slate-500 bg-slate-100 border-slate-200 px-2.5 py-1 rounded-md">
            Routing
          </Badge>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          
          <div className="space-y-2">
            <Label className="font-bold text-slate-900 text-sm">Subordinate Request Notification Delivery Mode</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div
                onClick={() => { if (isEditing) setNotificationMode("instant"); }}
                className={`p-4 rounded-xl transition-all space-y-1.5 ${!isEditing ? "opacity-75 cursor-default" : "cursor-pointer"} ${
                  notificationMode === "instant"
                    ? "border-2 border-brand-primary bg-brand-primary-light/30 shadow-xs"
                    : "border border-slate-200/80 bg-white hover:bg-slate-50/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">Instant Notifications</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${notificationMode === "instant" ? "bg-brand-primary text-white" : "border border-slate-300"}`}>
                    {notificationMode === "instant" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Receive an immediate badge & toast alert whenever any subordinate files a Leave, Overtime, or Punch Adjustment.
                </p>
              </div>

              <div
                onClick={() => { if (isEditing) setNotificationMode("digest"); }}
                className={`p-4 rounded-xl transition-all space-y-1.5 ${!isEditing ? "opacity-75 cursor-default" : "cursor-pointer"} ${
                  notificationMode === "digest"
                    ? "border-2 border-brand-primary bg-brand-primary-light/30 shadow-xs"
                    : "border border-slate-200/80 bg-white hover:bg-slate-50/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-primary text-sm flex items-center gap-1.5">
                    Morning Daily Digest (08:00 AM)
                    <Badge variant="outline" className="text-[10px] font-bold bg-brand-primary text-white border-transparent px-2 py-0.5 rounded-full">
                      Recommended
                    </Badge>
                  </span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${notificationMode === "digest" ? "bg-brand-primary text-white" : "border border-slate-300"}`}>
                    {notificationMode === "digest" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Consolidates pending Leave & Overtime requests into a single actionable shift-start overview report.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <Label className="font-bold text-slate-900 text-sm">48-Hour Auto-Escalation Warning</Label>
                <p className="text-slate-500 text-xs mt-0.5">
                  Alerts you if a subordinate request sits idle for 48 hours before the system escalates it to Admin Manager.
                </p>
              </div>
            </div>
            <Switch checked={escalationWarning48h} onCheckedChange={setEscalationWarning48h} disabled={!isEditing} />
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                <FileCheck className="w-4 h-4 text-brand-primary" />
              </div>
              <div>
                <Label className="font-bold text-slate-900 text-sm">Safe Quick-Endorsement Preset</Label>
                <p className="text-slate-500 text-xs mt-0.5">
                  Enables 1-click batch endorsement for standard scheduled overtime under 2.0 hours.
                </p>
              </div>
            </div>
            <Switch checked={safeQuickEndorse} onCheckedChange={setSafeQuickEndorse} disabled={!isEditing} />
          </div>

        </CardContent>
      </Card>

      {/* ── Section 3: Personal Privacy & Display ── */}
      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-xl overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Supervisor Personal Privacy Shield & Transparency
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Personal security and data protection toggles for your supervisor account.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-200 px-2.5 py-1 rounded-md">
            DPA Protected
          </Badge>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                <EyeOff className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <Label className="font-bold text-slate-900 text-sm">Public Screen Privacy Masking Shield</Label>
                <p className="text-slate-500 text-xs mt-0.5">
                  Auto-blurs your personal net pay, salary, and banking information across dashboard views.
                </p>
              </div>
            </div>
            <Switch
              checked={privacyShield}
              disabled={!isEditing}
              onCheckedChange={(val) => {
                setPrivacyShield(val);
              }}
            />
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-slate-50/70 border border-blue-200/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-blue-200 text-brand-primary flex items-center justify-center shrink-0 shadow-2xs">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Audit Transparency Trail (&quot;Who Viewed My Data?&quot;)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect the immutable audit log whenever higher management unmasks your sensitive profile information.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs h-9 px-4 rounded-lg shadow-2xs transition-all shrink-0 cursor-pointer"
            >
              <Link to="/profile?tab=transparency">
                <span>Open Transparency Hub</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>

        </CardContent>
      </Card>
      <UnsavedChangesModal
        isOpen={showPrompt}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </div>
  );
}
