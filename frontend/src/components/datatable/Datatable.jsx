import React from "react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import ActionModal from "../../components/actionModal/ActionModal";
import { fetchWithAuth } from "../../utils/api";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ArchiveIcon from '@mui/icons-material/Archive';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import SensorsIcon from '@mui/icons-material/Sensors';
import { CreditCardIcon } from "lucide-react";
import { FingerprintIcon } from "lucide-react";
import { EyeIcon} from "lucide-react";  
import { Archive, ArchiveRestore, ArchiveX } from "lucide-react";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Datatable = () => {
  const [data, setData] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [userToArchive, setUserToArchive] = useState(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isAdminOrAccountant = currentUser?.user_RoleId === 1 || currentUser?.user_RoleId === 4;

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    []
  );

  const initiateArchive = (user_Id) => {
    setUserToArchive(user_Id);
    setShowArchiveModal(true);
  };

  const confirmArchive = async () => {
    try {
      const response = await fetchWithAuth(
        `/api/users/deleteUser/${userToArchive}`,
        {
          method: "DELETE",
        }
      );
      
      if (response.ok) {
        setData(data.filter((item) => item.user_Id !== userToArchive));
        setToast({ message: "User archived successfully.", type: "success" });
      } else {
        const result = await response.json();
        setToast({ message: result.error || "Failed to archive user.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Could not connect to server.", type: "error" });
    } finally {
      setShowArchiveModal(false);
      setUserToArchive(null);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetchWithAuth("/api/users/all");
        if (response.ok) {
          const users = await response.json();
          setData(users);
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, []);

  // Reset to page 1 whenever filters or search terms change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter, itemsPerPage]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setRoleFilter("All Roles");
    setStatusFilter("All Statuses");
    setCurrentPage(1);
  };

  const isFiltering = searchTerm !== "" || roleFilter !== "All Roles" || statusFilter !== "All Statuses";

  // Apply Filters
  const filteredData = data.filter(user => {
    const formattedId = formatUserId(user.user_Id);
    const matchesSearch = (
      user.user_FirstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_Email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_Id?.toString().includes(searchTerm) ||
      formattedId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesRole = roleFilter === "All Roles" || 
      (user.user_Role && user.user_Role.toLowerCase() === roleFilter.toLowerCase());
      
    const matchesStatus = statusFilter === "All Statuses" || 
      (user.user_EmploymentStatus && user.user_EmploymentStatus.toLowerCase().trim() === statusFilter.toLowerCase().trim());

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination Logic
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  
  // The actual slice of data to render on the current page
  const currentData = filteredData.slice(startIndex, endIndex);

  // Global Statistics (Calculated from all active data, unaffected by filters)
  const stats = {
    total: data.length,
    employees: data.filter(u => u.user_Role === "Employee").length,
    admins: data.filter(u => u.user_Role !== "Employee").length,
  };

  const getStatusBadgeStyle = (status) => {
    const s = status?.toLowerCase() || "";
    if (s.includes("regular")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (s.includes("part-time")) return "bg-blue-50 text-blue-700 border-blue-100";
    return "bg-amber-50 text-amber-700 border-amber-100";
  };

  // State to track multiple visible row fields using their user_Id
const [revealedMachipUsers, setRevealedMachipUsers] = useState({});

const toggleMachipVisibility = (userId) => {
  setRevealedMachipUsers((prev) => ({
    ...prev,
    [userId]: !prev[userId],
  }));
};

  return (
    <TooltipProvider>
      <div className="flex flex-col w-full h-full p-4 md:p-4">
        <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">User Management</h1>
          <span className="text-sm text-muted-foreground mt-1 block">Manage user accounts and roles</span>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Left side: Biometric Infrastructure (Tertiary) */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  asChild
                  className="text-slate-600 hover:text-[#2A174E] hover:bg-slate-100"
                >
                  <Link to="/users/hardware"><SensorsIcon className="mr-2 h-4 w-4"/> Hardware Registry</Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-slate-900 text-white border-slate-800">
                Configure biometric/RFID readers, fingerprint templates, and ESP32 device endpoints.
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Right side: User Management (Primary & Secondary) */}
          {isAdminOrAccountant && (
            <div className="flex gap-2 w-full sm:w-auto">
              {/* Secondary Action */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    asChild 
                    className="flex-1 sm:flex-none border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <Link to="/users/archived">
                      <ArchiveIcon className="h-4 w-4 mr-1" /> Archived
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 text-white border-slate-800">
                  View and restore soft-deleted employee profiles.
                </TooltipContent>
              </Tooltip>

              {/* Primary Action */}
              <Button 
                asChild 
                className="flex-1 sm:flex-none bg-[#2A174E] text-white hover:bg-[#7A52B5] shadow-sm"
              >
                <Link to="/users/newUser">
                  <PersonAddIcon className="h-4 w-4 mr-1" /> Add User
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
        {/* Card 1: Total Active Users */}
        <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
          <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider">Total Active Users</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#2A174E]/60 hover:text-[#2A174E] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800">
                    Active employee and administrator records currently in the system database.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-bold text-[#2A174E]">{stats.total}</p>
            </div>
            <p className="text-xs font-semibold text-[#2A174E]/70 italic mt-4">Total registered active accounts</p>
          </CardContent>
        </Card>

        {/* Card 2: Employees */}
        <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
          <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider">Employees</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#3B4E17]/60 hover:text-[#3B4E17] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800">
                    Active standard staff records (eligible for shift logs, request filings, and payroll).
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-bold text-[#3B4E17]">{stats.employees}</p>
            </div>
            <p className="text-xs font-semibold text-[#3B4E17]/70 italic mt-4">Active standard staff records</p>
          </CardContent>
        </Card>

        {/* Card 3: Admins & Supervisors */}
        <Card className="border-t-5 border-[#B06E16] bg-white py-0 h-full">
          <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-bold text-[#B06E16] uppercase tracking-wider">Admin & Supervisor</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpOutlineIcon sx={{ fontSize: 14 }} className="text-[#B06E16]/60 hover:text-[#B06E16] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-900 text-white border-slate-800">
                    Accounts with management privileges (overseeing attendance logs, requests, and payroll periods).
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-4xl font-bold text-[#B06E16]">{stats.admins}</p>
            </div>
            <p className="text-xs font-semibold text-[#B06E16]/70 italic mt-4">Active management records</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Card */}
      <Card className="shadow-sm border-0 bg-white mb-6 py-0">
        <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
          
          {/* Search Bar */}
          <div className="relative w-full xl:max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input 
              placeholder="Search by ID, Name, or Email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-slate-200 focus-visible:ring-[#2A174E] w-full"
            />
          </div>
          
          {/* Dropdown Filters and Clear Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <FilterListIcon className="text-slate-400 h-5 w-5 hidden sm:block" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-40 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Roles">All Roles</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Supervisor">Supervisor</SelectItem>
                  <SelectItem value="Admin Manager">Admin Manager</SelectItem>
                  <SelectItem value="Admin Accountant">Admin Accountant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Statuses">All Statuses</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Intern / OJT">Intern / OJT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditionally Rendered Clear Button */}
            {isFiltering && (
              <Button 
                variant="ghost" 
                onClick={handleClearFilters}
                className="w-full sm:w-auto text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors font-semibold"
              >
                <CloseIcon className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="shadow-sm border-0 bg-white py-0">
        <CardContent className="p-0 flex flex-col">
          <div className="overflow-x-auto">
            <Table className="min-w-200 md:min-w-full">
              <TableHeader className="bg-[#2B174F]">
                <TableRow className="hover:bg-transparent border-b-slate-200">
                  <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider ">User ID</TableHead>
                  <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider ">Full Name</TableHead>
                  <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider ">Role</TableHead>
                  <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Status</TableHead>
                  <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wide hidden md:table-cell">
                    <div className="flex items-center gap-1">
                      MaChip ID
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpOutlineIcon sx={{ fontSize: 12 }} className="text-white/60 hover:text-white cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-800 font-normal normal-case">
                          The unique hardware RFID card identifier mapped to this employee.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wide hidden md:table-cell">Email</TableHead>
                  <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((user) => {
                    const isMachipRevealed = revealedMachipUsers[user.user_Id];
                    return (
                    // const isMachipRevealed = revealedMachipUsers[user.user_Id];
                    <TableRow key={user.user_Id} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-[#2A174E] py-4 px-6">{formatUserId(user.user_Id)}</TableCell>
                      <TableCell className="font-medium text-slate-800 py-4">
                          {user.user_FirstName || user.user_LastName ? (
                            <span 
                              className="inline-block max-w-37.5 truncate align-bottom" 
                              title={`${user.user_FirstName} ${user.user_LastName}`}
                            >
                              {`${user.user_FirstName} ${user.user_LastName}`}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      <TableCell className="text-slate-600 py-4">
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">
                          {user.user_Role}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(user.user_EmploymentStatus)}`}>
                          {user.user_EmploymentStatus || "—"}
                        </span>
                      </TableCell>
                     <TableCell className="py-4 hidden md:table-cell font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="tracking-wider">
                          {user.user_MachipId   
                            ? (isMachipRevealed 
                                ? user.user_MachipId 
                                : "••••••••••••") 
                            : "—"}
                        </span>
                        {user.user_MachipId && (
                          <button
                            type="button"
                            onClick={() => toggleMachipVisibility(user.user_Id)}
                            className="text-slate-400 hover:text-[#2A174E] transition-colors p-0.5 rounded focus:outline-none"
                            title={isMachipRevealed ? "Hide MaChip ID" : "Show MaChip ID"}
                          >
                            {isMachipRevealed ? (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </TableCell>
                      <TableCell className="text-slate-500 py-4 hidden md:table-cell">
                          {user.user_Email ? (
                            <span 
                              className="inline-block max-w-[90px] truncate align-bottom" 
                              title={user.user_Email}
                            >
                              {user.user_Email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex justify-end items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  asChild 
                                  className=" border-[#d1c4e9] text-[#5b3fa6] hover:bg-[#f0ebfa] hover:border-[#9c7de0] transition-colors"
                                >
                                  <Link to={`/users/${user.user_Id}`}>
                                    <EyeIcon className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-slate-900 text-white border-slate-800">
                              View Profile
                            </TooltipContent>
                          </Tooltip>
                          {isAdminOrAccountant && currentUser?.user_Id !== user.user_Id && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-colors" 
                                    onClick={() => initiateArchive(user.user_Id)}
                                  >
                                    <Archive className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                Archive User
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <SearchIcon className="h-8 w-8 text-slate-300 mb-2" />
                        <span className="font-semibold text-slate-600">No users found</span>
                        <span className="text-sm text-slate-400">Try adjusting your search or filters.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-slate-100 gap-4 bg-slate-50/30">
              
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline">Rows per page:</span>
                  <Select 
                    value={itemsPerPage.toString()} 
                    onValueChange={(val) => setItemsPerPage(Number(val))}
                  >
                    <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="font-medium">
                  Showing <span className="text-slate-800">{startIndex + 1}</span> to <span className="text-slate-800">{endIndex}</span> of <span className="text-slate-800">{totalItems}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Previous
                </Button>
                
                <div className="flex items-center justify-center min-w-[32px] h-8 text-sm font-semibold text-[#2A174E] bg-[#2A174E]/10 rounded-md">
                  {currentPage}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Next
                </Button>
              </div>

            </div>
          )}
        </CardContent>
      </Card>

      <ActionModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={confirmArchive}
        variant="danger"
        title="Confirm Archival"
        message="Are you sure you want to archive this user? They will be moved to the Archived Users list."
      />
    </div>
    </TooltipProvider>
  );
};

export default Datatable;