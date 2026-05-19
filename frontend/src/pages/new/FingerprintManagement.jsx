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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ScanLine } from "lucide-react";
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

const FingerprintManagement = () => {
  const [biometricList, setBiometricList] = useState([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Multi-step Registration Workflow States
  const [showScanModal, setShowScanModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [scannedSlotId, setScannedSlotId] = useState("");
  const [scannedTemplate, setScannedTemplate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [fingerprintError, setFingerprintError] = useState("");

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [sensorFilter, setSensorFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch biometric records registry
  const fetchBiometricData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/hardware/biometric/all");
      if (response.ok) {
        const data = await response.json();
        setBiometricList(data);
      }
    } catch (err) {
      console.error("Error connecting to hardware database:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch employees without assigned fingerprint IDs
  const fetchUnassignedEmployees = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/users/unassigned-hardware?type=fingerprint");
      if (response.ok) {
        const data = await response.json();
        setUnassignedEmployees(data);
      }
    } catch (err) {
      console.error("Error loading unassigned users:", err);
    }
  }, []);

  useEffect(() => {
    fetchBiometricData();
    fetchUnassignedEmployees();
  }, [fetchBiometricData, fetchUnassignedEmployees]);

  // Step 1: Open Scanner Module & Initialize Registration Session
  const handleStartFingerprintScan = async () => {
    setShowScanModal(true);
    setScannedSlotId("");
    setFingerprintError("");
    
    try {
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "temp_reg", type: 'FP' })
      });
    } catch (err) {
      console.error("Failed to establish biometric handshake session:", err);
    }
  };

  // Step 2: Triggered on successful capture from the AS608 peripheral sensor module
  const handleFingerprintScanned = async (data) => {
    // If the scanner passes an object containing index variables
    const slotId = data?.fingerprintId || data;
    const templateData = data?.template || "";

    if (!slotId) {
      setFingerprintError("Invalid slot response received from terminal.");
      return;
    }

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
      // Transition to assignment overlay modal form matching reference card
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

  // Step 3: Link captured flash matrix slot coordinates to selected workspace profile
  const handleAssignBiometricSubmit = async () => {
    if (!selectedUserId) {
      setToast({ message: "Please choose a workspace target identity.", type: "error" });
      return;
    }
    setAssigning(true);
    try {
      const response = await fetchWithAuth("/api/hardware/biometric/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          user_Id: selectedUserId, 
          fingerprintIndex: parseInt(scannedSlotId),
          fingerprintTemplate: scannedTemplate
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

  const handleClearTemplate = async (userId, slotId) => {
    if (!window.confirm(`Clear scanner slot matrix index #${slotId} for this user?`)) return;
    try {
      const response = await fetchWithAuth(`/api/hardware/biometric/clear/${userId}`, { method: "DELETE" });
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
      availableSlots: 127 - biometricList.length // AS608 flash memory constraints up to 127 templates
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
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link 
              to="/users" 
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 text-[#2A174E] transition-colors"
            >
              <ArrowBackIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Biometric Fingerprint Registry</h1>
              <span className="text-sm text-slate-500 mt-1 block">Audit device memory allocations, flash signatures, and biometric slot maps.</span>
            </div>
          </div>
          <Button 
            onClick={handleStartFingerprintScan} 
            className="bg-[#2A174E] hover:bg-[#1a0e30] font-bold shadow-sm gap-2"
          >
            <ScanLine className="h-4 w-4 text-white" />
            <span>Enroll Fingerprint</span>
          </Button>
        </div>

        {/* Statistics Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="border-t-5 border-[#2A174E] bg-white py-0">
            <CardContent className="px-5 py-5 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Enrolled Templates</p>
                <p className="text-3xl font-bold text-[#2A174E]">{stats.registered} <span className="text-sm opacity-60">Matrix IDs</span></p>
              </div>
              <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg"><FingerprintIcon /></div>
            </CardContent>
          </Card>

          <Card className="border-t-5 border-blue-600 bg-white py-0">
            <CardContent className="px-5 py-5 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Available Memory Capacity</p>
                <p className="text-3xl font-bold text-blue-700">{stats.availableSlots} <span className="text-sm opacity-60">Slots Left</span></p>
              </div>
              <div className="bg-blue-50 text-blue-600 p-3 rounded-lg"><MemoryIcon /></div>
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
              <TableHeader className="bg-[#2A174E]">
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
                    <TableRow key={row.user_Id} className="border-b-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4">
                        <p className="font-bold text-[#2A174E] text-sm">{row.userName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{formatUserId(row.user_Id)}</p>
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
                        <Button variant="outline" size="sm" onClick={() => handleClearTemplate(row.user_Id, row.fingerprintIndex)} className="border-red-200 text-red-600 hover:bg-red-50">
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
            <div className="flex items-center justify-between p-4 bg-slate-50/30 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">Showing {startIndex + 1} to {endIndex} of {totalItems} profiles</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
                <div className="h-8 w-8 flex items-center justify-center bg-[#2A174E] text-white rounded text-xs font-bold">{currentPage}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STEP 1: Biometric Hardware Scanning Polling Interceptor Modal */}
      <RfidScanModal 
        isOpen={showScanModal} 
        onClose={closeFingerprintModal} 
        onScanSuccess={handleFingerprintScanned}
        error={fingerprintError}
        title="Fingerprint Scanner"
      />

      {/* STEP 2: Assign Scanned Biometric Template ID Modal Form */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-[460px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
          <DialogHeader className="bg-[#2A174E] text-white p-6 relative">
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
              <div className="font-mono text-sm font-black text-[#2A174E] bg-white border border-slate-200 rounded-lg p-3 tracking-widest shadow-sm">
                Slot Pool Location #{scannedSlotId}
              </div>
            </div>

            {/* Target Variable Selection Dropdown */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Assign Target Employee Profile</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full h-12 bg-white border-slate-200 rounded-lg focus:ring-[#2A174E]">
                  <SelectValue placeholder="Select an unassigned employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {unassignedEmployees.length > 0 ? (
                    unassignedEmployees.map((emp) => (
                      <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>
                        {emp.user_FirstName} {emp.user_LastName} ({formatUserId(emp.user_Id)})
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

            {/* Modal Navigation Links */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-11 border-slate-200 text-slate-500 rounded-lg font-bold" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssignBiometricSubmit}
                disabled={assigning || !selectedUserId}
                className="flex-1 h-11 bg-[#2A174E] hover:bg-[#1a0e30] text-white rounded-lg font-bold shadow-md tracking-wide"
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