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

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const FingerprintManagement = () => {
  const [biometricList, setBiometricList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sensorFilter, setSensorFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  useEffect(() => {
    fetchBiometricData();
  }, [fetchBiometricData]);

  const handleClearTemplate = async (userId, slotId) => {
    if (!window.confirm(`Clear scanner slot matrix index #${slotId} for this user?`)) return;
    try {
      const response = await fetchWithAuth(`/api/hardware/biometric/clear/${userId}`, { method: "DELETE" });
      if (response.ok) {
        setToast({ message: "Biometric node deleted from flash cache slot.", type: "success" });
        fetchBiometricData();
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
      <div className="flex flex-col w-full min-h-screen bg-slate-50 p-4 md:p-8">
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, message: "" })} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">Biometric Fingerprint Registry</h1>
            <span className="text-sm text-slate-500 mt-1 block">Audit device memory allocations, flash signatures, and biometric slot maps.</span>
          </div>
          <Button asChild className="bg-[#2A174E] hover:bg-[#1a0e30] font-bold shadow-sm">
            <Link to="/users/new">Enroll Fingerprint</Link>
          </Button>
        </div>

        {/* Statistics */}
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

        {/* Filters */}
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

        {/* Table */}
        <Card className="shadow-sm border-0 bg-white py-0 overflow-hidden">
          <CardContent className="p-0 flex flex-col">
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
                    <TableCell colSpan={4} className="p-0 border-0">
                      <EmptyState icon={<FingerprintIcon className="h-8 w-8 text-slate-300" />} title="No biometric maps active" description="No registered fingerprint nodes currently reside within hardware configuration filters." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
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
    </Sidebar>
  );
};

export default FingerprintManagement;