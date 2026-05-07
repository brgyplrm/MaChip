import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar"; // Adjust path if necessary
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../utils/api";

// MUI Icons
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import DescriptionIcon from "@mui/icons-material/Description";

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RequestsHistory = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(JSON.parse(localStorage.getItem("userData")));
  const [viewMode, setViewMode] = useState(localStorage.getItem("viewMode") || "management");
  const isManagement = (userData?.user_RoleId === 1 || userData?.user_RoleId === 2) && viewMode === "management";

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters and Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        // Adjust this endpoint based on your actual backend API route
        // If isManagement is true, fetch all requests, otherwise fetch only the user's requests
        const endpoint = isManagement 
          ? `/api/request/all` 
          : `/api/request/user/${userData?.user_Id}`;
          
        const response = await fetchWithAuth(endpoint);
        if (response.ok) {
          const data = await response.json();
          // Sort by newest first
          const sortedData = data.sort((a, b) => new Date(b.date_Filed) - new Date(a.date_Filed));
          setRequests(sortedData);
        }
      } catch (err) {
        console.error("Error fetching requests:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userData?.user_Id) {
      fetchRequests();
    }
  }, [userData?.user_Id, isManagement]);

  // Derived state for filtering
  const filteredRequests = requests.filter((req) => {
    const matchesSearch = 
      req.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      req.emp_reqId?.toString().includes(searchTerm) ||
      req.reqTypeName?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === "All" || req.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination Logic
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredRequests.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage) || 1;

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || "";
    if (s.includes("approve")) return <Badge className="bg-green-500 hover:bg-green-600 shadow-sm"><CheckCircleIcon className="w-3.5 h-3.5 mr-1"/> Approved</Badge>;
    if (s.includes("reject")) return <Badge className="bg-red-500 hover:bg-red-600 shadow-sm"><CancelIcon className="w-3.5 h-3.5 mr-1"/> Rejected</Badge>;
    return <Badge className="bg-amber-500 hover:bg-amber-600 shadow-sm"><HourglassEmptyIcon className="w-3.5 h-3.5 mr-1"/> Pending</Badge>;
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <div className="flex-1 p-4 md:p-8 w-full max-w-[1400px] mx-auto overflow-x-hidden min-w-0">
        
        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] flex items-center gap-2">
              <DescriptionIcon className="h-8 w-8 text-slate-400" /> Requests History
            </h1>
            <span className="text-sm text-slate-500 block mt-1">View and track the status of all submitted requests.</span>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="shadow-sm border-0 bg-white mb-6">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input 
                placeholder="Search by ID, Name, or Type..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <FilterListIcon className="text-slate-400 h-5 w-5" />
              <Select 
                value={statusFilter} 
                onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
              >
                <SelectTrigger className="w-full sm:w-[180px] border-slate-200">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Data Table Card */}
        <Card className="shadow-sm border-0 bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-50 pb-4 bg-slate-50/50">
            <CardTitle className="text-lg text-slate-800 flex justify-between items-center">
              <span>Request Records</span>
              <Badge variant="outline" className="text-slate-500 bg-white">
                {filteredRequests.length} Total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold text-slate-600 whitespace-nowrap">Req ID</TableHead>
                    <TableHead className="font-bold text-slate-600 whitespace-nowrap">Date Filed</TableHead>
                    {isManagement && <TableHead className="font-bold text-slate-600 whitespace-nowrap">Employee Name</TableHead>}
                    <TableHead className="font-bold text-slate-600 whitespace-nowrap">Request Type</TableHead>
                    <TableHead className="font-bold text-slate-600">Status</TableHead>
                    <TableHead className="font-bold text-slate-600 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={isManagement ? 6 : 5} className="text-center py-12 text-slate-500 italic">
                        Loading requests...
                      </TableCell>
                    </TableRow>
                  ) : currentRows.length > 0 ? (
                    currentRows.map((req) => (
                      <TableRow key={req.emp_reqId} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-sm text-slate-600 font-medium">
                          #REQ-{req.emp_reqId}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {new Date(req.date_Filed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                        {isManagement && (
                          <TableCell className="font-semibold text-slate-800">
                            {req.userName}
                          </TableCell>
                        )}
                        <TableCell>
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap">
                            {req.reqTypeName}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(req.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-[#2A174E] hover:text-[#2A174E] hover:bg-[#f0ebfa] font-semibold"
                            onClick={() => navigate(`/requests/${req.emp_reqId}`)}
                          >
                            <VisibilityIcon className="h-4 w-4 mr-1.5" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={isManagement ? 6 : 5} className="text-center py-12 text-slate-500">
                        No requests found matching your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {filteredRequests.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 gap-4">
                <span className="text-sm text-slate-500 font-medium">
                  Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredRequests.length)} of {filteredRequests.length} entries
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="text-slate-600"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center justify-center px-4 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-md">
                    {currentPage} / {totalPages}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="text-slate-600"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
      </Sidebar>
    </div>
  );
};

export default RequestsHistory;