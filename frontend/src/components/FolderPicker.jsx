import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ComputerIcon from '@mui/icons-material/Computer';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import HomeIcon from '@mui/icons-material/Home';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { fetchWithAuth } from "../utils/api";

const FolderPicker = ({ onSelect, currentPath: initialPath, isOpen, onClose }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || "");
  const [directories, setDirectories] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [separator, setSeparator] = useState("/");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchDirs = async (path = "") => {
    setLoading(true);
    setError(null);
    try {
      const query = path ? `?currentPath=${encodeURIComponent(path)}` : "";
      const response = await fetchWithAuth(`/api/system/browse${query}`);
      const data = await response.json();
      if (response.ok) {
        setDirectories(data.directories);
        setCurrentPath(data.currentPath);
        setParentPath(data.parentPath);
        setSeparator(data.separator || "/");
      } else {
        setError(data.error || "Failed to load directories.");
      }
    } catch (err) {
      setError("Server error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirs(currentPath);
    }
  }, [isOpen]);

  const handleCreateFolder = async () => {
    if (!newFolderName) return;
    try {
      const response = await fetchWithAuth("/api/system/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath: currentPath, folderName: newFolderName }),
      });
      if (response.ok) {
        setNewFolderName("");
        setIsCreating(false);
        fetchDirs(currentPath);
      } else {
        const data = await response.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Error creating folder.");
    }
  };

  const filteredDirs = directories.filter(d => d.toLowerCase().includes(searchQuery.toLowerCase()));

  // Breadcrumbs logic
  const pathParts = currentPath.split(/[\\/]/).filter(p => p !== "");
  const isWindows = currentPath.includes(":");
  
  const navigateToBreadcrumb = (index) => {
    let newPath = "";
    if (isWindows) {
      newPath = pathParts.slice(0, index + 1).join(separator);
      if (index === 0 && !newPath.endsWith(separator)) newPath += separator;
    } else {
      newPath = separator + pathParts.slice(0, index + 1).join(separator);
    }
    fetchDirs(newPath);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-[#f3f3f3] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[600px] overflow-hidden border border-slate-300">
        
        {/* Title Bar (Windows 11 Style) */}
        <div className="h-10 flex justify-between items-center bg-white px-4 border-b border-slate-200 select-none">
          <div className="flex items-center gap-2">
            <FolderOpenIcon className="text-amber-500 h-4 w-4" />
            <span className="text-xs font-medium text-slate-600">File Explorer - Select Archive Folder</span>
          </div>
          <div className="flex items-center">
            <button onClick={onClose} className="hover:bg-red-500 hover:text-white h-10 w-12 flex items-center justify-center transition-colors">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="h-12 flex items-center gap-4 bg-white px-4 border-b border-slate-200">
           <div className="flex items-center gap-1">
             <Button 
               variant="ghost" 
               size="icon" 
               className="h-8 w-8 text-slate-600 disabled:text-slate-300" 
               disabled={!parentPath} 
               onClick={() => fetchDirs(parentPath)}
             >
               <ArrowBackIcon fontSize="small" />
             </Button>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 cursor-not-allowed">
               <ArrowBackIcon fontSize="small" className="rotate-180" />
             </Button>
           </div>

           {/* Address Bar */}
           <div className="flex-1 flex items-center bg-[#f9f9f9] border border-slate-200 rounded px-2 h-8 overflow-hidden group focus-within:bg-white focus-within:border-blue-500 transition-all">
              <ComputerIcon className="h-4 w-4 text-slate-400 mr-2" />
              <div className="flex items-center flex-1 overflow-x-auto no-scrollbar text-xs text-slate-700 whitespace-nowrap gap-1">
                 {isWindows ? null : <span className="hover:bg-slate-200 px-1 rounded cursor-pointer" onClick={() => fetchDirs("/")}>Root</span>}
                 {pathParts.map((part, i) => (
                   <React.Fragment key={i}>
                     <ChevronRightIcon className="h-3 w-3 text-slate-400" />
                     <span className="hover:bg-slate-200 px-1 rounded cursor-pointer" onClick={() => navigateToBreadcrumb(i)}>{part}</span>
                   </React.Fragment>
                 ))}
              </div>
           </div>

           {/* Search Bar */}
           <div className="w-48 flex items-center bg-[#f9f9f9] border border-slate-200 rounded px-2 h-8 focus-within:bg-white focus-within:border-blue-500 transition-all">
              <SearchIcon className="h-4 w-4 text-slate-400 mr-2" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none outline-none text-xs w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
        </div>

        {/* Action Bar */}
        <div className="h-10 flex items-center gap-4 px-4 bg-white border-b border-slate-200">
           <Button 
             variant="ghost" 
             size="sm" 
             className="text-xs flex items-center gap-2 h-8 hover:bg-slate-100"
             onClick={() => setIsCreating(true)}
           >
             <CreateNewFolderOutlinedIcon className="text-blue-500 h-4 w-4" /> New Folder
           </Button>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar (Quick Access) */}
          <div className="w-48 bg-[#f3f3f3] border-r border-slate-200 p-2 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#0067c0] bg-white rounded shadow-sm border border-slate-100">
                <HomeIcon className="h-4 w-4" />
                <span className="text-[11px] font-semibold">Quick access</span>
              </div>
              <div 
                className="flex items-center gap-2 px-2 py-1.5 text-slate-600 hover:bg-white/60 rounded cursor-pointer"
                onClick={() => fetchDirs(isWindows ? "C:\\" : "/")}
              >
                <DesktopWindowsIcon className="h-4 w-4 text-blue-400" />
                <span className="text-[11px]">Local Disk</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Locations</span>
              <div 
                className="flex items-center gap-2 px-2 py-1.5 text-slate-600 hover:bg-white/60 rounded cursor-pointer"
                onClick={() => fetchDirs("/")}
              >
                <FolderIcon className="h-4 w-4 text-amber-400" />
                <span className="text-[11px]">System Root</span>
              </div>
            </div>
          </div>

          {/* Folder Grid */}
          <div className="flex-1 bg-white overflow-y-auto p-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                 <p className="text-xs">Loading items...</p>
              </div>
            ) : error ? (
              <div className="text-center text-red-500 p-8 flex flex-col items-center gap-2">
                <p className="text-sm font-medium">{error}</p>
                <Button size="sm" variant="outline" onClick={() => fetchDirs("")}>Retry Root</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
                {isCreating && (
                  <div className="flex flex-col items-center p-2 rounded hover:bg-blue-50 group border border-blue-200 bg-blue-50/30">
                    <FolderIcon className="text-amber-400 h-10 w-10 mb-1" />
                    <input 
                      autoFocus
                      className="text-[11px] text-center w-full bg-white border border-blue-500 outline-none px-1"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFolder();
                        if (e.key === 'Escape') setIsCreating(false);
                      }}
                      onBlur={() => {
                        if (!newFolderName) setIsCreating(false);
                        else handleCreateFolder();
                      }}
                    />
                  </div>
                )}
                
                {filteredDirs.map(dir => (
                  <div 
                    key={dir} 
                    onClick={() => fetchDirs(`${currentPath}${currentPath.endsWith('/') || currentPath.endsWith('\\') ? '' : separator}${dir}`)}
                    className="flex flex-col items-center p-2 rounded hover:bg-blue-50 group cursor-pointer transition-colors border border-transparent hover:border-blue-100"
                  >
                    <FolderIcon className="text-amber-400 h-10 w-10 mb-1 group-hover:scale-105 transition-transform shadow-sm" />
                    <span className="text-[11px] text-slate-700 text-center truncate w-full px-1">{dir}</span>
                  </div>
                ))}

                {filteredDirs.length === 0 && !isCreating && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300">
                    <FolderOpenIcon className="h-12 w-12 mb-2 opacity-20" />
                    <p className="text-xs">No folders found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="h-14 bg-[#f3f3f3] border-t border-slate-200 flex items-center justify-between px-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Target Location:</span>
            <span className="text-[11px] text-slate-600 font-mono truncate max-w-md">{currentPath}</span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="h-8 text-xs bg-white hover:bg-slate-50 border-slate-300 px-6" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-6"
              onClick={() => onSelect(currentPath)}
            >
              Select Folder
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FolderPicker;
