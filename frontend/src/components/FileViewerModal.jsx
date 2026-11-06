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
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const FileViewerModal = ({ isOpen, onClose, fileUrl, fileName }) => {
  const fileList = React.useMemo(() => {
    if (!fileUrl) return [];
    if (Array.isArray(fileUrl)) return fileUrl.filter(Boolean);
    if (typeof fileUrl === "string") {
      return fileUrl
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [fileUrl]);

  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    setCurrentIndex(0);
  }, [fileUrl, isOpen]);

  const handlePrev = React.useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = React.useCallback(() => {
    setCurrentIndex((prev) => Math.min(fileList.length - 1, prev + 1));
  }, [fileList.length]);

  React.useEffect(() => {
    if (!isOpen || fileList.length <= 1) return;
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, fileList.length, handlePrev, handleNext]);

  if (!fileUrl || fileList.length === 0) return null;

  const currentFile = fileList[currentIndex] || "";
  const isPDF = currentFile.toLowerCase().endsWith(".pdf");
  const fullUrl = currentFile.startsWith("http")
    ? currentFile
    : `/api/uploads/${currentFile}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl md:max-w-5xl w-[96vw] max-w-[96vw] h-[92vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl rounded-2xl">
        <DialogHeader className="px-6 py-3 border-b border-slate-100 flex flex-row items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3 truncate max-w-[65%]">
            <DialogTitle className="text-base md:text-lg font-bold text-slate-800 truncate">
              {fileName || "File Viewer"}
            </DialogTitle>
            {fileList.length > 1 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full shrink-0">
                {currentIndex + 1} of {fileList.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mr-10">
            {fileList.length > 1 && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="h-7 px-2 text-xs font-semibold text-slate-700 disabled:opacity-30"
                  title="Previous document (Left Arrow)"
                >
                  <NavigateBeforeIcon className="h-4 w-4" />
                </Button>
                <span className="text-[11px] font-bold text-slate-600 px-2 select-none">
                  {currentIndex + 1} / {fileList.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNext}
                  disabled={currentIndex === fileList.length - 1}
                  className="h-7 px-2 text-xs font-semibold text-slate-700 disabled:opacity-30"
                  title="Next document (Right Arrow)"
                >
                  <NavigateNextIcon className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 px-3 text-slate-700 bg-white hover:bg-slate-100 border-slate-200 shadow-xs font-semibold"
            >
              <a
                href={fullUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                <DownloadIcon className="h-4 w-4 mr-1.5 text-brand-primary" /> Download
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-slate-100 overflow-hidden relative">
          {fileList.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-700 disabled:opacity-20 disabled:pointer-events-none shadow-lg flex items-center justify-center transition-all border border-slate-200 cursor-pointer"
                title="Previous document (Left Arrow)"
              >
                <NavigateBeforeIcon className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex === fileList.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-700 disabled:opacity-20 disabled:pointer-events-none shadow-lg flex items-center justify-center transition-all border border-slate-200 cursor-pointer"
                title="Next document (Right Arrow)"
              >
                <NavigateNextIcon className="h-6 w-6" />
              </button>
            </>
          )}

          {isPDF ? (
            <iframe
              key={fullUrl}
              src={fullUrl}
              className="w-full h-full border-0"
              title="PDF Viewer"
            />
          ) : (
            <TransformWrapper
              key={fullUrl}
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => zoomIn()}
                      className="h-8 w-8 shadow-md"
                      title="Zoom In"
                    >
                      <ZoomInIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => zoomOut()}
                      className="h-8 w-8 shadow-md"
                      title="Zoom Out"
                    >
                      <ZoomOutIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => resetTransform()}
                      className="h-8 w-8 shadow-md"
                      title="Reset Zoom"
                    >
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
                        e.target.src =
                          "https://via.placeholder.com/400?text=File+Not+Found";
                      }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          )}
        </div>

        {fileList.length > 1 && (
          <div className="px-6 py-2 border-t border-slate-100 bg-slate-50/90 flex items-center justify-center gap-2 overflow-x-auto shrink-0">
            {fileList.map((file, idx) => {
              const isFilePdf = file.toLowerCase().endsWith(".pdf");
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all border flex items-center gap-1.5 cursor-pointer ${
                    currentIndex === idx
                      ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span className="uppercase text-[9px] font-bold opacity-80">
                    {isFilePdf ? "PDF" : "IMG"}
                  </span>
                  <span>Doc {idx + 1}</span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FileViewerModal;
