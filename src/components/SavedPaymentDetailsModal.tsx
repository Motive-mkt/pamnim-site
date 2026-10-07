import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, CreditCard, Building2, Smartphone, Banknote, FileSignature, Check, AlertCircle, Bookmark } from 'lucide-react';
import { 
  SavedPaymentDetail, PaymentMethodType, savePaymentDetailEntry, deletePaymentDetailEntry 
} from '../services/paymentDetailsService';
import { cn } from '../lib/utils';

interface SavedPaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedEntries: SavedPaymentDetail[];
  currentInvoiceNotes: string;
  onApplyDetails: (detailsText: string) => void;
  initialMode?: 'preserve' | 'manage';
}

export default function SavedPaymentDetailsModal({
  isOpen,
  onClose,
  savedEntries,
  currentInvoiceNotes,
  onApplyDetails,
  initialMode = 'preserve'
}: SavedPaymentDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | PaymentMethodType>('all');
  const [showAddNew, setShowAddNew] = useState(initialMode === 'preserve');
  
  // New entry form state
  const [newMethod, setNewMethod] = useState<PaymentMethodType>('bank');
  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState(currentInvoiceNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const getMethodIcon = (method: PaymentMethodType) => {
    switch (method) {
      case 'bank': return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'mpesa': return <Smartphone className="w-4 h-4 text-emerald-600" />;
      case 'cash': return <Banknote className="w-4 h-4 text-amber-600" />;
      case 'cheque': return <FileSignature className="w-4 h-4 text-purple-600" />;
    }
  };

  const getMethodBadgeClass = (method: PaymentMethodType) => {
    switch (method) {
      case 'bank': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'mpesa': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cash': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cheque': return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const filteredEntries = activeTab === 'all' 
    ? savedEntries 
    : savedEntries.filter(e => e.method === activeTab);

  const handleSavePreservedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setErrorMessage('Please give this entry a name (e.g. "KCB Business Account").');
      return;
    }
    if (!newDetails.trim()) {
      setErrorMessage('Please provide the payment instructions text.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await savePaymentDetailEntry({
        method: newMethod,
        title: newTitle.trim(),
        details: newDetails.trim()
      });

      setSuccessToast(`Saved "${newTitle.trim()}" to reusable payment methods!`);
      setTimeout(() => setSuccessToast(null), 3000);
      setShowAddNew(false);
      setNewTitle('');
    } catch (err: any) {
      console.error('Error saving payment detail:', err);
      setErrorMessage(err?.message || 'Could not save payment details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove "${title}" from your saved payment details?`)) {
      return;
    }
    try {
      await deletePaymentDetailEntry(id);
      setSuccessToast(`Removed "${title}".`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      console.error('Error deleting payment entry:', err);
      alert('Failed to delete entry: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-charcoal/50 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-charcoal/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-charcoal">Reusable Payment Details</h3>
              <p className="text-xs text-charcoal/65">
                Preserve payment methods (Bank, M-Pesa, Cash, Cheque) to auto-fill future invoices in one click.
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-charcoal/60 hover:text-charcoal hover:bg-cream transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Toasts */}
        {successToast && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section: Preserve Current / Add New Entry */}
        {showAddNew ? (
          <form onSubmit={handleSavePreservedEntry} className="p-5 bg-cream/40 rounded-3xl border border-charcoal/10 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-charcoal flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-ochre" />
                <span>Preserve as New Reusable Entry</span>
              </span>
              <button 
                type="button" 
                onClick={() => setShowAddNew(false)}
                className="text-xs text-charcoal/65 hover:text-charcoal font-semibold cursor-pointer"
              >
                Back to saved entries
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-white rounded-xl border border-charcoal/10 text-xs font-bold">
                  {(['bank', 'mpesa', 'cash', 'cheque'] as PaymentMethodType[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNewMethod(m)}
                      className={cn(
                        "py-1.5 rounded-lg capitalize transition-all text-center flex items-center justify-center gap-1 cursor-pointer",
                        newMethod === m 
                          ? "bg-ochre text-white shadow-xs" 
                          : "text-charcoal/60 hover:text-charcoal hover:bg-cream/40"
                      )}
                    >
                      <span>{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                  Entry Title / Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder='e.g. "Equity Bank Main", "M-Pesa Till 50402"'
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                Payment Details / Instructions Text *
              </label>
              <textarea
                rows={4}
                required
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                placeholder="Enter bank account, branch, till number, or terms here..."
                className="w-full p-3 bg-white border border-charcoal/15 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:border-ochre"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddNew(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-cream cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Preserving...' : 'Save Reusable Entry'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            {/* Method Filter Tabs */}
            <div className="flex items-center gap-1 bg-cream/70 p-1 rounded-2xl border border-charcoal/10 flex-wrap">
              {(['all', 'bank', 'mpesa', 'cash', 'cheque'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveTab(m)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer",
                    activeTab === m 
                      ? "bg-white text-charcoal shadow-xs" 
                      : "text-charcoal/60 hover:text-charcoal"
                  )}
                >
                  {m === 'all' ? 'All' : m}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setNewDetails(currentInvoiceNotes || '');
                setShowAddNew(true);
              }}
              className="px-4 py-2 bg-ochre hover:bg-ochre-dark text-white text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Preserve Current Details</span>
            </button>
          </div>
        )}

        {/* Saved Entries List */}
        <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-charcoal/10 rounded-3xl space-y-2">
              <CreditCard className="w-8 h-8 text-charcoal/60 mx-auto" />
              <p className="text-xs font-bold text-charcoal/70">No saved payment entries found.</p>
              <p className="text-[11px] text-charcoal/65">
                Click <strong>"Preserve Current Details"</strong> above to save your first reusable payment instruction.
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div 
                key={entry.id}
                className="p-4 bg-white rounded-2xl border border-charcoal/10 hover:border-charcoal/20 transition-all shadow-2xs space-y-2 group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1",
                      getMethodBadgeClass(entry.method)
                    )}>
                      {getMethodIcon(entry.method)}
                      <span>{entry.method}</span>
                    </span>
                    <h4 className="text-xs font-bold text-charcoal">{entry.title}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyDetails(entry.details);
                        onClose();
                      }}
                      className="px-3 py-1 bg-ochre hover:bg-ochre-dark text-white text-[11px] font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                      title="Auto-fill these details into the invoice"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Use on Invoice</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id, entry.title)}
                      className="p-1.5 text-charcoal/60 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove this saved entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-cream/30 rounded-xl border border-charcoal/5 text-xs font-mono text-charcoal/80 whitespace-pre-wrap leading-relaxed select-text">
                  {entry.details}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-charcoal/10 flex items-center justify-between text-xs text-charcoal/65">
          <span>Click <strong>"Use on Invoice"</strong> on any entry to auto-fill it immediately.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-charcoal/20 font-bold hover:bg-cream transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
