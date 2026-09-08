import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  CreditCard, Plus, Calendar, DollarSign, 
  CheckCircle2, AlertCircle, FileText, User, Hash, X, ArrowUpRight, ShieldCheck,
  Pencil, Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface PaymentItem {
  id: string;
  amount: number;
  date: string; // ISO string
  method: 'mpesa' | 'bank' | 'cash' | 'card' | string;
  reference?: string;
  recordedBy: string;
  note?: string;
}

interface PaymentLogProps {
  projectId: string;
  project: {
    id: string;
    name: string;
    totalCost?: number;
    clientId?: string;
  };
  isStaff: boolean;
  onEditCostClick?: () => void;
}

const METHOD_LABELS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  mpesa: { label: 'M-Pesa', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  bank: { label: 'Bank Transfer', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  cash: { label: 'Cash', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  card: { label: 'Card', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

export default function PaymentLog({ projectId, project, isStaff, onEditCostClick }: PaymentLogProps) {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Payment Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentItem | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<'mpesa' | 'bank' | 'cash' | 'card'>('mpesa');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    const paymentsRef = collection(db, 'projects', projectId, 'payments');
    const q = query(paymentsRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as PaymentItem[];

        // Sort desc in memory as well to ensure consistent display
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPayments(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to payments:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  const totalCost = Number(project.totalCost ?? 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balance = totalCost - totalPaid;

  const handleStartEditPayment = (p: PaymentItem) => {
    setEditingPayment(p);
    setAmount(String(p.amount));
    setDate(p.date ? new Date(p.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setMethod((p.method as any) || 'mpesa');
    setReference(p.reference || '');
    setNote(p.note || '');
    setFormError('');
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingPayment(null);
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
    setMethod('mpesa');
    setReference('');
    setNote('');
    setFormError('');
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (!date) {
      setFormError('Please select a valid payment date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentDate = new Date(date).toISOString();

      if (editingPayment) {
        await updateDoc(doc(db, 'projects', projectId, 'payments', editingPayment.id), {
          amount: numericAmount,
          date: paymentDate,
          method,
          reference: reference.trim() || '',
          note: note.trim() || '',
          updatedAt: new Date().toISOString(),
          updatedBy: profile?.name || 'Staff'
        });
      } else {
        await addDoc(collection(db, 'projects', projectId, 'payments'), {
          amount: numericAmount,
          date: paymentDate,
          method,
          reference: reference.trim() || '',
          recordedBy: profile?.name || 'Staff',
          note: note.trim() || '',
          createdAt: new Date().toISOString()
        });
      }

      handleCancelForm();
    } catch (err: any) {
      console.error('Error saving payment:', err);
      setFormError(err.message || 'Failed to record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete) return;
    setIsDeletingPayment(true);
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'payments', paymentToDelete.id));
      setPaymentToDelete(null);
    } catch (err: any) {
      console.error('Error deleting payment:', err);
      alert('Failed to delete payment: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsDeletingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Financial Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Project Cost */}
        <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal/50">Total Project Cost</span>
            <div className="w-8 h-8 rounded-xl bg-charcoal/5 text-charcoal flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-charcoal">
              ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {isStaff && onEditCostClick && (
              <button 
                onClick={onEditCostClick}
                className="block text-[11px] font-bold text-ochre hover:underline mt-1 cursor-pointer"
              >
                Edit Contract Total
              </button>
            )}
          </div>
        </div>

        {/* Total Amount Paid */}
        <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal/50">Total Received</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[11px] text-charcoal/50 mt-1 font-medium">
              {payments.length} {payments.length === 1 ? 'payment' : 'payments'} recorded
            </p>
          </div>
        </div>

        {/* Balance Due */}
        <div className="bg-white rounded-3xl p-6 border border-charcoal/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-charcoal/50">
              {balance < 0 ? 'Overpayment' : 'Remaining Balance'}
            </span>
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              balance <= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className={cn(
              "text-2xl sm:text-3xl font-black",
              balance < 0 ? "text-emerald-600" : balance === 0 ? "text-charcoal/70" : "text-red-600"
            )}>
              ${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <p className="text-[11px] mt-1 font-semibold">
              {balance <= 0 ? (
                <span className="text-emerald-600 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Fully Paid
                </span>
              ) : (
                <span className="text-red-600">Due across project milestones</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Ledger Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-charcoal/5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-ochre/10 text-ochre flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-xl font-bold text-charcoal">Payment History & Ledger</h3>
            </div>
            <p className="text-xs text-charcoal/60">
              Official transaction records, milestone payments, and deposit slips for this project.
            </p>
          </div>

          {/* Add Payment Button (Staff Only) */}
          {isStaff && (
            <button
              onClick={() => {
                if (showAddForm) {
                  handleCancelForm();
                } else {
                  setShowAddForm(true);
                }
              }}
              className="px-5 py-2.5 rounded-2xl bg-ochre text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              {showAddForm ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Record Payment</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Add / Edit Payment Form (Staff Only) */}
        {isStaff && showAddForm && (
          <form onSubmit={handleSavePayment} className="bg-cream/40 p-5 sm:p-6 rounded-2xl border border-charcoal/10 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-charcoal/5">
              <h4 className="text-sm font-bold text-charcoal flex items-center gap-2">
                {editingPayment ? (
                  <>
                    <Pencil className="w-4 h-4 text-ochre" /> Edit Recorded Payment
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-ochre" /> Record New Client Payment
                  </>
                )}
              </h4>
              <span className="text-[10px] uppercase font-bold text-charcoal/40 tracking-wider">
                {editingPayment ? 'Modify Record' : 'Staff Entry'}
              </span>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Amount ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/40 font-bold text-sm select-none">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-charcoal/15 rounded-xl text-sm font-bold text-charcoal focus:outline-none focus:border-ochre"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-sm font-medium text-charcoal focus:outline-none focus:border-ochre"
                />
              </div>

              {/* Method */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Payment Method *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-sm font-medium text-charcoal focus:outline-none focus:border-ochre"
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Reference Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. QJD78819X"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-sm font-medium text-charcoal focus:outline-none focus:border-ochre"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                Note / Milestone Description (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 50% initial commitment deposit / milestone 2 completion"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-sm font-medium text-charcoal focus:outline-none focus:border-ochre"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 rounded-xl border border-charcoal/15 text-charcoal font-semibold text-xs hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-ochre text-white font-bold text-xs shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : editingPayment ? 'Update Payment' : 'Save Payment'}
              </button>
            </div>
          </form>
        )}

        {/* Payments List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-charcoal/40 animate-pulse bg-cream/30 rounded-2xl border border-charcoal/5">
              Loading payment history...
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center bg-cream/20 rounded-3xl border border-dashed border-charcoal/15 text-charcoal/50 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-charcoal/5 text-charcoal/30 flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-charcoal/70">No payments recorded for this project yet</p>
              <p className="text-xs text-charcoal/40 max-w-sm mx-auto">
                {isStaff 
                  ? 'Record deposit receipts or milestone payments using the button above.' 
                  : 'Payment receipts will appear here as soon as our finance team logs them.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-charcoal/5 border border-charcoal/10 rounded-2xl overflow-hidden">
              {payments.map((p) => {
                const badge = METHOD_LABELS[p.method] || { label: p.method || 'Other', bg: 'bg-cream', text: 'text-charcoal', border: 'border-charcoal/10' };
                const formattedDate = new Date(p.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div key={p.id} className="p-4 sm:p-5 bg-white hover:bg-cream/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base font-black text-charcoal">
                          ${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider", badge.bg, badge.text, badge.border)}>
                          {badge.label}
                        </span>
                        {p.reference && (
                          <span className="text-xs text-charcoal/50 bg-cream/70 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                            <Hash className="w-3 h-3 text-charcoal/40" /> {p.reference}
                          </span>
                        )}
                      </div>

                      {p.note && (
                        <p className="text-xs text-charcoal/70 font-medium">
                          {p.note}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-charcoal/40 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formattedDate}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> Recorded by {p.recordedBy || 'Staff'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      {isStaff && (
                        <div className="flex items-center gap-1 border-l border-charcoal/10 pl-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditPayment(p)}
                            className="p-1.5 rounded-lg text-charcoal/40 hover:text-ochre hover:bg-cream transition-colors cursor-pointer"
                            title="Edit payment"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentToDelete(p)}
                            className="p-1.5 rounded-lg text-charcoal/40 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Payment Confirmation Modal */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-charcoal/10 space-y-4 animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-charcoal">Delete Payment Record?</h3>
              <p className="text-xs text-charcoal/60 mt-1">
                Are you sure you want to delete this payment of <span className="font-bold text-charcoal">${Number(paymentToDelete.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span> recorded on {new Date(paymentToDelete.date).toLocaleDateString('en-US')}? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingPayment}
                onClick={() => setPaymentToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-charcoal/15 text-charcoal font-semibold text-xs hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingPayment}
                onClick={handleConfirmDeletePayment}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs shadow-md shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isDeletingPayment ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
