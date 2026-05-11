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

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    const matchesSearch = (
      user.user_FirstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_Email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.user_Id?.toString().includes(searchTerm)
    );

    const matchesRole = roleFilter === "All Roles" || user.user_Role === roleFilter;
    const matchesStatus = statusFilter === "All Statuses" || user.user_EmploymentStatus === statusFilter;

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

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-4">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">User Management</h1>
          <span className="text-sm text-muted-foreground mt-1 block">Manage user accounts and roles</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {isAdminOrAccountant && (
            <>
              <Button 
                variant="outline" 
                asChild 
                className="w-full sm:w-auto border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors"
              >
                <Link to="/users/archived">
                  <ArchiveIcon className="h-4 w-4 mr-1" /> Archived
                </Link>
              </Button>
              <Button 
                asChild 
                className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]"
              >
                <Link to="/users/newUser">
                  <PersonAddIcon className="h-4 w-4 mr-1" /> Add User
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="h-2"></div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
        {/* Card 1: Total Active Users */}
        <Card className="shadow-sm border-0 bg-[#FAF2FF] py-0 h-full">
          <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Active Users</p>
              <p className="text-4xl font-bold text-[#2A174E]">{stats.total}</p>
            </div>
            <p className="text-xs text-[#2A174E]/70 italic mt-4">Total registered active accounts</p>
          </CardContent>
        </Card>

        {/* Card 2: Employees */}
        <Card className="shadow-sm border-0 bg-[#F8FFF2] py-0 h-full">
          <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Employees</p>
              <p className="text-4xl font-bold text-[#3B4E17]">{stats.employees}</p>
            </div>
            <p className="text-xs text-[#3B4E17]/70 italic mt-4">Active standard staff records</p>
          </CardContent>
        </Card>

        {/* Card 3: Admins & Supervisors */}
        <Card className="shadow-sm border-0 bg-[#FFFFF2] py-0 h-full">
          <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Admin & Supervisor</p>
              <p className="text-4xl font-bold text-[#BB8B26]">{stats.admins}</p>
            </div>
            <p className="text-xs text-[#BB8B26]/70 italic mt-4">Active management records</p>
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
                <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
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
                <SelectTrigger className="w-full sm:w-[160px] border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Statuses">All Statuses</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
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
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-[#2B174F]">
                <TableRow className="hover:bg-transparent border-b-slate-200">
                  <TableHead className="font-semibold text-slate-700 py-4 px-6 uppercase text-xs tracking-wider text-white">User ID</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider text-white">Full Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider text-white">Role</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider text-white hidden md:table-cell">MaChip ID</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider text-white hidden md:table-cell">Email</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider text-white text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((user) => (
                    <TableRow key={user.user_Id} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-[#2A174E] py-4 px-6">{formatUserId(user.user_Id)}</TableCell>
                      <TableCell className="font-medium text-slate-800 py-4">{`${user.user_FirstName} ${user.user_LastName}`}</TableCell>
                      <TableCell className="text-slate-600 py-4">
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold">
                          {user.user_Role}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-400 py-4 hidden md:table-cell font-mono text-xs">{user.user_MachipId || "—"}</TableCell>
                      <TableCell className="text-slate-500 py-4 hidden md:table-cell">{user.user_Email || "—"}</TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex justify-end items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild 
                            className="border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors"
                          >
                            <Link to={`/users/${user.user_Id}`}>View</Link>
                          </Button>
                          {isAdminOrAccountant && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-colors" 
                              onClick={() => initiateArchive(user.user_Id)}
                            >
                              Archive
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
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
  );
};

export default Datatable;