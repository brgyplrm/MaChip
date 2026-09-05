import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DownloadIcon from "@mui/icons-material/Download";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const FileViewerModal = ({ isOpen, onClose, fileUrl, fileName }) => {
  if (!fileUrl) return null;

  const isPDF = fileUrl.toLowerCase().endsWith(".pdf");
  const fullUrl = fileUrl.startsWith("http") ? fileUrl : `/api/uploads/${fileUrl}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl md:max-w-5xl w-[96vw] max-w-[96vw] h-[92vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0 bg-slate-50/50">
          <DialogTitle className="text-lg font-bold text-slate-800 truncate max-w-[60%]">
            {fileName || "File Viewer"}
          </DialogTitle>
          <div className="flex items-center gap-2 mr-10">
            <Button variant="outline" size="sm" asChild className="h-8 px-3 text-slate-700 bg-white hover:bg-slate-100 border-slate-200 shadow-xs font-semibold">
              <a href={fullUrl} download target="_blank" rel="noopener noreferrer">
                <DownloadIcon className="h-4 w-4 mr-1.5 text-[#2A174E]" /> Download
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-slate-100 overflow-hidden relative">
          {isPDF ? (
            <iframe
              src={fullUrl}
              className="w-full h-full border-0"
              title="PDF Viewer"
            />
          ) : (
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <Button variant="secondary" size="icon" onClick={() => zoomIn()} className="h-8 w-8 shadow-md">
                      <ZoomInIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="icon" onClick={() => zoomOut()} className="h-8 w-8 shadow-md">
                      <ZoomOutIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="icon" onClick={() => resetTransform()} className="h-8 w-8 shadow-md">
                      <RotateLeftIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full flex items-center justify-center"
                  >
                    <img
                      src={fullUrl}
                      alt="Attachment"
                      className="max-w-full max-h-full object-contain cursor-grab"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/400?text=File+Not+Found";
                      }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileViewerModal;
