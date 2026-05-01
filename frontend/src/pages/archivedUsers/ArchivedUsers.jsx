import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import SearchIcon from "@mui/icons-material/Search";
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PermanentDeleteModal from "../../components/permanentDeleteModal/PermanentDeleteModal";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link } from "react-router-dom";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All Types");

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

  // Filter and Search Logic
  const filteredUsers = archivedUsers.filter(u => {
    const fullName = `${u.user_FirstName} ${u.user_LastName}`.toLowerCase();
    const email = (u.user_Email || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(query) || email.includes(query);
    const matchesFilter = filterType === "All Types" || u.user_Role === (filterType === "Employees" ? "Employee" : "Admin");

    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: archivedUsers.length,
    employees: archivedUsers.filter(u => u.user_Role === "Employee").length,
    admins: archivedUsers.filter(u => u.user_Role === "Admin").length,
  };

  const handleSearchClick = () => {
    // Example: You could trigger a refresh or simply log the query
    console.log("Searching for:", searchQuery);
    // fetchArchivedUsers(); // If you wanted to re-fetch from API on click
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <div className="flex-1 p-4 md:p-8 w-full overflow-x-hidden min-w-0">
        
        {/* Header section with back button */}
        <div className="flex items-start md:items-center gap-4 mb-8">
          <Link 
            to="/users" 
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f0ebfa] text-[#2A174E] transition-colors shrink-0 mt-1 md:mt-0"
          >
            <ArrowBackIcon className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight">Archived Users</h1>
            <span className="text-sm text-slate-500 mt-1 block">Manage archived user records - restore or permanently delete</span>
          </div>
        </div>
        <div className="h-4"></div>

        {/* Statistics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="px-4 py-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Archived</p>
              <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="px-4 py-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Employee</p>
              <p className="text-3xl font-bold text-blue-600">{stats.employees}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0 bg-white">
            <CardContent className="px-4 py-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin</p>
              <p className="text-3xl font-bold text-[#2A174E]">{stats.admins}</p>
            </CardContent>
          </Card>
        </div>
        <div className="h-4"></div>

        {/* Filters Card */}
        <Card className="mb-6 shadow-sm border-0 bg-white">
          <CardContent className="px-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:flex-1">
              <SearchIcon 
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 cursor-pointer hover:text-[#2A174E] transition-colors" 
                onClick={handleSearchClick}
              />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-50/50 border-slate-200 focus-visible:ring-[#2A174E] w-full"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="w-full md:w-48 shrink-0">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="bg-slate-50/50 border-slate-200 focus:ring-[#2A174E] w-full">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Types">All Types</SelectItem>
                    <SelectItem value="Employees">Employees</SelectItem>
                    <SelectItem value="Admins">Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(searchQuery !== "" || filterType !== "All Types") && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("All Types");
                  }}
                  className="text-slate-500 hover:text-red-500 transition-colors"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="h-4"></div>

        {/* Table Card */}
        <Card className="shadow-sm border-0 bg-white">
          <CardContent className="px-4 py-0 overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b-slate-200">
                  <TableHead className="font-semibold text-slate-700 py-4">User ID</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Email</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">User Type</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4">Archived Date</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_Id} className="border-b-slate-100 hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-800 py-4">{formatUserId(user.user_Id)}</TableCell>
                      <TableCell className="font-semibold text-slate-800 py-4">{user.user_FirstName} {user.user_LastName}</TableCell>
                      <TableCell className="text-slate-600 py-4">{user.user_Email || "—"}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold">
                          {user.user_Role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 py-4">
                        {user.deletedAt ? new Date(user.deletedAt).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-green-500 text-green-600 hover:bg-green-500 hover:text-white transition-colors"
                            onClick={() => handleRestore(user)}
                          >
                            <RestoreIcon className="mr-1 h-4 w-4" /> Restore
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
                            onClick={() => initiatePermanentDelete(user)}
                          >
                            <DeleteOutlineIcon className="mr-1 h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                      No archived users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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