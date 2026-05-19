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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { ScanLine } from "lucide-react";
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

const RfidManagement = () => {
  const [rfidList, setRfidList] = useState([]);
  const [unassignedEmployees, setUnassignedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Modal Workflow States
  const [showScanModal, setShowScanModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [scannedUid, setScannedUid] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch active registry
  const fetchRfidData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth("/api/hardware/rfid/all");
      if (response.ok) {
        const data = await response.json();
        setRfidList(data);
      }
    } catch (err) {
      console.error("Error fetching RFID registry:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch users without a card assigned
  const fetchUnassignedEmployees = useCallback(async () => {
    try {
      const response = await fetchWithAuth("/api/users/unassigned-hardware?type=rfid");
      if (response.ok) {
        const data = await response.json();
        setUnassignedEmployees(data);
      }
    } catch (err) {
      console.error("Error loading unassigned users:", err);
    }
  }, []);

  useEffect(() => {
    fetchRfidData();
    fetchUnassignedEmployees();
  }, [fetchRfidData, fetchUnassignedEmployees]);

  // Handle step-transition from Scan capture to Assignment form
  const handleRfidScanned = (uid) => {
    setShowScanModal(false);
    if (!uid) return;

    // Check if card is already registered
    const existingCard = rfidList.find(r => r.machip_id?.toLowerCase() === uid.toLowerCase());

    if (existingCard) {
      setToast({ message: `Card ${uid} is already linked to ${existingCard.userName}.`, type: "error" });
      setSearchQuery(uid); // Filter table to show item
    } else {
      // Advance to target mapping screen from screenshot layout
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

  const handleRevokeCard = async (userId) => {
    if (!window.confirm("Are you sure you want to revoke this RFID card alignment?")) return;
    try {
      const response = await fetchWithAuth(`/api/hardware/rfid/revoke/${userId}`, { method: "PUT" });
      if (response.ok) {
        setToast({ message: "RFID card access unlinked successfully.", type: "success" });
        fetchRfidData();
        fetchUnassignedEmployees();
      }
    } catch (err) {
      setToast({ message: "Failed to update hardware credentials.", type: "error" });
    }
  };

  // Stats
  const stats = useMemo(() => {
    return {
      total: rfidList.length,
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
      return matchesSearch && matchesStatus;
    });
  }, [rfidList, searchQuery, statusFilter]);

  // Pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredData.slice(startIndex, endIndex);

  const isFiltering = searchQuery !== "" || statusFilter !== "All";

  return (
    <Sidebar>
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/users" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 text-[#2A174E] transition-colors">
              <ArrowBackIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">RFID Card Registry</h1>
              <span className="text-sm text-slate-500 mt-1 block">Manage MaChip hardware alignments, token authorizations, and card access states.</span>
            </div>
          </div>
          <Button onClick={() => setShowScanModal(true)} className="bg-[#2A174E] hover:bg-[#1a0e30] font-bold shadow-sm gap-2">
            <ScanLine className="h-4 w-4 text-white" />
            <span>Scan RFID</span>
          </Button>
        </div>

        {/* Statistics Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="border-t-5 border-[#2A174E] bg-white py-0"><CardContent className="px-5 py-5 flex justify-between items-center"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paired Cards</p><p className="text-3xl font-bold text-[#2A174E]">{stats.total}</p></div><div className="bg-[#2A174E]/10 text-[#2A174E] p-3 rounded-lg"><CreditCardIcon /></div></CardContent></Card>
          <Card className="border-t-5 border-green-600 bg-white py-0"><CardContent className="px-5 py-5 flex justify-between items-center"><div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Credentials</p><p className="text-3xl font-bold text-green-700">{stats.active}</p></div><div className="bg-green-50 text-green-600 p-3 rounded-lg"><ContactlessIcon /></div></CardContent></Card>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-slate-50"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Suspended">Suspended</SelectItem></SelectContent>
              </Select>
              {isFiltering && <Button variant="ghost" onClick={() => { setSearchQuery(""); setStatusFilter("All"); }} className="text-slate-500 hover:text-red-600"><CloseIcon className="h-4 w-4 mr-1" /> Clear</Button>}
            </div>
          </CardContent>
        </Card>

        {/* Registry Table Container */}
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          <CardContent className="p-0 flex flex-col">
            <Table>
              <TableHeader className="bg-[#2A174E]">
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
                      <TableCell className="px-6 py-4"><p className="font-bold text-[#2A174E] text-sm">{row.userName}</p><p className="text-[10px] text-slate-400 font-mono">{formatUserId(row.user_Id)}</p></TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">{row.machip_id || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className={row.hardwareStatus === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{row.hardwareStatus || "Unknown"}</Badge></TableCell>
                      <TableCell className="text-slate-600 text-sm">{row.dateAligned || "—"}</TableCell>
                      <TableCell className="text-slate-600 text-sm">{row.lastScanned || "—"}</TableCell>
                      <TableCell className="text-right pr-6"><Button variant="outline" size="sm" onClick={() => handleRevokeCard(row.user_Id)} className="border-red-200 text-red-600 hover:bg-red-50"><BlockIcon className="h-3.5 w-3.5 mr-1" /> Unlink</Button></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="p-6 border-0">
                    <EmptyState icon={<CreditCardIcon className="h-8 w-8 text-slate-300" />} title="No RFID cards mapped" description="No secure hardware entries found matching your configuration filters." /></TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-4 bg-slate-50/30 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">Showing {startIndex + 1} to {endIndex} of {totalItems} hardware tokens</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
                <div className="h-8 w-8 flex items-center justify-center bg-[#2A174E] text-white rounded text-xs font-bold">{currentPage}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STEP 1: Core Scan Sensor Interceptor Modal */}
      <RfidScanModal isOpen={showScanModal} onClose={() => setShowScanModal(false)} onScanSuccess={handleRfidScanned} />

      {/* STEP 2: Assign Scanned Token Modal Layout (Matches Uploaded Reference Design) */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-[460px] p-0 border-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
          <DialogHeader className="bg-[#2A174E] text-white p-6 relative">
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
              <div className="font-mono text-sm font-black text-[#2A174E] bg-white border border-slate-200 rounded-lg p-3 tracking-widest shadow-sm">
                {scannedUid}
              </div>
            </div>

            {/* Target Variable Dropdown Assignment Field */}
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
                      All employees currently hold assigned card mappings.
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
                className="flex-1 h-11 bg-[#2A174E] hover:bg-[#1a0e30] text-white rounded-lg font-bold shadow-md tracking-wide"
              >
                {assigning ? "Linking Identity..." : "Assign Hardware Link"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
};

export default RfidManagement;