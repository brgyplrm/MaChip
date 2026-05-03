import Sidebar from "../../components/Sidebar";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import DriveFolderUploadOutlinedIcon from "@mui/icons-material/DriveFolderUploadOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RfidScanModal from "../../components/rfidScanModal/RfidScanModal";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateForm = (formData) => {
  const errors = {};
  if (!formData.user_FirstName.trim()) errors.user_FirstName = "Required";
  if (!formData.user_LastName.trim()) errors.user_LastName = "Required";
  if (!formData.user_Email.trim()) {
    errors.user_Email = "Email is required.";
  } else if (!EMAIL_REGEX.test(formData.user_Email.trim())) {
    errors.user_Email = "Invalid email.";
  }
  if (!formData.user_Password || formData.user_Password.length < 6) {
    errors.user_Password = "Min 6 characters.";
  }
  return errors;
};

const New = ({ inputs, title }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState("");
  const [displayId, setDisplayId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showRfidModal, setShowRfidModal] = useState(false);
  const [rfidError, setRfidError] = useState("");
  
  // Single Registration State
  const [formData, setFormData] = useState({
    user_Id: "",
    user_FirstName: "",
    user_LastName: "",
    user_MiddleName: "",
    user_EmploymentStatus: "",
    user_Role: "Employee",
    user_Email: "",
    user_Password: "",
    user_MachipId: "",
    user_FingerprintId: "",
    user_FingerprintTemplate: "",
    account_Number: "",
    user_RoleId: 3,
  });

  // Batch Upload State
  const [csvFile, setCsvFile] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const dismissToast = useCallback(() => setToast({ message: "", type: "success" }), []);

  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");

  const handleScanFingerprint = async () => {
    setShowFingerprintModal(true); 
    setFormData(prev => ({ ...prev, user_FingerprintId: "", user_FingerprintTemplate: "" }));
    setFingerprintError("");

    try {
      const response = await fetchWithAuth(`/api/users/generateFingerprint?userId=${formData.user_Id}`);
      const data = await response.json();

      if (response.ok) {
        setFormData((prev) => ({ 
          ...prev, 
          user_FingerprintId: data.fingerprintId,
          user_FingerprintTemplate: data.template || "" 
        }));
        setToast({
          message: `Fingerprint registered: ${data.fingerprintId}`,
          type: "success",
        });
      } else {
        setFingerprintError(data.error || "Failed to scan fingerprint.");
        setToast({ message: data.error || "Scan failed.", type: "error" });
      }
    } catch (err) {
      setFingerprintError("An error occurred during scanning.");
      setToast({ message: "An error occurred.", type: "error" });
    }
  };

  useEffect(() => {
    const fetchNextId = async () => {
      try {
        const response = await fetchWithAuth("/api/users/nextId");
        if (response.ok) {
          const data = await response.json();
          setFormData((prev) => ({ ...prev, user_Id: data.nextId }));
          setDisplayId(data.displayId);
        }
      } catch (err) { console.error(err); }
    };
    fetchNextId();
  }, []);

  const handleInput = (e) => {
    const { id, value } = e.target;
    
    setFormData((prev) => {
      const updated = { ...prev, [id]: value };
      
      if (id === "user_Id") {
        const numericMatch = value.match(/\d+/);
        const numericId = numericMatch ? parseInt(numericMatch[0], 10) : "";
        updated.user_Id = numericId;
        setDisplayId(value);
      }
      
      if (id === "user_Role") {
        updated.user_RoleId = value === "Admin" ? 1 : value === "Supervisor" ? 2 : 3;
      }
      if (id === "user_EmploymentStatus") {
        updated.user_EmploymentStatusId = value === "Regular" ? 1 : value === "Part-time" ? 2 : 3;
      }
      
      return updated;
    });

    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleIdBlur = () => {
    if (formData.user_Id) {
      setDisplayId(`MACJ-${String(formData.user_Id).padStart(3, "0")}`);
    }
  };

  const handleScanRFID = async () => {
    setShowRfidModal(true); 
    setFormData(prev => ({ ...prev, user_MachipId: "" }));
    setRfidError("");

    try {
      const response = await fetchWithAuth("/api/users/generateRfid");
      const data = await response.json();

      if (response.ok) {
        setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
        setToast({
          message: `New MaChip scanned: ${data.rfid}`,
          type: "success",
        });
      } else {
        setRfidError(data.error || "Failed to scan RFID. Please try again.");
        if (data.rfid) setFormData((prev) => ({ ...prev, user_MachipId: data.rfid }));
        setToast({ message: data.error || "Failed to scan RFID.", type: "error" });
      }
    } catch (err) {
      console.error("Error scanning RFID:", err);
      setRfidError("An error occurred while scanning.");
      setToast({ message: "An error occurred while scanning.", type: "error" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setToast({ message: "Check required fields.", type: "error" });
      return;
    }

    setLoading(true);
    const data = new FormData();
    
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== undefined && formData[key] !== null) {
        data.append(key, formData[key]);
      }
    });
    
    if (!formData.user_EmploymentStatusId) data.append("user_EmploymentStatusId", 1);
    if (!formData.user_RoleId) data.append("user_RoleId", 3);

    if (file) {
      data.append("user_ProfilePic", file);
    }

    try {
      const response = await fetchWithAuth("/api/users/registerUser", {
        method: "POST",
        body: data,
      });

      if (response.ok) {
        setToast({ message: "User added successfully!", type: "success" });
        setTimeout(() => {
          navigate("/users");
        }, 1100);
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || "Failed to add user.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Something went wrong.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // --- BATCH PROCESSING LOGIC ---
  const downloadCsvTemplate = () => {
    const headers = "user_FirstName,user_LastName,user_MiddleName,user_Email,user_Password,user_Role,user_EmploymentStatus,account_Number\n";
    const sample = "John,Doe,Smith,john.doe@example.com,password123,Employee,Regular,1234567890\n";
    const blob = new Blob([headers + sample], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "user_batch_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.type === "text/csv" || selectedFile.name.endsWith('.csv'))) {
      setCsvFile(selectedFile);
    } else {
      setToast({ message: "Please upload a valid CSV file.", type: "error" });
      e.target.value = null;
      setCsvFile(null);
    }
  };

  const handleBatchSubmit = async () => {
    if (!csvFile) {
      setToast({ message: "Please select a CSV file first.", type: "error" });
      return;
    }
    setBatchLoading(true);
    const formData = new FormData();
    formData.append("csvFile", csvFile);

    try {
      const response = await fetchWithAuth("/api/users/batch-register", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        setToast({ message: "Batch upload successful!", type: "success" });
        setCsvFile(null);
        setTimeout(() => navigate("/users"), 1500);
      } else {
        const err = await response.json();
        setToast({ message: err.error || "Batch upload failed.", type: "error" });
      }
    } catch (error) {
       setToast({ message: "Connection error.", type: "error" });
    } finally {
       setBatchLoading(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    const formattedStatus = status?.toLowerCase().replace(" ", "") || "regular";
    if (formattedStatus === "regular") return "bg-green-100 text-green-800 hover:bg-green-100";
    if (formattedStatus === "part-time") return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    return "bg-amber-100 text-amber-800 hover:bg-amber-100"; 
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-50">
      <Sidebar>
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />  
      <div className="flex-1 p-4 md:p-4 w-full overflow-x-hidden min-w-0 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2A174E]">{title}</h1>
        </div>

        <Tabs defaultValue="single" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3 h-12 bg-slate-200/50">
            <TabsTrigger value="single" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] font-semibold text-slate-500">
              Single Registration
            </TabsTrigger>
            <TabsTrigger value="batch" className="data-[state=active]:bg-white data-[state=active]:text-[#2A174E] font-semibold text-slate-500">
              Batch Upload (CSV)
            </TabsTrigger>
          </TabsList>

          {/* SINGLE REGISTRATION TAB */}
          <TabsContent value="single" className="space-y-6 mt-0">
            <Card className="shadow-sm border-0 bg-white overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                
                {/* Left Column: Identity Preview */}
                <div className="w-full lg:w-1/3 bg-slate-50/50 border-b lg:border-b-0 lg:border-r border-slate-200 p-8 flex flex-col items-center">
                  <div className="relative mb-6">
                    <img
                      src={
                        file
                          ? URL.createObjectURL(file)
                          : formData.user_ProfilePic
                            ? `/api/uploads/${formData.user_ProfilePic}`
                            : "/avatar.webp"
                      }
                      alt="Profile Preview"
                      className="w-32 h-32 rounded-full object-cover border-4 border-[#2A174E] shadow-sm"
                    />
                    <div className="h-4"></div>
                    <div className="absolute -bottom-2 w-full flex justify-center">
                      <label htmlFor="file" className="cursor-pointer bg-white px-3 py-1 rounded-full shadow-md border border-slate-200 flex items-center gap-1 text-sm font-semibold text-[#2A174E] hover:text-[#45297e] transition-colors">
                        <DriveFolderUploadOutlinedIcon fontSize="small" /> Upload
                      </label>
                      <input
                        type="file"
                        id="file"
                        onChange={(e) => {
                          const selectedFile = e.target.files[0];
                          if (selectedFile) {
                            const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                            if (!allowedTypes.includes(selectedFile.type)) {
                              setToast({ message: "Invalid format. Only PNG, JPG, and JPEG allowed!", type: "error" });
                              e.target.value = null;
                              return;
                            }
                            setFile(selectedFile);
                          }
                        }}
                        className="hidden"
                      />
                    </div>
                  </div>
                  <div className="h-4"></div>

                  <h2 className="text-xl font-bold text-[#2A174E] capitalize text-center mb-2">
                    {formData.user_FirstName || "First"} {formData.user_LastName || "Last"}
                  </h2>
                  <div className="h-4"></div>
                  <p className="text-sm font-medium text-slate-500 mb-4">
                    {formData.user_Role || "Select Role"}
                  </p>
                  <Badge variant="secondary" className={`font-bold uppercase tracking-wider ${getStatusBadgeStyle(formData.user_EmploymentStatus)}`}>
                    {formData.user_EmploymentStatus || "Regular"}
                  </Badge>
                </div>

                {/* Right Column: Form */}
                <div className="w-full lg:w-2/3 p-6 md:p-8">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Full Name Section */}
                    <div className="space-y-2">
                      <Label className="text-slate-600 font-semibold">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Input id="user_FirstName" placeholder="First Name" value={formData.user_FirstName} onChange={handleInput} className={`bg-white ${errors.user_FirstName ? "border-red-500" : ""}`} />
                          {errors.user_FirstName && <span className="text-xs text-red-500">{errors.user_FirstName}</span>}
                        </div>
                        <div className="space-y-1">
                          <Input id="user_MiddleName" placeholder="Middle Name" value={formData.user_MiddleName} onChange={handleInput} className="bg-white" />
                        </div>
                        <div className="space-y-1">
                          <Input id="user_LastName" placeholder="Last Name" value={formData.user_LastName} onChange={handleInput} className={`bg-white ${errors.user_LastName ? "border-red-500" : ""}`} />
                          {errors.user_LastName && <span className="text-xs text-red-500">{errors.user_LastName}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Inputs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {inputs.map((input) => (
                        <div key={input.id} className="space-y-2">
                          <Label className="text-slate-600 font-semibold">{input.label} <span className="text-red-500">*</span></Label>
                          <div className="h-1"></div>
                          {input.type === "select" ? (
                            <Select 
                              value={formData[input.id] || ""} 
                              onValueChange={(val) => handleInput({ target: { id: input.id, value: val } })}
                            >
                              <SelectTrigger className="bg-white w-full">
                                <SelectValue placeholder={`Select ${input.label}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {input.id === "user_EmploymentStatus" && (
                                  <>
                                    <SelectItem value="Regular">Regular</SelectItem>
                                    <SelectItem value="Part-time">Part-time</SelectItem>
                                    <SelectItem value="Intern / OJT">Intern / OJT</SelectItem>
                                  </>
                                )}
                                {input.id === "user_Role" && (
                                  <>
                                    <SelectItem value="Employee">Employee</SelectItem>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex gap-2 relative">
                              <div className="relative flex-1">
                                <Input
                                  id={input.id}
                                  type={
                                    (input.id === "user_Password" && showPassword) || 
                                    (input.id === "account_Number" && showAccountNumber) 
                                      ? "text" 
                                      : input.type
                                  }
                                  placeholder={input.placeholder}
                                  value={input.id === "user_Id" ? displayId : formData[input.id]}
                                  onChange={handleInput}
                                  onBlur={input.id === "user_Id" ? handleIdBlur : undefined}
                                  readOnly={input.label === "MaChip ID" || input.label === "Fingerprint ID"}
                                  className={`bg-white ${errors[input.id] ? "border-red-500" : ""} ${input.label === "MaChip ID" || input.label === "Fingerprint ID" ? "bg-slate-100 text-slate-500" : ""}`}
                                />
                                
                                {/* Visibility Toggles */}
                                {input.id === "user_Password" && (
                                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                  </button>
                                )}
                                {input.id === "account_Number" && (
                                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowAccountNumber(!showAccountNumber)}>
                                    {showAccountNumber ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                  </button>
                                )}
                              </div>

                              {/* Scan Buttons next to input */}
                              {input.label === "MaChip ID" && (
                                <Button type="button" variant="secondary" className="shrink-0 bg-[#2A174E] text-white hover:bg-[#1a0e30]" onClick={handleScanRFID}>
                                  SCAN
                                </Button>
                              )}
                              {input.label === "Fingerprint ID" && (
                                <Button type="button" variant="secondary" className="shrink-0 bg-[#2A174E] text-white hover:bg-[#1a0e30]" onClick={handleScanFingerprint}>
                                  SCAN
                                </Button>
                              )}
                            </div>
                          )}
                          {errors[input.id] && <span className="text-xs text-red-500 block">{errors[input.id]}</span>}
                        </div>
                      ))}
                    </div>

                  </form>
                </div>
              </div>
            </Card>

            <div className="flex flex-col-reverse sm:flex-row justify-center gap-4 mt-4">
              <Button 
                variant="outline" 
                className="w-full sm:w-40 border-slate-300 shadow-sm" 
                onClick={() => navigate("/users")} 
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                className="w-full sm:w-40 bg-[#2A174E] hover:bg-[#1a0e30] text-white shadow-sm" 
                onClick={handleSubmit} 
                disabled={loading}
              >
                {loading ? "Adding..." : "Add User"}
              </Button>
            </div>
          </TabsContent>

          {/* BATCH UPLOAD TAB */}
          <TabsContent value="batch" className="mt-0">
            <Card className="shadow-sm border-0 bg-white">
              <CardContent className="flex flex-col items-center justify-center p-8 md:p-16 min-h-[400px]">
                
                <div className="bg-slate-50 p-6 rounded-full mb-6">
                  <UploadFileIcon className="text-[#2A174E] h-16 w-16 opacity-80" />
                </div>
                
                <div className="text-center mb-10 max-w-lg">
                  <h3 className="text-2xl font-bold text-[#2A174E] mb-2">Upload CSV File</h3>
                  <p className="text-slate-500 leading-relaxed">
                    Register multiple users quickly by uploading a properly formatted CSV file. 
                    If you don't have the template yet, download it below to get started.
                  </p>
                </div>
                
                <div className="flex flex-col items-center gap-5 w-full max-w-md">
                  
                  <Button 
                    variant="outline" 
                    onClick={downloadCsvTemplate} 
                    className="w-full h-12 text-[#2A174E] border-[#2A174E] hover:bg-[#f0ebfa] font-semibold"
                  >
                    <FileDownloadOutlinedIcon className="mr-2 h-5 w-5" /> Download CSV Template
                  </Button>
                  
                  <div className="w-full relative border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                    <Input 
                      type="file" 
                      accept=".csv" 
                      onChange={handleCsvChange} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <div className="pointer-events-none">
                      {csvFile ? (
                        <p className="text-green-600 font-semibold flex items-center justify-center gap-2">
                          <span className="truncate max-w-[200px]">{csvFile.name}</span> selected
                        </p>
                      ) : (
                        <p className="text-slate-500 font-medium">Click to browse or drag and drop a .csv file here</p>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={handleBatchSubmit} 
                    disabled={batchLoading || !csvFile} 
                    className="w-full h-12 bg-[#2A174E] hover:bg-[#1a0e30] text-white font-semibold shadow-sm mt-2"
                  >
                    {batchLoading ? "Processing..." : "Upload and Register Users"}
                  </Button>

                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Modals */}
        <RfidScanModal 
          isOpen={showRfidModal} 
          onClose={() => setShowRfidModal(false)}
          onRescan={handleScanRFID}
          scannedId={formData.user_MachipId} 
          error={rfidError}
        />
        <RfidScanModal 
          isOpen={showFingerprintModal} 
          onClose={() => setShowFingerprintModal(false)}
          onRescan={handleScanFingerprint}
          scannedId={formData.user_FingerprintId} 
          error={fingerprintError}
          title="Fingerprint Scanner" 
        />
      </div>
      </Sidebar>
    </div>
  );
};

export default New;