import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "../utils/api";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Edit, Trash2, Save, X, AlertTriangle, Briefcase, Edit3 
} from "lucide-react";

const PositionManagement = ({ 
  mandatedMinimumWage: initialWage, 
  setMandatedMinimumWage,
  mandatedWageEffectiveDate: initialDate,
  setMandatedWageEffectiveDate
}) => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [mandatedWage, setMandatedWage] = useState(initialWage || 610);
  const [effectiveDate, setEffectiveDate] = useState(initialDate || "2025-07-18");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingWage, setIsEditingWage] = useState(false);
  const [savingWage, setSavingWage] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    baseMonthlyPay: "",
    baseDailyRate: ""
  });

  useEffect(() => {
    fetchPositions();
  }, []);

  useEffect(() => {
    setMandatedWage(initialWage);
    if (initialDate) setEffectiveDate(initialDate);
  }, [initialWage, initialDate]);

  const handleSaveWage = async () => {
    setSavingWage(true);
    try {
      const sanitizedWage = sanitizeNumber(mandatedWage);
      const response = await fetchWithAuth("/api/system/mandated-wage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          mandatedMinimumWage: sanitizedWage,
          mandatedWageEffectiveDate: effectiveDate
        })
      });
      if (response.ok) {
        setIsEditingWage(false);
        // Sync with parent state
        if (setMandatedMinimumWage) setMandatedMinimumWage(sanitizedWage);
        if (setMandatedWageEffectiveDate) setMandatedWageEffectiveDate(effectiveDate);
      }
    } catch (error) {
      console.error("Error saving mandated wage:", error);
    } finally {
      setSavingWage(false);
    }
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };


  const fetchPositions = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/positions");
      if (response.ok) {
        const data = await response.json();
        setPositions(data);
      }
    } catch (error) {
      console.error("Error fetching positions:", error);
    } finally {
      setLoading(false);
    }
  };

  const sanitizeNumber = (val) => {
    if (typeof val === "string") {
      return parseFloat(val.replace(/,/g, "")) || 0;
    }
    return parseFloat(val) || 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate daily rate if monthly pay changes
      if (name === "baseMonthlyPay") {
        const num = sanitizeNumber(value);
        if (num > 0) {
          updated.baseDailyRate = ((num * 12) / 313).toFixed(2);
        }
      } else if (name === "baseDailyRate") {
        const daily = sanitizeNumber(value);
        updated.baseMonthlyPay = daily > 0 ? (daily * 26).toFixed(2) : "";
      }
      
      return updated;
    });
  };

  const handleEdit = (pos) => {
    setIsEditing(true);
    setEditingId(pos.positionId);
    setFormData({
      title: pos.title,
      department: pos.department,
      baseMonthlyPay: pos.baseMonthlyPay || "",
      baseDailyRate: pos.baseDailyRate || ""
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      title: "",
      department: "",
      baseMonthlyPay: "",
      baseDailyRate: ""
    });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.department) return;

    try {
      const url = editingId ? `/api/positions/${editingId}` : "/api/positions";
      const method = editingId ? "PUT" : "POST";

      const payload = {
        ...formData,
        baseMonthlyPay: sanitizeNumber(formData.baseMonthlyPay),
        baseDailyRate: sanitizeNumber(formData.baseDailyRate)
      };

      const response = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        fetchPositions();
        handleCancel();
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error saving position:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this position template?")) return;

    try {
      const response = await fetchWithAuth(`/api/positions/${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        fetchPositions();
      }
    } catch (error) {
      console.error("Error deleting position:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card matching PayrollConfiguration */}
      <div className="bg-[#2A1B4E] text-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-white/10 rounded-lg border border-white/10">
            <Briefcase className="w-6 h-6 text-purple-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Salary Grades & Position Configuration</h1>
            <p className="text-sm text-purple-200/80 mt-0.5">Manage position templates, base daily rates, and mandated minimum wage</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {isEditing ? (
            <>
              <button 
                type="button"
                onClick={() => {
                  setMandatedWage(initialWage);
                  setEffectiveDate(initialDate);
                  setIsEditingWage(false);
                  handleCancel();
                  setIsEditing(false);
                }}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg text-sm font-medium shadow-sm transition"
              >
                <X className="w-4 h-4" /> <span>Cancel</span>
              </button>
              <button 
                type="button"
                onClick={async () => {
                  if (isEditingWage) {
                    await handleSaveWage();
                  }
                  if (editingId) {
                    await handleSave();
                  }
                  setIsEditing(false);
                }}
                disabled={savingWage}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> <span>{savingWage ? "Saving..." : "Save Changes"}</span>
              </button>
            </>
          ) : (
            <button 
              type="button"
              onClick={() => {
                setIsEditing(true);
                setIsEditingWage(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-lg text-sm font-medium shadow-sm transition"
            >
              <Edit3 className="w-4 h-4" /> <span>Edit Configuration</span>
            </button>
          )}
        </div>
      </div>

      <Card className="border border-purple-100 shadow-sm bg-gradient-to-br from-[#FAF5FF] via-white to-[#FAF2FF] text-slate-800">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100/80 rounded-full border border-purple-200 shadow-xs shrink-0">
              <AlertTriangle className="w-6 h-6 text-[#2A174E]" />
            </div>
            <div className="min-w-[200px]">
              <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider leading-none mb-1.5">Mandated Basic Rate</p>
              {isEditingWage && isEditing ? (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₱</span>
                      <Input 
                        type="text"
                        inputMode="decimal"
                        value={(mandatedWage || "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, '');
                          if (raw === '' || raw === '.' || !isNaN(raw)) {
                            setMandatedWage(raw);
                          }
                        }}
                        className="bg-white border-slate-300 text-[#2A174E] pl-7 w-32 font-bold text-xl h-10 shadow-xs focus:border-purple-500 focus:ring-purple-200"
                        autoFocus
                      />
                    </div>
                    <Input 
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="bg-white border-slate-300 text-slate-700 w-44 font-semibold h-10 shadow-xs focus:border-purple-500 focus:ring-purple-200"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black tracking-tight text-[#2A174E]">₱{parseFloat(mandatedWage || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setIsEditing(true);
                      setIsEditingWage(true);
                    }} 
                    className="text-purple-700/70 hover:text-purple-900 hover:bg-purple-100/80 h-8 w-8 rounded-lg transition"
                    title="Edit Mandated Rate"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-slate-500 font-medium mt-1">
                As of <span className="font-semibold text-slate-700">{formatDateLabel(effectiveDate)}</span> from BIR/DOLE
              </p>
            </div>
          </div>
          <div className="hidden lg:block h-12 w-[1px] bg-purple-200/80 mx-4"></div>
          <div className="text-center md:text-left">
            <p className="text-[11px] font-bold uppercase text-[#2A174E] tracking-wider mb-1">Compliance Status</p>
            <p className="text-sm font-medium text-slate-600">
              System is monitoring <span className="font-bold text-[#2A174E]">{positions.length}</span> templates against this baseline.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 shadow-sm bg-white pt-4">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg text-[#2A174E] flex items-center gap-2 font-bold">
            <Briefcase className="text-[#2A174E]" /> Position Templates & Salary Grades
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Position Title</Label>
              <Input 
                name="title"
                placeholder="e.g. Logistics Staff"
                value={formData.title}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Department</Label>
              <Input 
                name="department"
                placeholder="e.g. Operations"
                value={formData.department}
                onChange={handleInputChange}
                disabled={!isEditing}
                className="bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Base Daily Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₱</span>
                <Input 
                  name="baseDailyRate"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={(formData.baseDailyRate || "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  onChange={(e) => {
                    const { name, value } = e.target;
                    const raw = value.replace(/,/g, '');
                    if (raw === '' || raw === '.' || !isNaN(raw)) {
                      handleInputChange({ target: { name, value: raw } });
                    }
                  }}
                  onBlur={(e) => {
                    const { name, value } = e.target;
                    handleInputChange({ target: { name, value: parseFloat(value.replace(/,/g, '')) || 0 } });
                  }}
                  disabled={!isEditing}
                  className="bg-white pl-7 font-mono disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button 
                onClick={handleSave}
                className="bg-[#2A174E] hover:bg-[#3d2270] text-white flex-1 disabled:opacity-50"
                disabled={!isEditing || !formData.title || !formData.department}
              >
                {editingId ? <><Save className="w-4 h-4 mr-2" /> Update</> : <><Plus className="w-4 h-4 mr-2" /> Add Template</>}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold text-[#2A174E]">Position Title</TableHead>
                  <TableHead className="font-bold text-[#2A174E]">Department</TableHead>
                  <TableHead className="font-bold text-[#2A174E]">Daily Rate</TableHead>
                  <TableHead className="font-bold text-[#2A174E]">Status</TableHead>
                  <TableHead className="text-right font-bold text-[#2A174E]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400 italic">
                      Loading position templates...
                    </TableCell>
                  </TableRow>
                ) : positions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400 italic">
                      No position templates defined.
                    </TableCell>
                  </TableRow>
                ) : (
                  positions.map((pos) => {
                    const isBelowMin = parseFloat(pos.baseDailyRate) < mandatedWage;
                    return (
                      <TableRow key={pos.positionId} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-semibold text-slate-700">{pos.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-medium">
                            {pos.department}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-slate-600">
                          ₱{parseFloat(pos.baseDailyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {isBelowMin ? (
                            <Badge variant="destructive" className="flex w-fit items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                              <AlertTriangle className="w-3 h-3" /> Below Min (₱{mandatedWage})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-100">
                              Compliant
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              disabled={!isEditing}
                              onClick={() => handleEdit(pos)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                              disabled={!isEditing}
                              onClick={() => handleDelete(pos.positionId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PositionManagement;
