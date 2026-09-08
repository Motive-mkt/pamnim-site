import React, { useState } from 'react';
import { deleteProjectCascade, ProjectDeletionResult } from '../services/cascadeDeletionService';
import { AlertTriangle, Trash2, X, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DeleteProjectModalProps {
  isOpen: boolean;
  project: {
    id: string;
    name: string;
    clientName?: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteProjectModal({
  isOpen,
  project,
  onClose,
  onSuccess
}: DeleteProjectModalProps) {
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null);
  const [successReport, setSuccessReport] = useState<ProjectDeletionResult | null>(null);

  if (!isOpen || !project) return null;

  const isConfirmed = typedName.trim().toLowerCase() === project.name.trim().toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setErrorDetails(null);
    setProgressMsg('Initiating cascade deletion...');

    try {
      const result = await deleteProjectCascade(project.id, (msg) => {
        setProgressMsg(msg);
      });

      console.log('[CASCADE DELETION REPORT] Project deletion summary:', {
        projectId: project.id,
        projectName: project.name,
        result
      });

      if (result.success || result.projectDocDeleted) {
        setSuccessReport(result);
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setErrorDetails(
          result.errors.length > 0
            ? result.errors
            : ['Failed to completely delete the project document. Please try again.']
        );
      }
    } catch (err: any) {
      console.error('Unhandled error deleting project:', err);
      setErrorDetails([err?.message || 'An unexpected network error occurred during deletion.']);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    if (isDeleting) return;
    setTypedName('');
    setErrorDetails(null);
    setSuccessReport(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl border border-red-200 shadow-2xl overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-6 bg-red-50/70 border-b border-red-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/20 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-charcoal">Delete Project</h3>
              <p className="text-xs text-red-700 font-medium">Permanent and Irreversible Action</p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            disabled={isDeleting}
            className="p-1.5 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-white/80 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {successReport ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-emerald-900 text-base">Project Deleted Successfully</h4>
              <p className="text-xs text-emerald-700">
                Removed project record along with all subcollections ({successReport.updatesDeleted} updates, {successReport.paymentsDeleted} payments, {successReport.expensesDeleted} expenses).
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-charcoal/80 leading-relaxed">
                  You are about to permanently delete <strong className="text-charcoal font-black">"{project.name}"</strong>
                  {project.clientName && <span> (Client: {project.clientName})</span>}.
                </p>
                <div className="p-3.5 bg-cream/40 rounded-2xl border border-charcoal/10 text-xs text-charcoal/70 space-y-1.5">
                  <p className="font-bold text-charcoal">This will cascade delete:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px] text-charcoal/70">
                    <li>The main project document</li>
                    <li>All site progress updates & milestones</li>
                    <li>All logged client payments and transaction receipts</li>
                    <li>All internal project expenses</li>
                  </ul>
                  <p className="text-[10px] text-charcoal/50 pt-1 italic">
                    Note: Orphaned Cloudinary media will require periodic cleanup.
                  </p>
                </div>
              </div>

              {errorDetails && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-1.5 text-xs text-red-800">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Deletion encountered issues:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-700">
                    {errorDetails.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-red-600/80 pt-1">
                    Some items may have been deleted while others encountered errors. Details logged to console.
                  </p>
                </div>
              )}

              {/* Confirmation Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                  Type <span className="text-red-600 select-all font-mono font-bold">"{project.name}"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={project.name}
                  disabled={isDeleting}
                  className="w-full px-4 py-3 bg-cream/30 border border-charcoal/20 rounded-2xl text-sm font-semibold focus:outline-none focus:border-red-500 focus:bg-white"
                  autoFocus
                />
              </div>

              {isDeleting && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                  <span>{progressMsg || 'Deleting project data...'}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Actions */}
        {!successReport && (
          <div className="p-6 bg-cream/20 border-t border-charcoal/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isDeleting}
              className="px-5 py-2.5 rounded-2xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors disabled:opacity-50 cursor-pointer order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
              className="px-6 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer order-1 sm:order-2 min-h-[42px]"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Permanently Delete Project</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
