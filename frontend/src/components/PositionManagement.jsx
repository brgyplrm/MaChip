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
  Plus, Edit, Trash2, Save, X, AlertTriangle, Briefcase 
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
      const newData = { ...prev, [name]: value };
      
      // Auto-calculate daily rate if monthly pay changes
      if (name === "baseMonthlyPay") {
        const monthly = sanitizeNumber(value);
        newData.baseDailyRate = monthly > 0 ? (monthly / 26).toFixed(2) : ""; // Assuming 26 working days
      } else if (name === "baseDailyRate") {
        const daily = sanitizeNumber(value);
        newData.baseMonthlyPay = daily > 0 ? (daily * 26).toFixed(2) : "";
      }
      
      return newData;
    });
  };

  const handleEdit = (pos) => {
    setEditingId(pos.positionId);
    setFormData({
      title: pos.title,
      department: pos.department,
      baseMonthlyPay: pos.baseMonthlyPay,
      baseDailyRate: pos.baseDailyRate
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
      <Card className="border-0 shadow-sm bg-gradient-to-r from-[#2A174E] to-[#3d2270] text-white">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full border border-white/20">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <div className="min-w-[200px]">
              <p className="text-sm font-bold text-purple-200 uppercase tracking-widest leading-none mb-1">Mandated Basic Rate</p>
              {isEditingWage ? (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-300">₱</span>
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
                        className="bg-white/10 border-white/20 text-white pl-6 w-32 font-bold text-xl h-10"
                        autoFocus
                      />
                    </div>
                    <Input 
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="bg-white/10 border-white/20 text-white w-40 font-semibold h-10 [color-scheme:dark]"
                    />
                    <Button size="sm" onClick={handleSaveWage} disabled={savingWage} className="bg-amber-500 hover:bg-amber-600 text-white h-10">
                      {savingWage ? "..." : <Save className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { 
                      setMandatedWage(initialWage); 
                      setEffectiveDate(initialDate);
                      setIsEditingWage(false); 
                    }} className="text-white hover:bg-white/10 h-10">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black tracking-tight">₱{parseFloat(mandatedWage).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                  <Button variant="ghost" size="icon" onClick={() => setIsEditingWage(true)} className="text-purple-300 hover:text-white hover:bg-white/10 h-8 w-8">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-purple-200/60 font-medium italic mt-1">
                As of {formatDateLabel(effectiveDate)} from BIR/DOLE
              </p>
            </div>
          </div>
          <div className="hidden lg:block h-12 w-[1px] bg-white/10 mx-4"></div>
          <div className="text-center md:text-left">
            <p className="text-[10px] font-bold uppercase text-purple-300 tracking-wider">Compliance Status</p>
            <p className="text-sm font-medium">
              System is monitoring {positions.length} templates against this baseline.
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
                className="bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-500">Department</Label>
              <Input 
                name="department"
                placeholder="e.g. Operations"
                value={formData.department}
                onChange={handleInputChange}
                className="bg-white"
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
                  className="bg-white pl-7 font-mono"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button 
                onClick={handleSave}
                className="bg-[#2A174E] hover:bg-[#3d2270] text-white flex-1"
                disabled={!formData.title || !formData.department}
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
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleEdit(pos)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
