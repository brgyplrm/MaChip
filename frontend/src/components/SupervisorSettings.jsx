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

// Icons
import {
  Users,
  Clock,
  ShieldCheck,
  Bell,
  UserCheck,
  AlertTriangle,
  FileCheck,
  Calendar,
  Send,
  Eye,
  EyeOff,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight
} from "lucide-react";

export default function SupervisorSettings() {
  const currentUser = getStoredUser();
  const [activeTab, setActiveTab] = useState("team");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Team & Shift States
  const [minimumStaffingThreshold, setMinimumStaffingThreshold] = useState(25);
  const [irregularitiesFirst, setIrregularitiesFirst] = useState(true);

  // 2. Approval Routing States
  const [notificationMode, setNotificationMode] = useState("digest"); // 'instant' or 'digest'
  const [escalationWarning48h, setEscalationWarning48h] = useState(true);
  const [safeQuickEndorse, setSafeQuickEndorse] = useState(true);

  // 3. Delegation States
  const [delegationActive, setDelegationActive] = useState(false);
  const [delegateStartDate, setDelegateStartDate] = useState("");
  const [delegateEndDate, setDelegateEndDate] = useState("");
  const [delegateActingSupervisor, setDelegateActingSupervisor] = useState("");
  const [handoverFormat, setHandoverFormat] = useState("pdf");
  const [handoverIncludeOT, setHandoverIncludeOT] = useState(true);
  const [handoverIncludeAnomalies, setHandoverIncludeAnomalies] = useState(true);

  // 4. Personal Privacy States
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
    if (p.delegationActive !== undefined) setDelegationActive(p.delegationActive);
    if (p.delegateStartDate !== undefined) setDelegateStartDate(p.delegateStartDate);
    if (p.delegateEndDate !== undefined) setDelegateEndDate(p.delegateEndDate);
    if (p.delegateActingSupervisor !== undefined) setDelegateActingSupervisor(p.delegateActingSupervisor);
    if (p.handoverFormat !== undefined) setHandoverFormat(p.handoverFormat);
    if (p.handoverIncludeOT !== undefined) setHandoverIncludeOT(p.handoverIncludeOT);
    if (p.handoverIncludeAnomalies !== undefined) setHandoverIncludeAnomalies(p.handoverIncludeAnomalies);
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
      delegationActive,
      delegateStartDate,
      delegateEndDate,
      delegateActingSupervisor,
      handoverFormat,
      handoverIncludeOT,
      handoverIncludeAnomalies,
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

  // Filter eligible staff for acting supervisor delegation (Roles 1, 2, 4 excluding current user)
  const eligibleActingSupervisors = staffUsers.filter(u =>
    [1, 2, 4].includes(Number(u.user_RoleId)) && Number(u.user_Id) !== Number(currentUser?.user_Id)
  );

  const selectedSupervisorObj = staffUsers.find(u => String(u.user_Id) === String(delegateActingSupervisor));
  const actingSupervisorLabel = selectedSupervisorObj
    ? `${selectedSupervisorObj.user_FirstName} ${selectedSupervisorObj.user_LastName} (${formatUserId(selectedSupervisorObj.user_Id)})`
    : "the designated acting supervisor";

  const userRoleBadge = currentUser?.user_Role ? `${currentUser.user_Role} Hub` : "Department Supervisor";

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-white p-6 rounded-2xl border border-amber-500/20 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Supervisor Operations & Team Settings</h2>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold uppercase tracking-wider">
              {userRoleBadge}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure departmental staffing coverage thresholds, approval notification routing, temporary out-of-office delegation, and shift handover presets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Settings Saved!
            </span>
          )}
          <Button
            onClick={() => handleSavePreferences()}
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-5 shadow-xs cursor-pointer"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-slate-100 p-1 rounded-xl h-auto border border-slate-200/80 gap-1">
          <TabsTrigger
            value="team"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-xs"
          >
            <Users className="w-4 h-4 text-amber-600" /> Team & Shift Rules
          </TabsTrigger>
          <TabsTrigger
            value="approval"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-xs"
          >
            <FileCheck className="w-4 h-4 text-amber-600" /> Approval Routing
          </TabsTrigger>
          <TabsTrigger
            value="delegation"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-xs"
          >
            <UserCheck className="w-4 h-4 text-amber-600" /> Out-of-Office Delegation
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="flex items-center gap-2 py-2.5 text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-amber-800 data-[state=active]:shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600" /> Privacy & Display
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Team & Shift Rules ── */}
        <TabsContent value="team" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Team Staffing Coverage & Shift Threshold Safeguards
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Protect warehouse and logistics operations from under-staffing during peak shipping cutoffs.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              
              {/* Coverage Alert Slider */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-bold text-slate-900 text-xs">Minimum Workforce Absence Threshold Warning</Label>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Warns before approving subordinate leaves that leave your department below this capacity.
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm text-amber-800 bg-amber-100 border border-amber-200 px-3 py-1 rounded-lg">
                    {minimumStaffingThreshold}%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-bold">10%</span>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="5"
                    value={minimumStaffingThreshold}
                    onChange={(e) => setMinimumStaffingThreshold(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">50%</span>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-2 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    When reviewing Leave requests, the system will verify current schedule density. If scheduled absences exceed <strong>{minimumStaffingThreshold}%</strong>, an approval confirmation modal will prompt for staffing rationale.
                  </span>
                </div>
              </div>

              {/* Irregularities First Toggle */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Default &quot;Irregularities First&quot; Attendance View</Label>
                  <p className="text-slate-500 text-[11px]">
                    Automatically prioritize subordinate rows with missing punches, tardiness, or unscheduled absences to the top of the team attendance roster.
                  </p>
                </div>
                <Switch checked={irregularitiesFirst} onCheckedChange={setIrregularitiesFirst} />
              </div>

              {/* Department Shift Rules (Dynamic Live Preview) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Active Departmental Shift Parameters (Governing Subordinates)
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Synced with System Settings</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Morning Shift Schedule</span>
                    <p className="font-bold text-slate-900 text-sm">{morningStart} – {morningEnd}</p>
                    <span className="text-[11px] text-emerald-700 block font-medium">
                      Grace period active until {graceTime} AM
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Night Shift Schedule</span>
                      <Badge className={nightEnabled ? "bg-purple-100 text-purple-800 border-purple-200 text-[9px] font-bold uppercase" : "bg-slate-200 text-slate-600 border-slate-300 text-[9px] font-bold uppercase"}>
                        {nightEnabled ? "Active Shift" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">
                      {nightEnabled ? `${eveningStart} – ${eveningEnd}` : "Not Scheduled"}
                    </p>
                    <span className="text-[11px] text-purple-700 block font-medium">
                      {nightDiffPct}% Night Differential active 22:00–06:00
                    </span>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Approval Routing & Alerts ── */}
        <TabsContent value="approval" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-600" />
                Request Approval Workflow & Notification Routing
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Streamline subordinate leave, overtime, and field punch endorsements without getting overwhelmed by alert volume.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 divide-y divide-slate-100 text-xs">
              
              <div className="py-3.5 space-y-2">
                <Label className="font-bold text-slate-900 text-xs">Subordinate Request Notification Delivery Mode</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div
                    onClick={() => setNotificationMode("instant")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      notificationMode === "instant"
                        ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">Instant Notifications</span>
                      <Bell className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Receive an immediate badge & toast alert whenever any subordinate files a request.
                    </p>
                  </div>

                  <div
                    onClick={() => setNotificationMode("digest")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      notificationMode === "digest"
                        ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">Morning Daily Digest (08:00 AM)</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Recommended: Consolidates all pending Leave & OT into a single actionable shift-start overview.
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">48-Hour Auto-Escalation Warning</Label>
                  <p className="text-slate-500 text-[11px]">
                    Alerts you if a subordinate request sits idle for 48 hours before the system escalates it to Admin Manager.
                  </p>
                </div>
                <Switch checked={escalationWarning48h} onCheckedChange={setEscalationWarning48h} />
              </div>

              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Safe Quick-Endorsement Preset</Label>
                  <p className="text-slate-500 text-[11px]">
                    Enables 1-click batch endorsement for standard scheduled overtime under 2.0 hours.
                  </p>
                </div>
                <Switch checked={safeQuickEndorse} onCheckedChange={setSafeQuickEndorse} />
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Delegation & Out-of-Office Mode ── */}
        <TabsContent value="delegation" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-600" />
                    Temporary Out-of-Office Authority Delegation
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">
                    Delegate leave and overtime endorsement authority to a peer supervisor while on business travel or PTO.
                  </CardDescription>
                </div>
                <Switch checked={delegationActive} onCheckedChange={setDelegationActive} />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              
              {delegationActive ? (
                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-300 space-y-4">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Out-of-Office Delegation is Currently Active</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="font-bold text-slate-800 text-[11px]">Delegation Start Date</Label>
                      <Input
                        type="date"
                        value={delegateStartDate}
                        onChange={(e) => setDelegateStartDate(e.target.value)}
                        className="h-9 text-xs bg-white border-amber-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="font-bold text-slate-800 text-[11px]">Delegation End Date</Label>
                      <Input
                        type="date"
                        value={delegateEndDate}
                        onChange={(e) => setDelegateEndDate(e.target.value)}
                        className="h-9 text-xs bg-white border-amber-200"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="font-bold text-slate-800 text-[11px]">Acting Supervisor</Label>
                      <Select value={delegateActingSupervisor ? String(delegateActingSupervisor) : ""} onValueChange={setDelegateActingSupervisor}>
                        <SelectTrigger className="h-9 text-xs bg-white border-amber-200">
                          <SelectValue placeholder="Select acting supervisor" />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleActingSupervisors.length > 0 ? (
                            eligibleActingSupervisors.map(sup => (
                              <SelectItem key={sup.user_Id} value={String(sup.user_Id)}>
                                {sup.positionTitle || sup.user_Role} — {sup.user_FirstName} {sup.user_LastName} ({formatUserId(sup.user_Id)})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>No eligible supervisors found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-900/80 leading-relaxed">
                    <strong>Audit Integrity Guarantee:</strong> All approvals made by <strong>{actingSupervisorLabel}</strong> during this period are cryptographically linked in the <code>Audit_Log</code> table as <em>&quot;Endorsed by Acting Supervisor on behalf of {currentUser?.user_FirstName}&quot;</em>.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-500">
                  Out-of-Office delegation is inactive. Toggle the switch above to designate an acting supervisor when planning planned leaves or off-site audits.
                </div>
              )}

              {/* Shift Handover Report Presets */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Daily Shift Handover Sheet Export Preset
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="font-bold text-slate-700 text-[11px]">Export Format</Label>
                    <Select value={handoverFormat} onValueChange={setHandoverFormat}>
                      <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">Official PDF Report (Formatted)</SelectItem>
                        <SelectItem value="csv">Raw CSV Sheet (Excel / ERP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-xs">Include OT Breakdown</span>
                    <Switch checked={handoverIncludeOT} onCheckedChange={setHandoverIncludeOT} />
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-xs">Include Door Anomalies</span>
                    <Switch checked={handoverIncludeAnomalies} onCheckedChange={setHandoverIncludeAnomalies} />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Personal Privacy & Display ── */}
        <TabsContent value="privacy" className="space-y-4 mt-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Supervisor Personal Privacy Shield & Display
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Personal security toggles for your supervisor account.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 divide-y divide-slate-100 text-xs">
              
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Public Screen Privacy Masking Shield</Label>
                  <p className="text-slate-500 text-[11px]">
                    Auto-blurs your personal net pay, salary, and banking information across dashboard views.
                  </p>
                </div>
                <Switch
                  checked={privacyShield}
                  onCheckedChange={(val) => {
                    setPrivacyShield(val);
                    handleSavePreferences({ privacyShield: val });
                  }}
                />
              </div>

              <div className="pt-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="font-bold text-slate-900 text-xs">Transparency Trail (&quot;Who Viewed My Data?&quot;)</Label>
                  <p className="text-slate-500 text-[11px]">
                    Inspect the audit trail whenever management unmasks your sensitive employee profile data.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-xs h-8"
                >
                  <a href="/profile?tab=transparency">
                    Open Transparency Hub <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                </Button>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
