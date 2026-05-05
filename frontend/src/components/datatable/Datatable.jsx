import React from "react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import ActionModal from "../../components/actionModal/ActionModal";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Datatable = () => {
  const [data, setData] = useState([]);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [userToArchive, setUserToArchive] = useState(null);

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
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

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-4">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">User Management</h1>
          <span className="text-sm text-muted-foreground mt-1 block">Manage user accounts and roles</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            asChild 
            className="w-full sm:w-auto border-[#2A174E] text-[#2A174E] hover:bg-[#2A174E] hover:text-white transition-colors"
          >
            <Link to="/users/archived">View Archived</Link>
          </Button>
          <Button 
            asChild 
            className="w-full sm:w-auto bg-[#2A174E] text-white hover:bg-[#1a0e30]"
          >
            <Link to="/users/newUser">Add New User</Link>
          </Button>
        </div>
      </div>


      {/* Table Card */}
      <Card className="shadow-sm border-0 bg-white p-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* The min-w forces the table to stay wide enough, triggering scroll on mobile instead of squishing */}
            <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b-slate-200">
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider">User ID</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider">Full Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider">Role</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider hidden md:table-cell">MaChip ID</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider hidden md:table-cell">Email</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-4 uppercase text-xs tracking-wider text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length > 0 ? (
                  data.map((user) => (
                    <TableRow key={user.user_Id} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-[#2A174E] py-4">{formatUserId(user.user_Id)}</TableCell>
                      <TableCell className="font-medium text-slate-800 py-4">{`${user.user_FirstName} ${user.user_LastName}`}</TableCell>
                      <TableCell className="text-slate-600 py-4">{user.user_Role}</TableCell>
                      <TableCell className="text-slate-400 py-4 hidden md:table-cell">{user.user_MachipId || "—"}</TableCell>
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white transition-colors" 
                            onClick={() => initiateArchive(user.user_Id)}
                          >
                            Archive
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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