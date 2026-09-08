import React, { useState, useEffect } from 'react';
import { 
  checkClientActiveProjects, 
  deleteClientCascade, 
  ClientDeletionResult 
} from '../services/cascadeDeletionService';
import { AlertTriangle, Trash2, X, Loader2, CheckCircle2, ShieldAlert, Ban, ExternalLink } from 'lucide-react';

interface DeleteClientModalProps {
  isOpen: boolean;
  client: {
    id: string;
    name?: string;
    email?: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteClientModal({
  isOpen,
  client,
  onClose,
  onSuccess
}: DeleteClientModalProps) {
  const [checkingActive, setCheckingActive] = useState(true);
  const [activeProjects, setActiveProjects] = useState<Array<{ id: string; name: string; stage: string }>>([]);
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorDetails, setErrorDetails] = useState<string[] | null>(null);
  const [successReport, setSuccessReport] = useState<ClientDeletionResult | null>(null);

  const clientDisplayName = client?.name || client?.email || 'Client';

  useEffect(() => {
    if (!isOpen || !client?.id) {
      setCheckingActive(false);
      return;
    }

    async function checkProjects() {
      setCheckingActive(true);
      setErrorDetails(null);
      setSuccessReport(null);
      setTypedName('');

      try {
        const result = await checkClientActiveProjects(client!.id);
        setActiveProjects(result.activeProjects);
      } catch (err) {
        console.error('Error verifying active projects for client:', err);
      } finally {
        setCheckingActive(false);
      }
    }

    checkProjects();
  }, [isOpen, client?.id]);

  if (!isOpen || !client) return null;

  const hasActiveProjects = activeProjects.length > 0;
  const isConfirmed = typedName.trim().toLowerCase() === clientDisplayName.trim().toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting || hasActiveProjects) return;

    setIsDeleting(true);
    setErrorDetails(null);
    setProgressMsg('Initiating client account removal...');

    try {
      const result = await deleteClientCascade(client.id, (msg) => {
        setProgressMsg(msg);
      });

      console.log('[CASCADE DELETION REPORT] Client deletion summary:', {
        clientId: client.id,
        clientName: clientDisplayName,
        result
      });

      if (result.success || result.profileDeleted) {
        setSuccessReport(result);
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setErrorDetails(
          result.errors.length > 0
            ? result.errors
            : ['Failed to remove client account documents. Please review logs and try again.']
        );
      }
    } catch (err: any) {
      console.error('Unhandled error deleting client:', err);
      setErrorDetails([err?.message || 'A network error occurred while deleting client account.']);
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
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-charcoal">Delete Client Account</h3>
              <p className="text-xs text-red-700 font-medium">Owner Authorization Required</p>
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
          {checkingActive ? (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-ochre mx-auto" />
              <p className="text-xs font-semibold text-charcoal/60">Checking active client projects...</p>
            </div>
          ) : hasActiveProjects ? (
            /* Blocked state when client has non-complete projects */
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <Ban className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-900">Deletion Blocked: Active Projects Linked</h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    This client is currently assigned to <strong>{activeProjects.length}</strong> active project(s) that are not yet marked as <strong>"Complete"</strong>.
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed pt-1">
                    Deleting a client out from under an active project would leave it stranded without a linked account. Please complete or reassign the projects below before deleting this client:
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">
                  Unfinished Projects for {clientDisplayName}:
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {activeProjects.map((p) => (
                    <div 
                      key={p.id}
                      className="p-3 bg-cream/40 rounded-xl border border-charcoal/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-bold text-charcoal">{p.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-ochre/15 text-ochre px-2.5 py-0.5 rounded-full">
                        Stage: {p.stage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-3 rounded-2xl bg-charcoal text-white text-xs font-bold hover:bg-charcoal/90 transition-colors cursor-pointer"
                >
                  Understood — Return to Client List
                </button>
              </div>
            </div>
          ) : successReport ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-emerald-900 text-base">Client Deleted Successfully</h4>
              <p className="text-xs text-emerald-700">
                Removed client profile, authentication account, and chat history. Completed project records are retained for historical bookkeeping.
              </p>
            </div>
          ) : (
            /* Allowed deletion state */
            <>
              <div className="space-y-2">
                <p className="text-sm text-charcoal/80 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-charcoal font-black">"{clientDisplayName}"</strong>
                  {client.email && <span className="text-xs text-charcoal/60"> ({client.email})</span>}?
                </p>
                <div className="p-3.5 bg-cream/40 rounded-2xl border border-charcoal/10 text-xs text-charcoal/70 space-y-1.5">
                  <p className="font-bold text-charcoal">This will cascade delete:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px] text-charcoal/70">
                    <li>The client's Firestore user profile</li>
                    <li>The client's Firebase Auth login account</li>
                    <li>The client's message history and chat thread</li>
                    <li>Any pending registration entry in pending_signups</li>
                  </ul>
                  <p className="text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded-xl border border-emerald-200 font-medium">
                    ✓ Completed project records will be safely retained as historical business records.
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
                    Details have been logged to the console for review.
                  </p>
                </div>
              )}

              {/* Confirmation Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                  Type <span className="text-red-600 select-all font-mono font-bold">"{clientDisplayName}"</span> to confirm:
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={clientDisplayName}
                  disabled={isDeleting}
                  className="w-full px-4 py-3 bg-cream/30 border border-charcoal/20 rounded-2xl text-sm font-semibold focus:outline-none focus:border-red-500 focus:bg-white"
                  autoFocus
                />
              </div>

              {isDeleting && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                  <span>{progressMsg || 'Removing client account...'}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Actions */}
        {!hasActiveProjects && !successReport && !checkingActive && (
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
                  <span>Permanently Delete Client</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
