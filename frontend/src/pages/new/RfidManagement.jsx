import React, { useState, useEffect, useMemo, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from '@mui/icons-material/FilterList';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ContactlessIcon from '@mui/icons-material/Contactless';
import SensorsIcon from '@mui/icons-material/Sensors';
import BlockIcon from '@mui/icons-material/Block';
import CloseIcon from '@mui/icons-material/Close';
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import EmptyState from "../../components/EmptyState";
import { Link } from "react-router-dom";
import { ScanLine, AlertTriangle, ChevronLeft } from "lucide-react";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";

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

const RfidManagement = () => {
  const [rfidList, setRfidList] = useState([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  // Modal Workflow States
  const [showScanModal, setShowScanModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [scannedUid, setScannedUid] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [rfidError, setRfidError] = useState("");
  const [localScannedId, setLocalScannedId] = useState(null);

  // Revoke Confirmation States
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const fetchUnassignedEmployees = useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      const response = await fetchWithAuth("/api/users/unassigned-hardware?type=rfid");
      if (response.ok) {
        const data = await response.json();
        setUnassignedEmployees(data);
      } else {
        const errText = await response.text();
        console.error("API Error fetching unassigned employees:", response.status, errText);
        setToast({ message: `Access Error (${response.status}): You may need to restart the backend server for permission changes to apply.`, type: "error" });
      }
    } catch (err) {
      console.error("Error fetching unassigned employees:", err);
      setToast({ message: "Network error fetching unassigned employees.", type: "error" });
    } finally {
      setLoadingUnassigned(false);
    }
  }, []);

  useEffect(() => {
    fetchRfidData();
    fetchUnassignedEmployees();
  }, [fetchRfidData, fetchUnassignedEmployees]);

  // Refresh unassigned list when modal opens to ensure latest data
  useEffect(() => {
    if (showAssignModal) {
      fetchUnassignedEmployees();
    }
  }, [showAssignModal, fetchUnassignedEmployees]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, selectedDate]);

  const handleScanRFID = async () => {
    setRfidError("");
    setLocalScannedId(null);
    setShowScanModal(true);
    
    try {
      // 1. Initiate capture session on server
      await fetchWithAuth("/api/system/reg-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "RFID" })
      });

      // 2. Poll/Wait for hardware scan
      const response = await fetchWithAuth("/api/users/generateRfid");
      const data = await response.json();

      if (data.cancelled) {
        return;
      }

      if (response.ok && data.rfid) {
        setLocalScannedId(data.rfid);
      } else if (response.status === 400 && data.rfid) {
        // Handle duplicate card case
        setLocalScannedId(data.rfid);
        setRfidError(data.error || "This card is already assigned to another user.");
      } else {
        setRfidError(data.error || "Failed to scan RFID. Please try again.");
        if (data.rfid) setLocalScannedId(data.rfid);
      }
    } catch (err) {
      console.error("RFID Scan Error:", err);
      setRfidError("An error occurred while scanning.");
    }
  };

  const handleCloseScanModal = () => {
    setShowScanModal(false);
    // Non-blocking cleanup
    fetchWithAuth("/api/system/reg-session", { method: "DELETE" }).catch(() => {});
  };

  // Handle step-transition from Scan capture to Assignment form
  const handleRfidScannedConfirm = () => {
    if (!localScannedId) return;

    setShowScanModal(false);
    
    // Check if card is already registered
    const uid = localScannedId;
    const existingCard = rfidList.find(r => r.machip_id?.toLowerCase() === uid.toLowerCase());

    if (existingCard) {
      setToast({ message: `Card ${uid} is already linked to ${existingCard.userName}.`, type: "error" });
      setSearchQuery(uid); // Filter table to show item
    } else {
      // Advance to target mapping screen
      setScannedUid(uid);
      setSelectedUserId("");
      setShowAssignModal(true);
    }
  };

  // Commit dynamic selection assignment to DB
  const handleAssignCardSubmit = async () => {
    if (!selectedUserId) {
      setToast({ message: "Please select an employee to link.", type: "error" });
      return;
    }
    setAssigning(true);
    try {
      const response = await fetchWithAuth("/api/hardware/rfid/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_Id: selectedUserId, machip_id: scannedUid })
      });

      if (response.ok) {
        setToast({ message: "Hardware alignment applied successfully!", type: "success" });
        setShowAssignModal(false);
        fetchRfidData();
        fetchUnassignedEmployees();
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to update record.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network structural link timeout.", type: "error" });
    } finally {
      setAssigning(false);
    }
  };

  const handleRevokeCard = (user) => {
    setRevokeTarget(user);
    setShowRevokeModal(true);
  };

  const confirmRevokeCard = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const response = await fetchWithAuth(`/api/hardware/rfid/revoke/${revokeTarget.user_Id}`, { method: "PUT" });
      if (response.ok) {
        setToast({ message: "RFID card access unlinked successfully.", type: "success" });
        setShowRevokeModal(false);
        setRevokeTarget(null);
        fetchRfidData();
        fetchUnassignedEmployees();
      } else {
        setToast({ message: "Failed to revoke card access.", type: "error" });
      }
    } catch (err) {
      console.error("Revoke Error:", err);
      setToast({ message: "Failed to update hardware credentials.", type: "error" });
    } finally {
      setRevoking(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    return {
      total: rfidList.filter(r => r.machip_id).length,
      active: rfidList.filter(r => r.hardwareStatus === "Active").length
    };
  }, [rfidList]);

  // Filtering
  const filteredData = useMemo(() => {
    return rfidList.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        item.userName?.toLowerCase().includes(query) || 
        item.machip_id?.toLowerCase().includes(query) ||
        formatUserId(item.user_Id).toLowerCase().includes(query);

      const matchesStatus = statusFilter === "All" || item.hardwareStatus === statusFilter;

      // Date Filtering Logic
      let matchesDate = true;
      if (selectedDate) {
        const alignedDateRaw = item.dateAligned;
        if (alignedDateRaw) {
          try {
            const alignedDate = new Date(alignedDateRaw).toISOString().split('T')[0];
            matchesDate = alignedDate === selectedDate;
          } catch (e) {
            matchesDate = false;
          }
        } else {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [rfidList, searchQuery, statusFilter, selectedDate]);

  // Pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredData.slice(startIndex, endIndex);

  const isFiltering = searchQuery !== "" || statusFilter !== "All" || selectedDate !== "";

  const PageSkeleton = () => (
  <div className="space-y-6 w-full h-screen"> {/* Added h-screen */}
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
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        {loading ? <PageSkeleton /> :(
        <>
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
              <h1 className="text-2xl md:text-3xl font-bold text-brand-primary">RFID Card Registry</h1>
              <span className="text-sm text-slate-500 mt-1 block">Manage MaChip hardware alignments, token authorizations, and card access states.</span>
            </div>
          </div>
          
          <Button onClick={handleScanRFID} className="bg-brand-primary hover:bg-[#7A52B5] font-bold shadow-sm gap-2">
            <ScanLine className="h-4 w-4 text-white" />
            <span>Scan RFID</span>
          </Button>
        </div>

        {/* Statistics Dashboard Cards with Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Card 1 */}
          <Card className="border-t-5 border-brand-primary bg-white py-0">
            <CardContent className="px-5 py-5 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paired Cards</p>
                <p className="text-3xl font-bold text-brand-primary">{stats.total}</p>
                <p className="text-[10px] text-slate-400 mt-2 italic">Total number of RFID tokens currently registered in the system.</p>
              </div>
              <div className="bg-brand-primary/10 text-brand-primary p-3 rounded-lg"><CreditCardIcon /></div>
            </CardContent>
          </Card>
          
          {/* Card 2: Unassigned Employees */}
          <Card className="border-t-5 border-accent-gold bg-white py-0">
            <CardContent className="px-5 py-5 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unassigned Employees</p>
                <p className="text-3xl font-bold text-accent-gold">{unassignedEmployees.length}</p>
                <p className="text-[10px] text-slate-400 mt-2 italic">Employees pending rfid token alignment.</p>
              </div>
              <div className="bg-accent-gold/10 text-accent-gold p-3 rounded-lg"><SensorsIcon /></div>
            </CardContent>
            </Card>
          </div>

        {/* Filters Card */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input placeholder="Search by Employee Name, ID, or Card UID..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-3 w-full xl:w-auto items-center">
              <FilterListIcon className="text-slate-400 hidden sm:block" />
              
              <div className="flex items-center gap-2">
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="w-full sm:w-[160px] h-9 border-slate-200 bg-slate-50 text-slate-700 font-medium" 
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-slate-50"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Unassigned">Unassigned</SelectItem></SelectContent>
              </Select>
              {isFiltering && <Button variant="ghost" onClick={() => { setSearchQuery(""); setStatusFilter("All"); setSelectedDate(""); }} className="text-slate-500 hover:text-red-600"><CloseIcon className="h-4 w-4 mr-1" /> Clear</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Registry Table Container */}
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          <CardContent className="p-0 flex flex-col">
            <Table>
              <TableHeader className="bg-brand-primary">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white font-bold py-4 px-6 uppercase text-xs tracking-wider">Employee</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">MaChip Card UID</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">Status</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">Date Synchronized</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider">Last Scanned</TableHead>
                  <TableHead className="text-white font-bold py-4 uppercase text-xs tracking-wider text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((row) => (
                    <TableRow key={row.user_Id} className="border-b-slate-100 hover:bg-slate-50/50">
                      <TableCell className="px-6 py-4"><p className="font-bold text-brand-primary text-sm">{row.userName}</p><p className="text-[10px] text-slate-400 font-mono">{formatUserId(row.user_Id)}</p></TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">{row.machip_id || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={
                          row.hardwareStatus === "Active" ? "bg-green-100 text-green-800" : 
                          row.hardwareStatus === "Unassigned" ? "bg-slate-100 text-slate-500" :
                          "bg-red-100 text-red-800"
                        }>
                          {row.hardwareStatus || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {row.dateAligned ? new Date(row.dateAligned).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">{row.lastScanned || "—"}</TableCell>
                      <TableCell className="text-right pr-6">
                        {row.machip_id ? (
                          <Button variant="outline" size="sm" onClick={() => handleRevokeCard(row)} className="border-red-200 text-red-600 hover:bg-red-50">
                            <BlockIcon className="h-3.5 w-3.5 mr-1" /> Unlink
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No card linked</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="p-6 border-0">
                    <EmptyState icon={<CreditCardIcon className="h-8 w-8 text-slate-300" />} title="No employees found" description="No employees match your search criteria." /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              itemLabel="hardware tokens"
            />
          </CardContent>
        </Card>
        </>
        )}
        </div>

      {/* STEP 1: Core Scan Sensor Interceptor Modal */}
      <RfidScanModal 
        isOpen={showScanModal} 
        onClose={handleCloseScanModal} 
        onRescan={handleScanRFID}
        onConfirm={handleRfidScannedConfirm}
        scannedId={localScannedId}
        error={rfidError}
      />

      {/* STEP 2: Assign Scanned Token Modal Layout (Matches Uploaded Reference Design) */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-[460px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
          <DialogHeader className="bg-brand-primary text-white p-6 relative">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-purple-300" /> Assign Scanned Card
            </DialogTitle>
            <DialogDescription className="text-purple-200 text-xs mt-1">
              Link the captured hardware code signature profile with an active employee workspace.
            </DialogDescription>
            <button onClick={() => setShowAssignModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
              <CloseIcon className="h-5 w-5" />
            </button>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {/* Captured Parameter Box */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scanned Card Unique identifier (UID)</Label>
              <div className="font-mono text-sm font-black text-brand-primary bg-white border border-slate-200 rounded-lg p-3 tracking-widest shadow-sm">
                {scannedUid}
              </div>
            </div>

            {/* Target Variable Dropdown Assignment Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Assign Target Employee Profile {unassignedEmployees.length > 0 && `(${unassignedEmployees.length} Found)`}
                </Label>
                <button 
                  onClick={fetchUnassignedEmployees} 
                  className="text-[10px] text-purple-600 hover:text-purple-800 font-bold uppercase tracking-tight underline"
                  disabled={loadingUnassigned}
                >
                  {loadingUnassigned ? "Refreshing..." : "Refresh List"}
                </button>
              </div>
              
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full h-12 bg-white border-slate-200 rounded-lg focus:ring-brand-primary">
                  <SelectValue placeholder="Select an unassigned employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {loadingUnassigned ? (
                    <div className="p-4 text-center text-xs text-slate-400 italic">
                      Updating employee registry...
                    </div>
                  ) : unassignedEmployees.length > 0 ? (
                    unassignedEmployees.map((emp) => (
                      <SelectItem key={emp.user_Id} value={emp.user_Id.toString()} className="cursor-pointer">
                        {emp.user_FirstName} {emp.user_LastName} ({formatUserId(emp.user_Id)})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 italic">
                      No unassigned employees found. Check the registry list below.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-11 border-slate-200 text-slate-500 rounded-lg font-bold" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssignCardSubmit}
                disabled={assigning || !selectedUserId}
                className="flex-1 h-11 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg font-bold shadow-md tracking-wide"
              >
                {assigning ? "Linking Identity..." : "Assign Hardware Link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeModal} onOpenChange={setShowRevokeModal}>
        <DialogContent className="sm:max-w-[400px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-brand-primary text-center">Revoke Access Card?</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm mt-2 text-center">
                You are about to unlink the RFID card from <b className="text-slate-900">{revokeTarget?.userName}</b>. 
                This employee will no longer be able to use this card for attendance.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 bg-slate-50 flex gap-3">
            <Button variant="outline" className="flex-1 h-11 border-slate-200 text-slate-500 rounded-lg font-bold" onClick={() => setShowRevokeModal(false)}>
              Keep Linked
            </Button>
            <Button 
              onClick={confirmRevokeCard}
              disabled={revoking}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md"
            >
              {revoking ? "Unlinking..." : "Yes, Unlink Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
};

export default RfidManagement;