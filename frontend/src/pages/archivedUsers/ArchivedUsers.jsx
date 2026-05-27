import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PermanentDeleteModal from "../../components/permanentDeleteModal/PermanentDeleteModal";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link } from "react-router-dom";
import EmptyState from "../../components/EmptyState";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ArchivedUsers = () => {
  const [showPermDelete, setShowPermDelete] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  const fetchArchivedUsers = async () => {
    try {
      const response = await fetchWithAuth("/api/users/archived");
      if (response.ok) {
        const data = await response.json();
        setArchivedUsers(data);
      }
    } catch (err) {
      console.error("Error fetching archived users:", err);
    }
  };

  useEffect(() => {
    fetchArchivedUsers();
  }, []);

  // Reset to page 1 whenever filters or search terms change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, itemsPerPage]);

  const handleRestore = async (user) => {
    try {
      const response = await fetchWithAuth(`/api/users/restoreUser/${user.user_Id}`, {
        method: "PATCH",
      });
      if (response.ok) {
        setArchivedUsers((prev) => prev.filter((u) => u.user_Id !== user.user_Id));
        setToast({ message: `${user.user_FirstName} ${user.user_LastName} restored successfully.`, type: "success" });
      } else {
        const err = await response.json();
        setToast({ message: err.message || "Failed to restore user.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Network error.", type: "error" });
    }
  };

  const handleActualPermanentDelete = async () => {
    if (!targetUser) return;

    setLoading(true);

    try {
      const response = await fetchWithAuth(
        `/api/users/forceDelete/${targetUser.user_Id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setArchivedUsers((prev) => prev.filter((u) => u.user_Id !== targetUser.user_Id));
        setToast({
          message: `${targetUser.user_FirstName} ${targetUser.user_LastName} has been permanently removed.`,
          type: "success",
        });
      } else {
        const errorData = await response.json();
        setToast({
          message: errorData.error || "Failed to delete user.",
          type: "error",
        });
      }
    } catch (err) {
      setToast({ message: "Network error.", type: "error" });
    } finally {
      setLoading(false);
      setShowPermDelete(false);
      setTargetUser(null);
    }
  };

  const initiatePermanentDelete = (user) => {
    setTargetUser(user);
    setShowPermDelete(true);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setRoleFilter("All Roles");
    setStatusFilter("All Statuses");
    setCurrentPage(1);
  };

  const isFiltering = searchQuery !== "" || roleFilter !== "All Roles" || statusFilter !== "All Statuses";

  // Filter and Search Logic
  const filteredUsers = archivedUsers.filter(u => {
    const fullName = `${u.user_FirstName} ${u.user_LastName}`.toLowerCase();
    const email = (u.user_Email || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(query) || email.includes(query) || u.user_Id?.toString().includes(query);
    const matchesRole = roleFilter === "All Roles" || u.user_Role === roleFilter;
    const matchesStatus = statusFilter === "All Statuses" || u.user_EmploymentStatus === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination Logic
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  
  // The actual slice of data to render on the current page
  const currentData = filteredUsers.slice(startIndex, endIndex);

  // Stats calculate from all fetched, not filtered (to show overall context)
  const stats = {
    total: archivedUsers.length,
    employees: archivedUsers.filter(u => u.user_Role === "Employee").length,
    admins: archivedUsers.filter(u => u.user_Role !== "Employee").length,
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <div className="p-2 md:p-4 overflow-x-hidden w-full max-w-6xl mx-auto">
        
        {/* Header section with hover-back button */}
            <div className="group flex items-start md:items-center gap-0 mb-6 transition-all">
              {/* Back Button: Hidden by default, slides and fades in on hover */}
              <div className="w-0 overflow-hidden group-hover:w-10 transition-all duration-300 ease-in-out">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  asChild 
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#2A174E]"
                >
                  <Link to="/users">
                    <ArrowBackIcon className="h-6 w-6" />
                  </Link>
                </Button>
              </div>

              {/* Title: Adds left padding when hovered */}
              <div className="transition-all duration-300 ease-in-out group-hover:pl-2">
                <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E] leading-tight">Archived Users</h1>
                <span className="text-sm text-slate-500 mt-1 block">Manage archived user records - restore or permanently delete</span>
              </div>
            </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6 mb-6 w-full">
          {/* Card 1: Total Active Users */}
          <Card className="border-t-5 border-[#2A174E] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold text-[#2A174E] uppercase tracking-wider mb-2">Total Archived</p>
                <p className="text-4xl font-bold text-[#2A174E]">{stats.total}</p>
              </div>
              <p className="text-xs text-[#2A174E]/70 italic mt-4">Total registered active accounts</p>
            </CardContent>
          </Card>
  
          {/* Card 2: Employees */}
          <Card className="border-t-5 border-[#3B4E17] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold text-[#3B4E17] uppercase tracking-wider mb-2">Employees</p>
                <p className="text-4xl font-bold text-[#3B4E17]">{stats.employees}</p>
              </div>
              <p className="text-xs text-[#3B4E17]/70 italic mt-4">Active standard staff records</p>
            </CardContent>
          </Card>
  
          {/* Card 3: Admins & Supervisors */}
          <Card className="border-t-5 border-[#BB8B26] bg-white py-0 h-full">
            <CardContent className="px-5 py-5 flex flex-col justify-between h-full">
              <div>
                <p className="text-xs font-bold text-[#BB8B26] uppercase tracking-wider mb-2">Admin & Supervisor</p>
                <p className="text-4xl font-bold text-[#BB8B26]">{stats.admins}</p>
              </div>
              <p className="text-xs text-[#BB8B26]/70 italic mt-4">Active management records</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card className="shadow-sm border-0 bg-white mb-6 py-0">
          <CardContent className="p-4 sm:p-6 flex flex-col xl:flex-row gap-4 items-center justify-between">
            
            {/* Search Bar */}
            <div className="relative w-full xl:max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by ID, Name, or Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                <TableHeader className="bg-[#2A174E]">
                  <TableRow className="hover:bg-transparent border-b-slate-200">
                    <TableHead className="font-semibold text-white py-4 px-6 uppercase text-xs tracking-wider">User ID</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Name</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Email</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Role</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider">Archived Date</TableHead>
                    <TableHead className="font-semibold text-white py-4 uppercase text-xs tracking-wider text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.length > 0 ? (
                    currentData.map((user) => (
                      <TableRow key={user.user_Id} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-bold text-[#2A174E] py-4 px-6">{formatUserId(user.user_Id)}</TableCell>
                        <TableCell className="font-semibold text-slate-800 py-4">{user.user_FirstName} {user.user_LastName}</TableCell>
                        <TableCell className="text-slate-600 py-4">{user.user_Email || "—"}</TableCell>
                        <TableCell className="py-4">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold">
                            {user.user_Role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 py-4 font-medium text-sm">
                          {user.deletedAt ? new Date(user.deletedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-green-500 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                              onClick={() => handleRestore(user)}
                            >
                              <RestoreIcon className=" h-4 w-4" />
                            </Button>
                            {currentUser?.user_Id !== user.user_Id && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                                onClick={() => initiatePermanentDelete(user)}
                              >
                                <DeleteOutlineIcon className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0 border-0">
                        {/* Utilizing your EmptyState component */}
                        <div className="p-8">
                          <EmptyState
                            icon={
                              isFiltering ? (
                                <SearchIcon className="h-8 w-8 text-slate-400" />
                              ) : (
                                <ArchiveOutlinedIcon className="h-8 w-8 text-slate-400" />
                              )
                            }
                            title={isFiltering ? "No matching records" : "No archived users"}
                            description={
                              isFiltering 
                                ? "We couldn't find anyone matching your search or filters. Try adjusting your criteria." 
                                : "There are no users currently in the archive. Records you delete will appear here."
                            }
                            action={isFiltering && (
                              <Button 
                                variant="outline" 
                                onClick={handleClearFilters}
                                className="text-slate-600 border-slate-200 hover:bg-slate-100 font-semibold rounded-lg"
                              >
                                Clear Filters
                              </Button>
                            )}
                          />
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

      </div>
      
      <PermanentDeleteModal
        isOpen={showPermDelete}
        onClose={() => setShowPermDelete(false)}
        onConfirm={handleActualPermanentDelete}
        itemName={targetUser ? `${targetUser.user_FirstName} ${targetUser.user_LastName}` : ""}
        loading={loading}
      />
      </Sidebar>
    </div>
  );
};

export default ArchivedUsers;