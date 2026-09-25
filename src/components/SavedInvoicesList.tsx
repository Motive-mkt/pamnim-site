import React, { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SavedInvoice, InvoiceStatus, PaymentReceipt } from '../types/documents';
import { 
  FileText, Search, Download, Edit2, Copy, Trash2, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, Plus, ExternalLink, Filter, Calendar,
  CreditCard, Receipt, DollarSign, X, Check, Share2, Printer, Lock
} from 'lucide-react';
import { generateDocumentPDF, shareDocumentPDF, generatePaymentReceiptPDF, formatMoney } from '../utils/pdfGenerator';
import { useCMS } from '../hooks/useCMS';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

interface SavedInvoicesListProps {
  onLoadInvoice: (invoice: SavedInvoice) => void;
  onDuplicateInvoice: (invoice: SavedInvoice) => void;
  onCreateNew: () => void;
}

// Clean Firestore payload helper to prevent undefined field errors
function cleanPayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export default function SavedInvoicesList({
  onLoadInvoice,
  onDuplicateInvoice,
  onCreateNew
}: SavedInvoicesListProps) {
  const { content } = useCMS();
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Payment Recording Modal State
  const [paymentInvoice, setPaymentInvoice] = useState<SavedInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<string>('M-Pesa');
  const [payReference, setPayReference] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState<string>('');
  const [payError, setPayError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // Receipts Viewer Modal State
  const [receiptsInvoice, setReceiptsInvoice] = useState<SavedInvoice | null>(null);
  const [invoiceReceipts, setInvoiceReceipts] = useState<PaymentReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as SavedInvoice[];
      setInvoices(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching invoices:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute calculated status: purely from sum of payments vs balance
  const computeCalculatedStatus = (inv: SavedInvoice): InvoiceStatus => {
    const total = Number(inv.totalInvoiced) || 0;
    const paid = Number(inv.amountPaid) || 0;
    if (paid >= total && total > 0) return 'paid';
    if (paid > 0 && paid < total) return 'partial';
    return 'sent'; // Unpaid
  };

  const buildPDFData = (inv: SavedInvoice) => {
    const pdfItems = (inv.items || [])
      .filter(i => (i.description || i.name)?.trim() || Number(i.unitPrice || i.amount) > 0)
      .map(i => ({
        id: i.id,
        description: i.description || i.name || 'Custom Spatial Item',
        quantity: typeof i.quantity === 'number' ? i.quantity : 1,
        unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : (Number(i.amount) || 0),
        amount: Number(i.amount) || ((typeof i.quantity === 'number' ? i.quantity : 1) * (typeof i.unitPrice === 'number' ? i.unitPrice : 0)),
        paymentType: i.paymentType,
        refCode: i.refCode || '—',
        date: i.date || inv.date
      }));

    return {
      docNumber: inv.docNumber,
      date: inv.date,
      dueDate: inv.dueDate,
      invoiceMode: inv.invoiceMode === 'itemized' ? 'pay_later' as const : 'walk_in' as const,
      clientName: inv.clientName || 'Valued Client',
      clientEmail: inv.clientEmail,
      clientPhone: inv.clientPhone,
      projectName: inv.projectName,
      items: pdfItems.length > 0 ? pdfItems : [{
        id: '1',
        description: 'Interior Design & Spatial Services',
        quantity: 1,
        unitPrice: inv.totalInvoiced || 0
      }],
      subtotal: inv.subtotal,
      discount: inv.discount,
      taxRate: inv.taxRate,
      taxAmount: inv.taxAmount,
      totalInvoiced: inv.totalInvoiced,
      amountPaid: inv.amountPaid || 0,
      balanceDue: inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, (inv.totalInvoiced || 0) - (inv.amountPaid || 0)),
      notes: inv.notes,
      currencySymbol: 'KES',
      companyInfo: {
        name: 'Pamnim Interior Designers',
        address: content.contact?.address || 'Nairobi, Kenya',
        phone: content.contact?.phone || '0714 984 268',
        email: content.contact?.email || 'hinteriors01@gmail.com',
        tagline: 'Shinning outside, beautiful inside'
      }
    };
  };

  const handleDownloadPDF = async (inv: SavedInvoice) => {
    if (!inv.id) return;
    setDownloadingId(inv.id);
    try {
      const data = buildPDFData(inv);
      await generateDocumentPDF('invoice', data);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF document.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSharePDF = async (inv: SavedInvoice) => {
    if (!inv.id) return;
    setSharingId(inv.id);
    try {
      const data = buildPDFData(inv);
      await shareDocumentPDF('invoice', data);
    } catch (err) {
      console.error('PDF share error:', err);
      alert('Failed to share invoice PDF.');
    } finally {
      setSharingId(null);
    }
  };

  const handlePrintPDF = async (inv: SavedInvoice) => {
    if (!inv.id) return;
    setPrintingId(inv.id);
    try {
      const data = buildPDFData(inv);
      // Generate document and trigger print
      await generateDocumentPDF('invoice', data);
    } catch (err) {
      console.error('Print error:', err);
      alert('Could not prepare invoice for printing.');
    } finally {
      setPrintingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete?.id) return;
    setIsDeleting(true);
    try {
      // 1. Delete payment receipts subcollection
      try {
        const receiptsSnap = await getDocs(collection(db, 'invoices', invoiceToDelete.id, 'paymentReceipts'));
        for (const rDoc of receiptsSnap.docs) {
          await deleteDoc(doc(db, 'invoices', invoiceToDelete.id, 'paymentReceipts', rDoc.id));
        }
      } catch (subErr) {
        console.warn('Could not clean up receipts subcollection:', subErr);
      }

      // 2. Delete parent invoice
      await deleteDoc(doc(db, 'invoices', invoiceToDelete.id));
      setInvoiceToDelete(null);
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      alert('Could not delete invoice: ' + String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Log Payment Modal
  const handleOpenPaymentModal = (inv: SavedInvoice) => {
    setPaymentInvoice(inv);
    const remaining = inv.balanceDue !== undefined && inv.balanceDue >= 0 
      ? inv.balanceDue 
      : Math.max(0, (Number(inv.totalInvoiced) || 0) - (Number(inv.amountPaid) || 0));
    setPayAmount(remaining > 0 ? remaining : '');
    setPayMethod('M-Pesa');
    setPayReference('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
    setPayError(null);
    setPaymentSuccess(null);
  };

  // Submit Payment with REQUIRED Reference Code
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);

    if (!paymentInvoice?.id) return;

    const numericAmount = Number(payAmount);
    if (!numericAmount || numericAmount <= 0) {
      setPayError('Please enter a valid payment amount greater than KES 0.');
      return;
    }

    if (!payReference.trim()) {
      setPayError('Reference code is required for invoice payments (e.g. M-Pesa transaction code or bank reference).');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const prevPaid = Number(paymentInvoice.amountPaid) || 0;
      const totalInv = Number(paymentInvoice.totalInvoiced) || 0;
      const newPaid = prevPaid + numericAmount;
      const newBalance = Math.max(0, totalInv - newPaid);
      const newStatus: InvoiceStatus = newBalance <= 0 ? 'paid' : 'partial';

      // 1. Write receipt record to invoices/{inv.id}/paymentReceipts subcollection
      const receiptData: Record<string, any> = cleanPayload({
        receiptNumber,
        invoiceId: paymentInvoice.id,
        invoiceNumber: paymentInvoice.docNumber,
        clientName: paymentInvoice.clientName || 'Client',
        amount: numericAmount,
        paymentMethod: payMethod,
        referenceNumber: payReference.trim(),
        balanceRemaining: newBalance,
        totalInvoiceAmount: totalInv,
        date: payDate,
        notes: payNotes.trim() || undefined,
        recordedBy: profile?.name || 'Owner',
        createdAt: new Date().toISOString(),
        projectId: paymentInvoice.projectId || undefined,
        projectName: paymentInvoice.projectName || undefined,
        clientId: paymentInvoice.clientId || undefined,
        clientEmail: paymentInvoice.clientEmail || undefined,
        clientPhone: paymentInvoice.clientPhone || undefined
      });

      await addDoc(collection(db, 'invoices', paymentInvoice.id, 'paymentReceipts'), receiptData);

      // 2. If invoice is linked to a project, sync to projects/{projectId}/payments
      if (paymentInvoice.projectId) {
        try {
          await addDoc(collection(db, 'projects', paymentInvoice.projectId, 'payments'), cleanPayload({
            amount: numericAmount,
            type: 'credit',
            method: payMethod,
            reference: payReference.trim(),
            date: payDate,
            notes: payNotes.trim() 
              ? `${payNotes.trim()} (Receipt: ${receiptNumber}, Inv: ${paymentInvoice.docNumber})`
              : `Invoice payment for ${paymentInvoice.docNumber} (Receipt: ${receiptNumber})`,
            recordedBy: profile?.name || 'Owner',
            createdAt: new Date().toISOString()
          }));
        } catch (projErr) {
          console.warn('Could not mirror payment to project subcollection:', projErr);
        }
      }

      // 3. Update the parent invoice: amountPaid, balanceDue, status, and lock original terms
      await updateDoc(doc(db, 'invoices', paymentInvoice.id), {
        amountPaid: newPaid,
        balanceDue: newBalance,
        status: newStatus,
        isLocked: true, // Lock original invoice amounts/terms
        updatedAt: new Date().toISOString()
      });

      // 4. Automatically generate and download the separate payment receipt document
      try {
        await generatePaymentReceiptPDF({
          receiptNumber,
          invoiceNumber: paymentInvoice.docNumber,
          clientName: paymentInvoice.clientName || 'Client',
          clientPhone: paymentInvoice.clientPhone,
          clientEmail: paymentInvoice.clientEmail,
          projectName: paymentInvoice.projectName,
          amount: numericAmount,
          paymentMethod: payMethod,
          referenceNumber: payReference.trim(),
          balanceRemaining: newBalance,
          totalInvoiceAmount: totalInv,
          date: payDate,
          notes: payNotes.trim() || undefined,
          recordedBy: profile?.name || 'Owner'
        });
      } catch (pdfErr) {
        console.warn('Receipt PDF auto-download notification:', pdfErr);
      }

      setPaymentSuccess(`Payment of KES ${formatMoney(numericAmount)} recorded! Receipt ${receiptNumber} generated.`);
      setTimeout(() => {
        setPaymentInvoice(null);
        setPaymentSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setPayError(err?.message || 'Failed to record payment.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Open Receipts Viewer Modal
  const handleOpenReceiptsModal = async (inv: SavedInvoice) => {
    if (!inv.id) return;
    setReceiptsInvoice(inv);
    setLoadingReceipts(true);
    try {
      const q = query(
        collection(db, 'invoices', inv.id, 'paymentReceipts'), 
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PaymentReceipt[];
      setInvoiceReceipts(list);
    } catch (err) {
      console.error('Error loading receipts:', err);
    } finally {
      setLoadingReceipts(false);
    }
  };

  const handleDownloadReceiptPDF = async (rec: PaymentReceipt) => {
    if (!rec.id) return;
    setDownloadingReceiptId(rec.id);
    try {
      await generatePaymentReceiptPDF({
        receiptNumber: rec.receiptNumber,
        invoiceNumber: rec.invoiceNumber || receiptsInvoice?.docNumber || 'INV',
        clientName: rec.clientName || receiptsInvoice?.clientName || 'Client',
        clientPhone: rec.clientPhone || receiptsInvoice?.clientPhone,
        clientEmail: rec.clientEmail || receiptsInvoice?.clientEmail,
        projectName: rec.projectName || receiptsInvoice?.projectName,
        amount: rec.amount,
        paymentMethod: rec.paymentMethod,
        referenceNumber: rec.referenceNumber || rec.reference || '—',
        balanceRemaining: rec.balanceRemaining,
        totalInvoiceAmount: rec.totalInvoiceAmount,
        date: rec.date,
        notes: rec.notes,
        recordedBy: rec.recordedBy
      });
    } catch (err) {
      console.error('Error downloading receipt PDF:', err);
      alert('Could not download payment receipt PDF.');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  // Filter & Search
  const filteredInvoices = invoices.filter(inv => {
    const calcStatus = computeCalculatedStatus(inv);
    const matchesStatus = statusFilter === 'all' || calcStatus === statusFilter;
    const term = search.toLowerCase().trim();
    const matchesSearch = !term ||
      (inv.clientName && inv.clientName.toLowerCase().includes(term)) ||
      (inv.docNumber && inv.docNumber.toLowerCase().includes(term)) ||
      (inv.projectName && inv.projectName.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Bar / Controls */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-xs font-bold uppercase tracking-wider mb-2">
            <FileText className="w-3.5 h-3.5" />
            <span>Saved Billing Archive</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-charcoal">Invoices Archive</h3>
          <p className="text-xs sm:text-sm text-charcoal/60 mt-1">
            Browse past invoices, log client payments with required reference codes, and download receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="px-5 py-3 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-ochre/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Invoice</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-charcoal/10 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, invoice #, project..."
            className="w-full pl-10 pr-4 py-2 bg-cream/50 border border-charcoal/10 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer",
              statusFilter === 'all'
                ? "bg-charcoal text-white"
                : "bg-cream text-charcoal/60 hover:text-charcoal"
            )}
          >
            All Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setStatusFilter('sent')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer",
              statusFilter === 'sent'
                ? "bg-amber-600 text-white"
                : "bg-cream text-charcoal/60 hover:text-charcoal"
            )}
          >
            Unpaid ({invoices.filter(i => computeCalculatedStatus(i) === 'sent').length})
          </button>
          <button
            onClick={() => setStatusFilter('partial')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer",
              statusFilter === 'partial'
                ? "bg-blue-600 text-white"
                : "bg-cream text-charcoal/60 hover:text-charcoal"
            )}
          >
            Partial ({invoices.filter(i => computeCalculatedStatus(i) === 'partial').length})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer",
              statusFilter === 'paid'
                ? "bg-emerald-600 text-white"
                : "bg-cream text-charcoal/60 hover:text-charcoal"
            )}
          >
            Paid ({invoices.filter(i => computeCalculatedStatus(i) === 'paid').length})
          </button>
        </div>
      </div>

      {/* Invoices List / Grid */}
      {loading ? (
        <div className="py-20 text-center text-charcoal/50 text-xs font-medium bg-white rounded-3xl border border-charcoal/10">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-ochre" />
          <span>Loading saved invoices archive...</span>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center mx-auto text-charcoal/40">
            <FileText className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-charcoal">No invoices found</h3>
            <p className="text-xs text-charcoal/60 mt-1">
              {search 
                ? 'No invoices matched your search filter.'
                : 'No invoices have been saved yet. Use the Invoice Builder tab to create your first official invoice.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateNew}
            className="px-5 py-2.5 rounded-2xl bg-ochre text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md shadow-ochre/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => {
            const calculatedStatus = computeCalculatedStatus(inv);
            const total = Number(inv.totalInvoiced) || 0;
            const paid = Number(inv.amountPaid) || 0;
            const balance = Math.max(0, total - paid);
            const hasPayments = paid > 0 || inv.isLocked;

            return (
              <div
                key={inv.id}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-charcoal/10 shadow-xs hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Metadata */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-charcoal font-mono">
                      {inv.docNumber}
                    </span>

                    {/* Auto-calculated Status Badge (No manual override) */}
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      calculatedStatus === 'paid' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                      calculatedStatus === 'partial' && "bg-blue-50 text-blue-700 border-blue-200",
                      calculatedStatus === 'sent' && "bg-amber-50 text-amber-800 border-amber-200"
                    )}>
                      {calculatedStatus === 'paid' ? 'Paid in Full' : calculatedStatus === 'partial' ? 'Partial Payment' : 'Unpaid'}
                    </span>

                    {hasPayments && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-charcoal/50 bg-charcoal/5 px-2 py-0.5 rounded-full" title="Locked against terms modification">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>Audit Locked</span>
                      </span>
                    )}

                    {inv.recipientType && (
                      <span className="text-[10px] font-medium text-charcoal/50 uppercase">
                        • {inv.recipientType === 'lead' ? 'Manual Lead' : inv.recipientType === 'walk_in' ? 'Walk-in' : 'Registered Client'}
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-charcoal truncate">
                    {inv.clientName}
                  </h4>

                  <div className="flex items-center gap-3 text-xs text-charcoal/60 flex-wrap">
                    <span>Date: {inv.date}</span>
                    {inv.projectName && (
                      <span className="text-ochre font-medium">Project: {inv.projectName}</span>
                    )}
                    {inv.dueDate && (
                      <span className="text-charcoal/40">Due: {inv.dueDate}</span>
                    )}
                  </div>
                </div>

                {/* Center: Financials */}
                <div className="grid grid-cols-3 gap-3 p-3 bg-cream/40 rounded-xl border border-charcoal/5 text-center min-w-[280px]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-charcoal/50 block">Invoice Total</span>
                    <span className="text-xs sm:text-sm font-bold text-charcoal">
                      KES {formatMoney(total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-charcoal/50 block">Amount Paid</span>
                    <span className={cn(
                      "text-xs sm:text-sm font-bold",
                      paid > 0 ? "text-emerald-600" : "text-charcoal/50"
                    )}>
                      KES {formatMoney(paid)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-charcoal/50 block">Balance Due</span>
                    <span className={cn(
                      "text-xs sm:text-sm font-bold",
                      balance > 0 ? "text-amber-700" : "text-charcoal/40"
                    )}>
                      KES {formatMoney(balance)}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                  {/* Log Payment Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenPaymentModal(inv)}
                    className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
                    title="Log Payment with Reference Code"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Log Payment</span>
                  </button>

                  {/* View Receipts Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenReceiptsModal(inv)}
                    className="p-2 rounded-xl border border-charcoal/15 text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
                    title="View Payments & Download Receipts"
                  >
                    <Receipt className="w-4 h-4 text-charcoal/60" />
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => onLoadInvoice(inv)}
                    className="p-2 rounded-xl border border-charcoal/15 text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
                    title={hasPayments ? "Edit invoice (financials locked)" : "Edit invoice"}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Duplicate Button (Edit to make another) */}
                  <button
                    type="button"
                    onClick={() => onDuplicateInvoice(inv)}
                    className="p-2 rounded-xl border border-charcoal/15 text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
                    title="Edit to make another (Duplicate)"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Print Button */}
                  <button
                    type="button"
                    onClick={() => handlePrintPDF(inv)}
                    disabled={printingId === inv.id}
                    className="p-2 rounded-xl border border-charcoal/15 text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
                    title="Print Invoice"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {/* Download PDF Button */}
                  <button
                    type="button"
                    onClick={() => handleDownloadPDF(inv)}
                    disabled={downloadingId === inv.id}
                    className="p-2 rounded-xl bg-charcoal text-white hover:bg-charcoal/90 transition-colors cursor-pointer disabled:opacity-50"
                    title="Download Official PDF"
                  >
                    <Download className={cn("w-4 h-4", downloadingId === inv.id && "animate-bounce")} />
                  </button>

                  {/* Share PDF Button */}
                  <button
                    type="button"
                    onClick={() => handleSharePDF(inv)}
                    disabled={sharingId === inv.id}
                    className="p-2 rounded-xl bg-ochre text-white hover:bg-ochre-dark transition-colors cursor-pointer disabled:opacity-50"
                    title="Share via WhatsApp or Native Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setInvoiceToDelete(inv)}
                    className="p-2 rounded-xl text-charcoal/40 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LOG PAYMENT MODAL (Reference Code is REQUIRED) */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-charcoal/15 shadow-2xl p-6 sm:p-8 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Record Client Payment</span>
                </div>
                <h3 className="text-lg font-bold text-charcoal mt-0.5">
                  Invoice {paymentInvoice.docNumber}
                </h3>
                <p className="text-xs text-charcoal/60">
                  Client: <strong className="text-charcoal">{paymentInvoice.clientName}</strong>
                </p>
              </div>
              <button
                onClick={() => setPaymentInvoice(null)}
                className="p-1.5 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold space-y-2 animate-fade-in text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p>{paymentSuccess}</p>
                <p className="text-[11px] font-normal text-emerald-700">The separate receipt PDF has been generated and downloaded.</p>
              </div>
            ) : (
              <form onSubmit={handleRecordPayment} className="space-y-4">
                {payError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{payError}</span>
                  </div>
                )}

                {/* Summary box */}
                <div className="p-3 bg-cream/50 rounded-xl border border-charcoal/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-charcoal/50 block text-[10px] uppercase font-bold">Total Invoiced</span>
                    <span className="font-bold text-charcoal">KES {formatMoney(Number(paymentInvoice.totalInvoiced) || 0)}</span>
                  </div>
                  <div>
                    <span className="text-charcoal/50 block text-[10px] uppercase font-bold">Already Paid</span>
                    <span className="font-bold text-emerald-600">KES {formatMoney(Number(paymentInvoice.amountPaid) || 0)}</span>
                  </div>
                  <div>
                    <span className="text-charcoal/50 block text-[10px] uppercase font-bold">Remaining</span>
                    <span className="font-bold text-amber-700">KES {formatMoney(Number(paymentInvoice.balanceDue) || 0)}</span>
                  </div>
                </div>

                {/* Payment Amount */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                    Amount Paid (KES) <span className="text-ochre">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter amount paid"
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-sm font-bold focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Payment Method */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                      Method <span className="text-ochre">*</span>
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre focus:bg-white text-charcoal cursor-pointer"
                    >
                      <option value="M-Pesa">M-Pesa</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                      Payment Date <span className="text-ochre">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full px-3.5 py-2 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre focus:bg-white text-charcoal cursor-pointer"
                    />
                  </div>
                </div>

                {/* REQUIRED Reference Code */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1 flex items-center justify-between">
                    <span>Reference / Transaction Code <span className="text-red-500">* (REQUIRED)</span></span>
                    <span className="text-[10px] text-charcoal/40 font-normal">e.g. QHX89J2KL</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="M-Pesa code, Bank slip #, Cheque #"
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-ochre focus:bg-white text-charcoal uppercase"
                  />
                  <p className="text-[11px] text-charcoal/50 mt-1">
                    Unlike worker wages where reference is optional, client invoice payments strictly require a verification reference code.
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                    Notes / Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. 50% deposit for joinery materials"
                    className="w-full px-3.5 py-2 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                  <button
                    type="button"
                    onClick={() => setPaymentInvoice(null)}
                    className="px-4 py-2.5 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-700/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSubmittingPayment ? 'Recording...' : 'Record & Download Receipt'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* RECEIPTS VIEWER MODAL */}
      {receiptsInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-charcoal/15 shadow-2xl p-6 sm:p-8 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-ochre" />
                  <span className="text-xs font-bold uppercase tracking-wider text-ochre">Payment Receipts History</span>
                </div>
                <h3 className="text-lg font-bold text-charcoal mt-0.5">
                  Invoice {receiptsInvoice.docNumber}
                </h3>
                <p className="text-xs text-charcoal/60">
                  Client: <strong className="text-charcoal">{receiptsInvoice.clientName}</strong>
                </p>
              </div>
              <button
                onClick={() => setReceiptsInvoice(null)}
                className="p-1.5 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingReceipts ? (
              <div className="py-12 text-center text-charcoal/50 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-ochre" />
                <span>Loading receipts...</span>
              </div>
            ) : invoiceReceipts.length === 0 ? (
              <div className="py-10 text-center text-charcoal/50 space-y-2">
                <Receipt className="w-8 h-8 mx-auto text-charcoal/30" />
                <p className="text-xs font-semibold">No payments recorded against this invoice yet.</p>
                <p className="text-[11px] text-charcoal/40">Use the "Log Payment" button to record client payments.</p>
              </div>
            ) : (
              <div className="space-y-3 divide-y divide-charcoal/5">
                {invoiceReceipts.map(rec => (
                  <div key={rec.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-charcoal font-mono">{rec.receiptNumber}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 font-bold">
                          {rec.paymentMethod}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal/60">
                        Date: <strong>{rec.date}</strong> • Ref: <strong className="font-mono text-charcoal">{rec.referenceNumber || rec.reference || '—'}</strong>
                      </p>
                      {rec.notes && (
                        <p className="text-[11px] text-charcoal/50 italic">{rec.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-700 block">
                          KES {formatMoney(rec.amount)}
                        </span>
                        {rec.balanceRemaining !== undefined && (
                          <span className="text-[10px] text-charcoal/40 block">
                            Bal: KES {formatMoney(rec.balanceRemaining)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadReceiptPDF(rec)}
                        disabled={downloadingReceiptId === rec.id}
                        className="p-2 rounded-xl bg-cream hover:bg-ochre hover:text-white transition-colors cursor-pointer text-charcoal/70"
                        title="Download Receipt PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-charcoal/10 flex justify-end">
              <button
                type="button"
                onClick={() => setReceiptsInvoice(null)}
                className="px-5 py-2 rounded-xl bg-charcoal text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Invoice Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-red-200 shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-charcoal">Delete Invoice</h3>
                <p className="text-xs text-red-700 font-medium">Permanent Action</p>
              </div>
            </div>

            <p className="text-xs text-charcoal/70">
              Are you sure you want to permanently delete invoice <strong className="text-charcoal font-mono">{invoiceToDelete.docNumber}</strong> for <strong className="text-charcoal">{invoiceToDelete.clientName}</strong>? All associated payment receipts in this record will be removed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
