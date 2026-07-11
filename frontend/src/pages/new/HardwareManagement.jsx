import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ContactlessIcon from '@mui/icons-material/Contactless';
import SensorsIcon from '@mui/icons-material/Sensors';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckShieldIcon from '@mui/icons-material/Shield';
import BlockIcon from '@mui/icons-material/Block';
import CloseIcon from '@mui/icons-material/Close';
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import EmptyState from "../../components/EmptyState";
import { Link } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ScanLine, AlertTriangle } from "lucide-react";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const HardwareManagement = () => {
  const [activeTab, setActiveTab] = useState("rfid");
  const [rfidList, setRfidList] = useState([]);
  const [biometricList, setBiometricList] = useState([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Modal Workflow States
  const [showScanModal, setShowScanModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  
  // Scanned Data
  const [scannedId, setScannedId] = useState(""); // Can be UID or Slot ID
  const [scannedTemplate, setScannedTemplate] = useState("");
  const [localScannedId, setLocalScannedId] = useState(null);
  const [localScannedTemplate, setLocalScannedTemplate] = useState(null);
  const [scanError, setScanError] = useState("");
  
  // Selection/Targets
  const [selectedUserId, setSelectedUserId] = useState("");
  const [revokeTarget, setRevokeTarget] = useState(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [memoryIdFilter, setMemoryIdFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchRfidData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/hardware/rfid/all");
      if (response.ok) {
        const data = await response.json();
        setRfidList(data);
      }
    } catch (err) {
      console.error("Error fetching RFID data:", err);
      setToast({ message: "Failed to load RFID registry.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

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
      const response = await fetchWithAuth(`/api/users/unassigned-hardware?type=${activeTab}`);
      if (response.ok) {
        const data = await response.json();
        setUnassignedEmployees(data);
      } else if (activeTab === 'rfid') {
        const errText = await response.text();
        console.error("API Error fetching unassigned employees:", response.status, errText);
        setToast({ message: `Access Error (${response.status}): You may need to restart the backend server.`, type: "error" });
      }
    } catch (err) {
      console.error("Error fetching unassigned employees:", err);
      if (activeTab === 'rfid') {
        setToast({ message: "Network error fetching unassigned employees.", type: "error" });
      }
    } finally {
      setLoadingUnassigned(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "rfid") fetchRfidData();
    else fetchBiometricData();
    fetchUnassignedEmployees();
  }, [activeTab, fetchRfidData, fetchBiometricData, fetchUnassignedEmployees]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, memoryIdFilter, selectedDate, activeTab]);

  // ── Hardware Operations ──────────────────────────────────────────────────

  const handleStartScan = async () => {
    setScanError("");
    setLocalScannedId(null);
    setLocalScannedTemplate(null);
    setShowScanModal(true);
    
    try {
      // 1. Initiate capture session on server
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeTab === 'rfid' ? "rfid" : 'FP', userId: "temp_reg" })
      });

      // 2. Poll/Wait for hardware scan
      const endpoint = activeTab === 'rfid' ? "/api/users/generateRfid" : "/api/users/generateFingerprint";
      const response = await fetchWithAuth(endpoint);
      const data = await response.json();

      if (response.ok) {
        if (activeTab === 'rfid' && data.rfid) {
          setLocalScannedId(data.rfid);
        } else if (activeTab === 'fingerprint' && data.fingerprintId) {
          setLocalScannedId(data.fingerprintId);
          setLocalScannedTemplate(data.template);
        }
      } else if (response.status === 400 && data.rfid && activeTab === 'rfid') {
        setLocalScannedId(data.rfid);
        setScanError(data.error || "This card is already assigned to another user.");
      } else if (response.status === 400 && activeTab === 'fingerprint') {
        setScanError(data.error);
        await fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
        await fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
      } else {
        setScanError(data.error || `Failed to scan ${activeTab.toUpperCase()}. Please try again.`);
        if (activeTab === 'rfid' && data.rfid) setLocalScannedId(data.rfid);
      }
    } catch (err) {
      console.error(`${activeTab.toUpperCase()} Scan Error:`, err);
      setScanError("An error occurred while communicating with hardware.");
    }
  };

  const handleCloseScanModal = () => {
    setShowScanModal(false);
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
    if (activeTab === 'fingerprint') {
      fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
    }
  };

  const handleScanConfirm = () => {
    if (!localScannedId) return;

    // Cleanup sessions
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
    if (activeTab === 'fingerprint') {
      fetchWithAuth("/api/users/clear-fingerprint-session", { method: "DELETE" }).catch(() => {});
    }

    setShowScanModal(false);
    
    // Duplicate Check
    const uid = localScannedId;
    if (activeTab === 'rfid') {
      const existing = rfidList.find(r => r.machip_id?.toLowerCase() === uid.toLowerCase());
      if (existing) {
        setToast({ message: `Card ${uid} is already linked to ${existing.userName}.`, type: "error" });
        setSearchQuery(uid);
        return;
      }
    } else {
      const existing = biometricList.find(b => String(b.fingerprintIndex) === String(uid));
      if (existing) {
        setToast({ message: `Slot Address #${uid} is already held by ${existing.userName}.`, type: "error" });
        setSearchQuery(`Slot #${uid}`);
        return;
      }
    }

    // Advance to Assignment
    setScannedId(uid);
    if (activeTab === 'fingerprint') setScannedTemplate(localScannedTemplate);
    setSelectedUserId("");
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedUserId) {
      setToast({ message: "Please select an employee to link.", type: "error" });
      return;
    }
    setAssigning(true);
    try {
      const endpoint = activeTab === 'rfid' ? "/api/hardware/rfid/assign" : "/api/hardware/biometric/assign";
      const body = activeTab === 'rfid' 
        ? { user_Id: selectedUserId, machip_id: scannedId }
        : { user_Id: selectedUserId, fingerprintIndex: parseInt(scannedId), fingerprintTemplate: scannedTemplate };

      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setToast({ message: "Hardware alignment applied successfully!", type: "success" });
        setShowAssignModal(false);
        if (activeTab === 'rfid') fetchRfidData(); else fetchBiometricData();
        fetchUnassignedEmployees();
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to update record.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error during assignment.", type: "error" });
    } finally {
      setAssigning(false);
    }
  };

  // ── Revocation Logic ─────────────────────────────────────────────────────

  const handleRevokeClick = (target) => {
    setRevokeTarget(target);
    setShowRevokeModal(true);
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const endpoint = activeTab === 'rfid' 
        ? `/api/hardware/rfid/revoke/${revokeTarget.user_Id}`
        : `/api/hardware/biometric/clear/${revokeTarget.user_Id}`;
      
      const response = await fetchWithAuth(endpoint, { method: activeTab === 'rfid' ? "PUT" : "DELETE" });
      if (response.ok) {
        setToast({ message: `${activeTab === 'rfid' ? 'RFID' : 'Biometric'} unlinked successfully.`, type: "success" });
        setShowRevokeModal(false);
        setRevokeTarget(null);
        if (activeTab === 'rfid') fetchRfidData(); else fetchBiometricData();
        fetchUnassignedEmployees();
      } else {
        setToast({ message: "Failed to revoke access.", type: "error" });
      }
    } catch (err) {
      console.error("Revoke Error:", err);
      setToast({ message: "Failed to update hardware credentials.", type: "error" });
    } finally {
      setRevoking(false);
    }
  };

  // ── Filtering & Stats ────────────────────────────────────────────────────

  const uniqueMemoryIds = useMemo(() => {
    const ids = biometricList
      .map(b => b.fingerprintIndex)
      .filter(id => id !== null && id !== undefined);
    return [...new Set(ids)].sort((a, b) => a - b);
  }, [biometricList]);

  const filteredData = useMemo(() => {
    const list = activeTab === 'rfid' ? rfidList : biometricList;
    return list.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.userName?.toLowerCase().includes(query) || 
        (activeTab === 'rfid' && item.machip_id?.toLowerCase().includes(query)) ||
        formatUserId(item.user_Id).toLowerCase().includes(query);

      if (activeTab === 'rfid') {
        const matchesStatus = statusFilter === "All" || item.hardwareStatus === statusFilter;
        let matchesDate = true;
        if (selectedDate) {
          const alignedDateRaw = item.dateAligned;
          if (alignedDateRaw) {
            try {
              const alignedDate = new Date(alignedDateRaw).toISOString().split('T')[0];
              matchesDate = alignedDate === selectedDate;
            } catch (e) { matchesDate = false; }
          } else matchesDate = false;
        }
        return matchesSearch && matchesStatus && matchesDate;
      } else {
        const matchesMemoryId = memoryIdFilter === "All" || (item.fingerprintIndex !== null && item.fingerprintIndex !== undefined && item.fingerprintIndex.toString() === memoryIdFilter);
        return matchesSearch && matchesMemoryId;
      }
    });
  }, [activeTab, rfidList, biometricList, searchQuery, statusFilter, memoryIdFilter, selectedDate]);

  const stats = useMemo(() => {
    if (activeTab === 'rfid') {
      return {
        total: rfidList.filter(r => r.machip_id).length,
        unassigned: unassignedEmployees.length,
        icon: <CreditCardIcon />,
        color: "bg-[#2A174E]"
      };
    } else {
      return {
        total: biometricList.filter(b => b.fingerprintIndex !== null).length,
        unassigned: unassignedEmployees.length,
        icon: <FingerprintIcon />,
        color: "bg-[#2A174E]"
      };
    }
  }, [activeTab, rfidList, biometricList, unassignedEmployees]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredData.slice(startIndex, endIndex);

  const isFiltering = searchQuery !== "" || statusFilter !== "All" || memoryIdFilter !== "All" || selectedDate !== "";

  // ── Render ───────────────────────────────────────────────────────────────

  const PageSkeleton = () => (
    <div className="space-y-6 w-full h-screen">
      <div className="h-16 w-full bg-slate-100 animate-pulse rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-32 w-full bg-slate-100 animate-pulse rounded-xl" />
        <div className="h-32 w-full bg-slate-100 animate-pulse rounded-xl" />
      </div>
      <div className="h-20 w-full bg-slate-100 animate-pulse rounded-xl" />
      <div className="h-96 w-full bg-slate-100 animate-pulse rounded-xl" />
    </div>
  );

  return (
    <Sidebar>
      <TooltipProvider>
        <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {loading && currentData.length === 0 ? <PageSkeleton /> : (
          <>
            {/* Header */}
            <div className="group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 transition-all">
              <div className="flex items-center gap-0">
                <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button variant="ghost" size="icon" asChild className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#2A174E]">
                          <Link to="/users"><ArrowBackIcon className="h-6 w-6" /></Link>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white border-slate-800">
                      Back to User Management
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="transition-all duration-300 ease-in-out group-hover:pl-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Hardware Registry</h1>
                  <span className="text-sm text-slate-500 mt-1 block">Manage MaChip hardware alignments, biometric signatures, and access states.</span>
                </div>
              </div>
              <Button onClick={handleStartScan} className="bg-[#2A174E] hover:bg-[#7A52B5] font-bold shadow-sm gap-2">
                <ScanLine className="h-4 w-4 text-white" />
                <span>{activeTab === 'rfid' ? 'Scan RFID' : 'Enroll Fingerprint'}</span>
              </Button>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full sm:w-[400px] grid-cols-2 h-11 bg-slate-200/60 rounded-lg mb-6 p-0.5">
                <TabsTrigger value="rfid" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
                  <CreditCardIcon className="mr-2 h-4 w-4" /> RFID Cards
                </TabsTrigger>
                <TabsTrigger value="fingerprint" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] data-[state=active]:shadow-sm font-semibold text-slate-500 transition-all rounded-md">
                  <FingerprintIcon className="mr-2 h-4 w-4" /> Biometrics
                </TabsTrigger>
              </TabsList>

              {/* Stats Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card className={`border-t-5 ${stats.color} bg-white py-0`}>
                  <CardContent className="px-5 py-5 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {activeTab === 'rfid' ? 'Total Paired Cards' : 'Enrolled Templates'}
                        </p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                            {activeTab === 'rfid' 
                              ? 'The number of active RFID cards linked to employee profiles.' 
                              : 'The number of active fingerprint slots registered in the biometric module memory.'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-3xl font-bold text-[#2A174E]">{stats.total}</p>
                      <p className="text-[10px] text-slate-400 mt-2 italic">
                        {activeTab === 'rfid' ? 'Registered RFID tokens in the system.' : 'Biometric slot maps active in module memory.'}
                      </p>
                    </div>
                    <div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg">{stats.icon}</div>
                  </CardContent>
                </Card>
                <Card className="border-t-5 border-orange-600 bg-white py-0">
                  <CardContent className="px-5 py-5 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unassigned Employees</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-slate-400 hover:text-slate-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal">
                            Employees who currently do not have a linked RFID card (in RFID tab) or fingerprint signature (in Biometrics tab).
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-3xl font-bold text-orange-700">{stats.unassigned}</p>
                      <p className="text-[10px] text-slate-400 mt-2 italic">Employees pending hardware alignment.</p>
                    </div>
                    <div className="bg-orange-50 text-orange-600 p-3 rounded-lg"><SensorsIcon /></div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card className="shadow-sm border-0 bg-white mb-6 py-0">
                <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full xl:max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input 
                      placeholder={`Search by name, ID, or ${activeTab === 'rfid' ? 'UID' : 'Slot'}...`} 
                      className="pl-10" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                  </div>
                  <div className="flex gap-3 w-full xl:w-auto items-center">
                    <FilterListIcon className="text-slate-400 hidden sm:block" />
                    {activeTab === 'rfid' ? (
                      <>
                        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full sm:w-[160px] h-9 border-slate-200 bg-slate-50 text-slate-700 font-medium" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-[160px] bg-slate-50"><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Unassigned">Unassigned</SelectItem></SelectContent>
                        </Select>
                      </>
                    ) : (
                      <Select value={memoryIdFilter} onValueChange={setMemoryIdFilter}>
                        <SelectTrigger className="w-[160px] bg-slate-50"><SelectValue placeholder="Memory ID" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Slots</SelectItem>
                          {uniqueMemoryIds.map(id => (
                            <SelectItem key={id} value={id.toString()}>Slot #{id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {isFiltering && <Button variant="ghost" onClick={() => { setSearchQuery(""); setStatusFilter("All"); setMemoryIdFilter("All"); setSelectedDate(""); }} className="text-slate-500 hover:text-red-600"><CloseIcon className="h-4 w-4 mr-1" /> Clear</Button>}
                  </div>
                </CardContent>
              </Card>

              {/* Table */}
              <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
                <CardContent className="p-0 flex flex-col">
                  <Table>
                    <TableHeader className="bg-[#2A174E]">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-white font-bold py-4 px-6 uppercase text-xs tracking-wider">Employee</TableHead>
                        <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">
                          <div className="flex items-center gap-1">
                            {activeTab === 'rfid' ? 'MaChip Card UID' : 'Module Memory ID'}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpOutlineIcon sx={{ fontSize: 12 }} className="text-white/60 hover:text-white cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                                {activeTab === 'rfid' 
                                  ? 'Unique identifier read from the MFRC522 RFID chip.' 
                                  : 'The slot index where the fingerprint template is stored in the optical sensor\'s flash memory.'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        {activeTab === 'rfid' && (
                          <>
                            <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">
                              <div className="flex items-center gap-1">
                                Status
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpOutlineIcon sx={{ fontSize: 12 }} className="text-white/60 hover:text-white cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                                    Alignment status of the RFID card.
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TableHead>
                            <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">
                              <div className="flex items-center gap-1">
                                Synchronized
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpOutlineIcon sx={{ fontSize: 12 }} className="text-white/60 hover:text-white cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                                    The date when the RFID card was mapped to the employee record.
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </TableHead>
                          </>
                        )}
                        <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider text-right pr-6">Action</TableHead>
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
                            <TableCell className="font-mono text-xs font-semibold text-slate-700">
                              {activeTab === 'rfid' ? (row.machip_id || "—") : `Slot #${row.fingerprintIndex ?? "—"}`}
                            </TableCell>
                            {activeTab === 'rfid' && (
                              <>
                                <TableCell>
                                  <Badge variant="secondary" className={
                                    row.hardwareStatus === "Active" ? "bg-green-100 text-green-800" : 
                                    row.hardwareStatus === "Unassigned" ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-800"
                                  }>
                                    {row.hardwareStatus || "Unknown"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-slate-600 text-sm">
                                  {row.dateAligned ? new Date(row.dateAligned).toLocaleDateString() : "—"}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-right pr-6">
                              {(activeTab === 'rfid' ? row.machip_id : row.fingerprintIndex !== null) ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-block">
                                      <Button variant="outline" size="sm" onClick={() => handleRevokeClick(row)} className="border-red-200 text-red-600 hover:bg-red-50">
                                        <BlockIcon className="h-3.5 w-3.5" />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                    {activeTab === 'rfid' ? 'Unlink RFID Card' : 'Wipe Fingerprint Slot'}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No hardware linked</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={activeTab === 'rfid' ? 5 : 3} className="p-6 border-0">
                          <EmptyState icon={activeTab === 'rfid' ? <CreditCardIcon className="h-8 w-8 text-slate-300" /> : <FingerprintIcon className="h-8 w-8 text-slate-300" />} title="No mappings active" description="No registered nodes currently reside within hardware configuration filters." />
                        </TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between p-4 bg-slate-50/30 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500">Showing {startIndex + 1} to {endIndex} of {totalItems} profiles</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
                      <div className="h-8 w-8 flex items-center justify-center bg-[#2A174E]/10 text-[#2A174E] rounded text-xs font-bold">{currentPage}</div>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Tabs>
          </>
        )}
      </div>

      {/* MODALS */}

      <RfidScanModal 
        isOpen={showScanModal} 
        onClose={handleCloseScanModal} 
        onRescan={handleStartScan}
        onConfirm={handleScanConfirm}
        scannedId={localScannedId}
        error={scanError}
        title={activeTab === 'rfid' ? "RFID Card Scanner" : "Fingerprint Scanner"}
      />

      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-[460px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
          <DialogHeader className="bg-[#2A174E] text-white p-6 relative">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-purple-300" /> {activeTab === 'rfid' ? 'Assign Scanned Card' : 'Link Biometric Template'}
            </DialogTitle>
            <DialogDescription className="text-purple-200 text-xs mt-1">
              Link the captured hardware code signature profile with an active employee workspace.
            </DialogDescription>
            <button onClick={() => setShowAssignModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"><CloseIcon className="h-5 w-5" /></button>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{activeTab === 'rfid' ? 'Scanned Card UID' : 'Allocated Flash Memory Index'}</Label>
              <div className="font-mono text-sm font-black text-[#2A174E] bg-white border border-slate-200 rounded-lg p-3 tracking-widest shadow-sm">
                {activeTab === 'rfid' ? scannedId : `Slot Pool Location #${scannedId}`}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Assign Target Employee Profile {unassignedEmployees.length > 0 && `(${unassignedEmployees.length} Found)`}</Label>
                <button onClick={fetchUnassignedEmployees} className="text-[10px] text-purple-600 hover:text-purple-800 font-bold uppercase tracking-tight underline" disabled={loadingUnassigned}>
                  {loadingUnassigned ? "Refreshing..." : "Refresh List"}
                </button>
              </div>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full h-12 bg-white border-slate-200 rounded-lg focus:ring-[#2A174E]"><SelectValue placeholder="Select an unassigned employee..." /></SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {loadingUnassigned ? <div className="p-4 text-center text-xs text-slate-400 italic">Updating registry...</div> : 
                    unassignedEmployees.length > 0 ? unassignedEmployees.map((emp) => (
                      <SelectItem key={emp.user_Id} value={emp.user_Id.toString()}>{emp.user_FirstName} {emp.user_LastName} ({formatUserId(emp.user_Id)})</SelectItem>
                    )) : <div className="p-4 text-center text-xs text-slate-400 italic">No unassigned employees found.</div>
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-11 border-slate-200 text-slate-500 rounded-lg font-bold" onClick={() => setShowAssignModal(false)}>Cancel</Button>
              <Button onClick={handleAssignSubmit} disabled={assigning || !selectedUserId} className="flex-1 h-11 bg-[#2A174E] hover:bg-[#1a0e30] text-white rounded-lg font-bold shadow-md tracking-wide">
                {assigning ? "Linking..." : "Assign Hardware Link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevokeModal} onOpenChange={setShowRevokeModal}>
        <DialogContent className="sm:max-w-[400px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-8 w-8" /></div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#2A174E] text-center">Revoke Hardware Access?</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-2 text-center">
                You are about to unlink the {activeTab === 'rfid' ? 'RFID card' : 'biometric signature'} from <b className="text-slate-900">{revokeTarget?.userName}</b>. 
                This employee will no longer be able to use this hardware for attendance.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 bg-slate-50 flex gap-3">
            <Button variant="outline" className="flex-1 h-11 border-slate-200 text-slate-500 rounded-lg font-bold" onClick={() => setShowRevokeModal(false)}>Keep Linked</Button>
            <Button onClick={confirmRevoke} disabled={revoking} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md">
              {revoking ? "Unlinking..." : `Yes, ${activeTab === 'rfid' ? 'Unlink Card' : 'Wipe Slot'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </TooltipProvider>
    </Sidebar>
  );
};

export default HardwareManagement;
