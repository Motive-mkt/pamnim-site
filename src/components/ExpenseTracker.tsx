import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Receipt, 
  Calendar, 
  X, 
  AlertCircle, 
  TrendingUp, 
  FileText,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';

export interface ExpenseItem {
  id: string;
  amount: number;
  category?: 'Materials' | 'Labor & Wages' | 'Transport & Logistics' | 'Subcontractor' | 'Miscellaneous' | string;
  note?: string;
  date: any; // Firestore Timestamp | string | Date
  createdAt?: any;
  createdBy?: string;
}

export const EXPENSE_CATEGORIES = [
  'Materials',
  'Labor & Wages',
  'Transport & Logistics',
  'Subcontractor',
  'Miscellaneous'
] as const;

interface ExpenseTrackerProps {
  projectId: string;
  isReadOnly?: boolean;
}

// Format Date object to "YYYY-MM-DDTHH:mm" for datetime-local input
function formatToDatetimeLocal(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Format Firestore Timestamp, Date, or string to human-readable string
function formatDisplayDate(val: any): string {
  if (!val) return 'N/A';
  try {
    let d: Date;
    if (val instanceof Timestamp) {
      d = val.toDate();
    } else if (typeof val?.toDate === 'function') {
      d = val.toDate();
    } else if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'string' || typeof val === 'number') {
      d = new Date(val);
    } else {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return 'N/A';
  }
}

export default function ExpenseTracker({ projectId, isReadOnly = false }: ExpenseTrackerProps) {
  const { profile, isStaff } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Add Expense Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<string>('Materials');
  const [noteInput, setNoteInput] = useState('');
  const [dateInput, setDateInput] = useState(formatToDatetimeLocal());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    const expensesRef = collection(db, 'projects', projectId, 'expenses');
    const q = query(expensesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as ExpenseItem[];
        setExpenses(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to project expenses:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  // If read-only (client view), hide entirely as specified
  if (isReadOnly) {
    return null;
  }

  const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Filtered expenses
  const filteredExpenses = expenses.filter((item) => {
    if (categoryFilter === 'all') return true;
    return (item.category || 'Miscellaneous') === categoryFilter;
  });

  // Calculate totals per category
  const categoryTotals: Record<string, { total: number; count: number }> = {};
  EXPENSE_CATEGORIES.forEach((cat) => {
    categoryTotals[cat] = { total: 0, count: 0 };
  });

  expenses.forEach((item) => {
    const cat = item.category || 'Miscellaneous';
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { total: 0, count: 0 };
    }
    categoryTotals[cat].total += Number(item.amount) || 0;
    categoryTotals[cat].count += 1;
  });

  const handleOpenAddModal = () => {
    setAmountInput('');
    setCategoryInput('Materials');
    setNoteInput('');
    setDateInput(formatToDatetimeLocal(new Date()));
    setFormError('');
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setFormError('');
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const numericAmount = parseFloat(amountInput);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!dateInput) {
      setFormError('Please select a valid date and time.');
      return;
    }

    const parsedDate = new Date(dateInput);
    if (isNaN(parsedDate.getTime())) {
      setFormError('Invalid date/time value entered.');
      return;
    }

    setIsSubmitting(true);
    try {
      const expensesRef = collection(db, 'projects', projectId, 'expenses');
      await addDoc(expensesRef, {
        amount: numericAmount,
        category: categoryInput || 'Materials',
        note: noteInput.trim() || '',
        date: Timestamp.fromDate(parsedDate),
        createdAt: serverTimestamp(),
        createdBy: profile?.name || 'Staff'
      });

      handleCloseAddModal();
    } catch (err: any) {
      console.error('Error adding project expense:', err);
      setFormError(err.message || 'Failed to record expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!isStaff) return;
    if (!window.confirm('Are you sure you want to delete this expense record?')) return;

    setDeletingId(expenseId);
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'expenses', expenseId));
    } catch (err) {
      console.error('Error deleting expense record:', err);
      alert('Failed to delete expense record. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-6">
      {/* Header & Running Total Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-charcoal/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-ochre/10 text-ochre flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="text-xl font-bold text-charcoal">Internal Project Expenses</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-charcoal/5 text-charcoal/60 px-2 py-0.5 rounded-md">
              Staff Only
            </span>
          </div>
          <p className="text-xs text-charcoal/60">
            Log procurement, subcontractor fees, materials, and internal expenditures for this project.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
          {/* Running Total Badge */}
          <div className="bg-cream/70 border border-charcoal/10 rounded-2xl px-5 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ochre text-white flex items-center justify-center shadow-sm">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/50">
                Total Expenses
              </span>
              <span className="text-lg font-black text-charcoal font-mono">
                KES {totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Add Expense Button */}
          {isStaff && (
            <button
              onClick={handleOpenAddModal}
              className="px-5 py-3 rounded-2xl bg-ochre text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-ochre/20 hover:bg-ochre-dark transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Summary Row Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {EXPENSE_CATEGORIES.map((cat) => {
          const stats = categoryTotals[cat] || { total: 0, count: 0 };
          const isSelected = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(isSelected ? 'all' : cat)}
              className={cn(
                "p-3 rounded-2xl border text-left transition-all cursor-pointer",
                isSelected
                  ? "bg-ochre/10 border-ochre shadow-sm ring-1 ring-ochre"
                  : "bg-cream/30 border-charcoal/10 hover:border-ochre/40"
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50 truncate">
                {cat}
              </p>
              <p className="text-sm font-bold font-mono text-charcoal mt-0.5">
                KES {stats.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-charcoal/40 font-medium">
                {stats.count} {stats.count === 1 ? 'entry' : 'entries'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Count Bar */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-charcoal/60">Filter Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-cream/40 border border-charcoal/10 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
          >
            <option value="all">All Categories ({expenses.length})</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({categoryTotals[cat]?.count || 0})
              </option>
            ))}
          </select>
          {categoryFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className="text-[11px] font-bold text-ochre hover:underline cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
        <p className="text-xs text-charcoal/50">
          Showing {filteredExpenses.length} of {expenses.length} records
        </p>
      </div>

      {/* Expense Entries List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-charcoal/40 animate-pulse bg-cream/30 rounded-2xl border border-charcoal/5">
            Loading expense logs...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-8 text-center bg-cream/30 rounded-2xl border border-dashed border-charcoal/10 text-charcoal/50 space-y-1">
            <Receipt className="w-8 h-8 mx-auto text-charcoal/30 mb-2" />
            <p className="text-sm font-bold text-charcoal/70">No expenses in this view</p>
            <p className="text-xs text-charcoal/40">
              Click "Add Expense" to start logging itemized project expenditures.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border border-charcoal/10 rounded-2xl bg-white">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-cream/60 border-b border-charcoal/10 text-xs font-bold uppercase tracking-wider text-charcoal/50">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description / Note</th>
                    <th className="py-3 px-4 text-right">Amount (KES)</th>
                    <th className="py-3 px-4 text-right w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5 text-sm">
                  {filteredExpenses.map((item) => (
                    <tr key={item.id} className="hover:bg-cream/30 transition-colors group">
                      <td className="py-3.5 px-4 text-charcoal/70 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-charcoal/40" />
                          <span>{formatDisplayDate(item.date)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-charcoal/5 text-charcoal/80 border border-charcoal/10">
                          {item.category || 'Miscellaneous'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-charcoal">
                        {item.note ? (
                          <span className="font-medium text-charcoal/90">{item.note}</span>
                        ) : (
                          <span className="text-charcoal/30 italic text-xs">No note provided</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-charcoal font-mono whitespace-nowrap">
                        KES {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isStaff && (
                          <button
                            onClick={() => handleDeleteExpense(item.id)}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-lg text-charcoal/30 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Expense"
                            aria-label="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="block md:hidden divide-y divide-charcoal/5">
              {filteredExpenses.map((item) => (
                <div key={item.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-charcoal/5 text-charcoal/70 border border-charcoal/10">
                        {item.category || 'Miscellaneous'}
                      </span>
                      <span className="text-xs text-charcoal/50">{formatDisplayDate(item.date)}</span>
                    </div>
                    <p className="text-sm font-semibold text-charcoal">
                      {item.note || <span className="text-charcoal/30 italic text-xs">No note</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-sm font-black text-charcoal font-mono">
                      KES {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {isStaff && (
                      <button
                        onClick={() => handleDeleteExpense(item.id)}
                        disabled={deletingId === item.id}
                        className="text-xs text-charcoal/40 hover:text-red-600 transition-colors p-1"
                        aria-label="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-charcoal/10">
            <button
              onClick={handleCloseAddModal}
              className="absolute top-5 right-5 text-charcoal/40 hover:text-charcoal transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-charcoal">Add Expense</h3>
                <p className="text-xs text-charcoal/50">Record an itemized project expenditure</p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddExpense} className="space-y-4 mt-6">
              {/* Amount Field */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Amount (KES) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/40 font-bold text-xs select-none">
                    KES
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value);
                      setFormError('');
                    }}
                    className="w-full pl-12 pr-4 py-2.5 bg-cream/40 border border-charcoal/15 focus:border-ochre rounded-xl text-sm font-bold text-charcoal outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Category Dropdown */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 focus:border-ochre rounded-xl text-sm font-medium text-charcoal outline-none transition-all cursor-pointer"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time Field */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    required
                    value={dateInput}
                    onChange={(e) => {
                      setDateInput(e.target.value);
                      setFormError('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 focus:border-ochre rounded-xl text-sm font-medium text-charcoal outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-charcoal/40 mt-1">
                  Defaults to current date/time, but you can backdate or adjust as needed.
                </p>
              </div>

              {/* Note / Description Field */}
              <div>
                <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-1.5">
                  Note / Purpose <span className="text-charcoal/40 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paint 20L, Timber, Site lunch, Transport..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 focus:border-ochre rounded-xl text-sm font-medium text-charcoal outline-none transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-5 py-2.5 rounded-xl border border-charcoal/10 text-xs font-bold text-charcoal/60 hover:bg-cream/40 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold flex items-center gap-2 hover:bg-ochre-dark transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-ochre/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Recording...' : 'Add Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
