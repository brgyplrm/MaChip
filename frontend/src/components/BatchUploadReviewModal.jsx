import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";

const BatchUploadReviewModal = ({ isOpen, onClose, data, onConfirm, type }) => {
  const [editedData, setEditedData] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValues, setEditValues] = useState({});

  useEffect(() => {
    if (data) {
      setEditedData(data);
    }
  }, [data]);

  const handleStartEdit = (index, item) => {
    setEditingIndex(index);
    setEditValues(item);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValues({});
  };

  const handleSaveEdit = (index) => {
    const newData = [...editedData];
    newData[index] = editValues;
    setEditedData(newData);
    setEditingIndex(null);
    setEditValues({});
  };

  const handleValueChange = (key, value) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const handleDelete = (index) => {
    setEditedData(prev => prev.filter((_, i) => i !== index));
  };

  const getHeaders = () => {
    if (editedData.length === 0) return [];
    return Object.keys(editedData[0]);
  };

  const headers = getHeaders();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[950px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-slate-50 border-b">
          <DialogTitle className="text-[#2A174E] text-xl font-bold flex items-center gap-2">
            <EditIcon className="text-[#2A174E]" />
            Review {type} Batch Data
          </DialogTitle>
          <p className="text-slate-500 text-sm">Review and edit records before final system import.</p>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  {headers.map(header => (
                    <TableHead key={header} className="capitalize font-bold text-[#2A174E]">
                      {header.replace('_', ' ')}
                    </TableHead>
                  ))}
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editedData.length > 0 ? (
                  editedData.map((item, index) => (
                    <TableRow key={index} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-center text-slate-400 text-xs font-mono">{index + 1}</TableCell>
                      {headers.map(header => (
                        <TableCell key={header}>
                          {editingIndex === index ? (
                            <Input 
                              value={editValues[header] || ""} 
                              onChange={(e) => handleValueChange(header, e.target.value)}
                              className="h-9 text-sm focus-visible:ring-[#2A174E]"
                            />
                          ) : (
                            <span className="text-sm font-medium text-slate-700">{item[header]}</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          {editingIndex === index ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 bg-green-50 hover:bg-green-100" onClick={() => handleSaveEdit(index)}>
                                <CheckIcon className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 bg-red-50 hover:bg-red-100" onClick={handleCancelEdit}>
                                <CloseIcon className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-[#2A174E] hover:bg-slate-100" onClick={() => handleStartEdit(index, item)}>
                                <EditIcon className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(index)}>
                                <DeleteIcon className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={headers.length + 2} className="h-32 text-center text-slate-400 italic">
                      No records to display.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={onClose} className="w-full sm:flex-1 h-11">
            Discard & Close
          </Button>
          <Button 
            className="w-full sm:flex-[2] h-11 bg-[#2A174E] hover:bg-[#1a0e30] text-white font-bold shadow-lg shadow-[#2A174E]/20"
            onClick={() => onConfirm(editedData)}
            disabled={editedData.length === 0}
          >
            Proceed with Import ({editedData.length} Records)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchUploadReviewModal;
