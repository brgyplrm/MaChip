import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckShieldIcon from '@mui/icons-material/Shield';
import CloseIcon from '@mui/icons-material/Close';
import BlockIcon from '@mui/icons-material/Block';
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import EmptyState from "../../components/EmptyState";
import { Link } from "react-router-dom";
import { ScanLine, ChevronLeft } from "lucide-react";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal"; // Core Scan Session Capture Modal

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TablePagination } from "@/components/ui/table-pagination";

const FingerprintManagement = () => {
  const [biometricList, setBiometricList] = useState([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Multi-step Registration Workflow States
  const [showScanModal, setShowScanModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [scannedSlotId, setScannedSlotId] = useState("");
  const [scannedTemplate, setScannedTemplate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedSlotNumber, setSelectedSlotNumber] = useState("1");
  const [fingerprintError, setFingerprintError] = useState("");
  const [localScannedId, setLocalScannedId] = useState(null); // Added for polling state
  const [localScannedTemplate, setLocalScannedTemplate] = useState(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [sensorFilter, setSensorFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const selectedEmp = useMemo(() => {
    return unassignedEmployees.find(e => e.user_Id.toString() === selectedUserId.toString());
  }, [unassignedEmployees, selectedUserId]);

  const isDuplicateSlot = useMemo(() => {
    if (!selectedEmp || !scannedSlotId) return false;
    const parsedSlot = parseInt(scannedSlotId);
    if (selectedSlotNumber === "2" && selectedEmp.user_FingerprintId && selectedEmp.user_FingerprintId === parsedSlot) return true;
    if (selectedSlotNumber === "1" && selectedEmp.user_FingerprintId2 && selectedEmp.user_FingerprintId2 === parsedSlot) return true;
    return false;
  }, [selectedEmp, scannedSlotId, selectedSlotNumber]);

  const fetchBiometricData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/hardware/biometric/all");
      if (response.ok) {
        const data = await response.json();
        setBiometricList(data);
      }
    } catch (err) {
      console.error("Error fetching biometric data:", err);
      setToast({ message: "Failed to load biometric registry.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnassignedEmployees = useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      const response = await fetchWithAuth("/api/users/unassigned-hardware?type=fingerprint");
      if (response.ok) {
        const data = await response.json();
        setUnassignedEmployees(data);
      }
    } catch (err) {
      console.error("Error fetching unassigned employees:", err);
    } finally {
      setLoadingUnassigned(false);
    }
  }, []);

  useEffect(() => {
    fetchBiometricData();
    fetchUnassignedEmployees();
  }, [fetchBiometricData, fetchUnassignedEmployees]);

  // Refresh unassigned list when modal opens to ensure latest data
  useEffect(() => {
    if (showAssignModal) {
      fetchUnassignedEmployees();
    }
  }, [showAssignModal, fetchUnassignedEmployees]);

  // Step 1: Open Scanner Module & Initialize Registration Session
  const handleStartFingerprintScan = async () => {
    setShowScanModal(true);
    setScannedSlotId("");
    setFingerprintError("");
    setLocalScannedId(null);
    setLocalScannedTemplate(null);
    
    try {
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "temp_reg", type: 'FP' })
      });

      // Poll/Wait for hardware scan
      const response = await fetchWithAuth("/api/users/generateFingerprint");
      const data = await response.json();

      if (response.ok && data.fingerprintId) {
        setLocalScannedId(data.fingerprintId);
        setLocalScannedTemplate(data.template);
      } else if (response.status === 400 && data.error) {
        setFingerprintError(data.error);
        await fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
        await fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
      } else {
        setFingerprintError(data.error || "Failed to scan Fingerprint. Please try again.");
      }
    } catch (err) {
      console.error("Failed to establish biometric handshake session:", err);
      setFingerprintError("An error occurred while communicating with the hardware.");
    }
  };

  // Step 2: Transition from success modal to assign modal
  const handleFingerprintConfirm = async () => {
    const slotId = localScannedId;
    const templateData = localScannedTemplate;

    if (!slotId) return;

    // Clean active tracking hardware hook sessions
    await fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
    await fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});

    setShowScanModal(false);

    // Verify template isn't already assigned in local memory index structures
    const existingTemplate = biometricList.find(b => String(b.fingerprintIndex) === String(slotId));

    if (existingTemplate) {
      setToast({ message: `Slot Address #${slotId} is already held by ${existingTemplate.userName}.`, type: "error" });
      setSearchQuery(`Slot #${slotId}`);
    } else {
      // Transition to assignment overlay modal form
      setScannedSlotId(slotId);
      setScannedTemplate(templateData);
      setSelectedUserId("");
      setShowAssignModal(true);
    }
  };

  // Close scanner and cleanup backend session hooks
  const closeFingerprintModal = () => {
    setShowScanModal(false);
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
    fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
  };

  // Transition to assignment overlay modal form
  const handleSelectEmployee = (val) => {
    setSelectedUserId(val);
    const emp = unassignedEmployees.find(e => e.user_Id.toString() === val.toString());
    if (emp) {
      if (emp.hasSlot1 && !emp.hasSlot2) {
        setSelectedSlotNumber("2");
      } else {
        setSelectedSlotNumber("1");
      }
    }
  };

  // Step 3: Link captured flash matrix slot coordinates to selected workspace profile
  const handleAssignBiometricSubmit = async () => {
    if (!selectedUserId) {
      setToast({ message: "Please choose a workspace target identity.", type: "error" });
      return;
    }

    const selectedEmp = unassignedEmployees.find(e => e.user_Id.toString() === selectedUserId.toString());
    if (selectedEmp) {
      if (selectedSlotNumber === "2" && selectedEmp.user_FingerprintId && selectedEmp.user_FingerprintId === parseInt(scannedSlotId)) {
        setToast({ message: "Fallback fingerprint cannot use the same slot or finger as the Primary fingerprint.", type: "error" });
        return;
      }
      if (selectedSlotNumber === "1" && selectedEmp.user_FingerprintId2 && selectedEmp.user_FingerprintId2 === parseInt(scannedSlotId)) {
        setToast({ message: "Primary fingerprint cannot use the same slot or finger as the Fallback fingerprint.", type: "error" });
        return;
      }
    }

    setAssigning(true);
    try {
      const response = await fetchWithAuth("/api/hardware/biometric/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_Id: selectedUserId, 
          fingerprintIndex: parseInt(scannedSlotId),
          fingerprintTemplate: scannedTemplate,
          slotNumber: parseInt(selectedSlotNumber) || 1
        })
      });

      if (response.ok) {
        setToast({ message: `Biometric Profile assigned to index position #${scannedSlotId}!`, type: "success" });
        setShowAssignModal(false);
        fetchBiometricData();
        fetchUnassignedEmployees();
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to commit flash memory map.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Module boundary communication timed out.", type: "error" });
    } finally {
      setAssigning(false);
    }
  };

  const handleClearTemplate = async (userId, slotId, slotNumber) => {
    if (!window.confirm(`Clear scanner slot matrix index #${slotId} for this user?`)) return;
    try {
      const url = slotNumber ? `/api/hardware/biometric/clear/${userId}?slotNumber=${slotNumber}` : `/api/hardware/biometric/clear/${userId}`;
      const response = await fetchWithAuth(url, { method: "DELETE" });
      if (response.ok) {
        setToast({ message: "Biometric node deleted from flash cache slot.", type: "success" });
        fetchBiometricData();
        fetchUnassignedEmployees();
      }
    } catch (err) {
      setToast({ message: "Could not access peripheral module controllers.", type: "error" });
    }
  };

  // Stats Calculations
  const stats = useMemo(() => {
    return {
      registered: biometricList.filter(b => b.fingerprintIndex !== null).length,
      availableSlots: 1000 - biometricList.length // R307 flash memory supports up to 1,000 templates
    };
  }, [biometricList]);

  // Filters
  const filteredData = useMemo(() => {
    return biometricList.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.userName?.toLowerCase().includes(query) || 
        formatUserId(item.user_Id).toLowerCase().includes(query);

      const matchesSensor = sensorFilter === "All" || item.sensorNode === sensorFilter;
      return matchesSearch && matchesSensor;
    });
  }, [biometricList, searchQuery, sensorFilter]);

  // Pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredData.slice(startIndex, endIndex);

  return (
    <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header Section with Hover-Back Button */}
          <div className="group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 transition-all">
            <div className="flex items-center gap-0">
              {/* Back Button: Hidden by default, slides and fades in on hover */}
              <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  asChild 
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-brand-primary"
                >
                  <Link to="/users">
                    <ChevronLeft className="h-6 w-6" />
                  </Link>
                </Button>
              </div>
              
              {/* Title: Adds left padding when hovered */}
              <div className="transition-all duration-300 ease-in-out group-hover:pl-2">
                <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">Biometric Fingerprint Registry</h1>
                <span className="text-sm text-slate-500 mt-1 block">Audit device memory allocations, flash signatures, and biometric slot maps.</span>
              </div>
            </div>
            
            <Button onClick={handleStartFingerprintScan} className="bg-brand-primary hover:bg-[#7A52B5] font-bold shadow-sm gap-2">
              <ScanLine className="h-4 w-4 text-white" />
              <span>Enroll Fingerprint</span>
            </Button>
          </div>

        {/* Statistics Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="border-t-5 border-brand-primary bg-white py-0">
            <CardContent className="px-5 py-5 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Enrolled Templates</p>
                <p className="text-3xl font-bold text-brand-primary">{stats.registered} <span className="text-sm opacity-60">Matrix IDs</span></p>
              </div>
              <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg"><FingerprintIcon /></div>
            </CardContent>
          </Card>

          <Card className="border-t-5 border-status-info bg-white py-0">
            <CardContent className="px-5 py-5 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Available Memory Capacity</p>
                <p className="text-3xl font-bold text-status-info">{stats.availableSlots} <span className="text-sm opacity-60">Slots Left</span></p>
              </div>
              <div className="bg-status-info/10 text-status-info p-3 rounded-lg"><MemoryIcon /></div>
            </CardContent>
          </Card>
        </div>

        {/* Workspace Filters */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search employee name or system ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Master Registry Table */}
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          <CardContent className="p-0  flex flex-col">
            <Table>
              <TableHeader className="bg-brand-primary">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white font-bold py-4 px-6 uppercase text-xs tracking-wider">Employee Profile</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">Module Memory Address ID</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">Scanner Endpoint Node</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((row) => (
                    <TableRow key={`${row.user_Id}-${row.slotNumber || 1}-${row.fingerprintIndex}`} className="border-b-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-bold text-brand-primary text-sm">{row.userName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{formatUserId(row.user_Id)}</p>
                          </div>
                          {row.fingerprintType && (
                            <Badge variant="outline" className={`text-[10px] ml-1 font-semibold ${row.slotNumber === 2 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                              {row.fingerprintType}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-bold text-slate-700">
                        Slot #{row.fingerprintIndex ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 flex items-center w-max gap-1">
                          <CheckShieldIcon className="h-3 w-3" /> Secure Node 01
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="outline" size="sm" onClick={() => handleClearTemplate(row.user_Id, row.fingerprintIndex, row.slotNumber)} className="border-red-200 text-red-600 hover:bg-red-50">
                          <BlockIcon className="h-3.5 w-3.5 mr-1" /> Wipe Slot
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="p-6 border-0">
                      <EmptyState icon={<FingerprintIcon className="h-8 w-8 text-slate-300" />} title="No biometric maps active" description="No registered fingerprint nodes currently reside within hardware configuration filters." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="profiles"
            />
          </CardContent>
        </Card>
      </div>

      {/* STEP 1: Biometric Hardware Scanning Polling Interceptor Modal */}
      <RfidScanModal 
        isOpen={showScanModal} 
        onClose={closeFingerprintModal} 
        onConfirm={handleFingerprintConfirm}
        onRescan={handleStartFingerprintScan}
        scannedId={localScannedId}
        error={fingerprintError}
        title="Fingerprint Scanner"
      />

      {/* STEP 2: Assign Scanned Biometric Template ID Modal Form */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-[460px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
          <DialogHeader className="bg-brand-primary text-white p-6 relative">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FingerprintIcon className="h-5 w-5 text-purple-300" /> Link Biometric Template
            </DialogTitle>
            <DialogDescription className="text-purple-200 text-xs mt-1">
              Reassign captured optical characteristic signatures into a secure profile index slot.
            </DialogDescription>
            <button onClick={() => setShowAssignModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors focus:outline-none">
              <CloseIcon className="h-5 w-5" />
            </button>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Captured Device Parameters */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Allocated Flash Registry Memory Index</Label>
              <div className="font-mono text-sm font-black text-brand-primary bg-white border border-slate-200 rounded-lg p-3 tracking-widest shadow-sm">
                Slot Pool Location #{scannedSlotId}
              </div>
            </div>

            {/* Target Variable Selection Dropdown */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Assign Target Employee Profile</Label>
              <Select value={selectedUserId} onValueChange={handleSelectEmployee}>
                <SelectTrigger className="w-full h-12 bg-white border-slate-200 rounded-lg focus:ring-brand-primary">
                  <SelectValue placeholder="Select an unassigned employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {loadingUnassigned ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic animate-pulse">
                      Searching for unassigned profiles...
                    </div>
                  ) : unassignedEmployees.length > 0 ? (
                    unassignedEmployees.map((emp) => (
                      <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                        {emp.user_FirstName} {emp.user_LastName} ({formatUserId(emp.user_Id)}) {emp.hasSlot1 ? "• Secondary Fallback" : "• Primary"}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 italic">
                      All employees currently contain assigned biometric references.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Fingerprint Slot Selection */}
            {selectedUserId && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Fingerprint Role / Slot</Label>
                <Select value={selectedSlotNumber} onValueChange={setSelectedSlotNumber}>
                  <SelectTrigger className="w-full h-11 bg-white border-slate-200 rounded-lg">
                    <SelectValue placeholder="Select Slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Primary Fingerprint (Slot 1)</SelectItem>
                    <SelectItem value="2">Secondary Fallback Fingerprint (Slot 2)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400 italic">
                  Secondary fallback allows employees with worn or injured primary fingers to authenticate seamlessly.
                </p>
              </div>
            )}

            {isDuplicateSlot && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
                <BlockIcon className="h-4 w-4 text-red-500 shrink-0" />
                <span>
                  Slot #{scannedSlotId} is already assigned as this employee's {selectedSlotNumber === "2" ? "Primary" : "Fallback"} fingerprint. Fallback must be a different finger.
                </span>
              </div>
            )}

            {/* Modal Navigation Links */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-11 border-slate-200 text-slate-500 rounded-lg font-bold" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssignBiometricSubmit}
                disabled={assigning || !selectedUserId || isDuplicateSlot}
                className="flex-1 h-11 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg font-bold shadow-md tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? "Allocating Flash..." : "Link Biometric Profile"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
};

export default FingerprintManagement;