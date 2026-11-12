import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

/**
 * Universal confirmation modal for unsaved changes.
 */
export default function UnsavedChangesModal({
  isOpen,
  onConfirm,
  onCancel,
  title = "Unsaved Changes Warning",
  description = "You have unsaved changes on this form. If you leave or exit to another page, all modifications will be discarded. Do you wish to proceed?",
  confirmLabel = "Discard & Leave",
  cancelLabel = "Keep Editing",
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-md bg-white border border-slate-200 shadow-xl rounded-2xl p-6 !z-[150]">
        <AlertDialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <AlertDialogTitle className="text-lg font-bold text-slate-900">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate-600 leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <AlertDialogCancel
            onClick={onCancel}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs h-9 px-4 rounded-lg cursor-pointer"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 px-4 shadow-sm rounded-lg transition-all cursor-pointer"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
