import React, { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SavedInvoice, InvoiceStatus, PaymentReceipt } from '../types/documents';
import { 
  FileText, Search, Download, Edit2, Copy, Trash2, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, Plus, ExternalLink, Filter, Calendar,
  CreditCard, Receipt, DollarSign, X, Check, Share2
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

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Draft', bg: 'bg-charcoal/5', text: 'text-charcoal/70', border: 'border-charcoal/10' },
  sent: { label: 'Unpaid', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  paid: { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  partial: { label: 'Partial', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
};

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
  const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Payment Recording Modal State
  const [paymentInvoice, setPaymentInvoice] = useState<SavedInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<string>('M-Pesa');
  const [payReference, setPayReference] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState<string>('');
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

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      await updateDoc(doc(db, 'invoices', invoiceId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to update invoice status:', err);
      alert('Could not update status.');
    }
  };

  const handleDownloadPDF = async (inv: SavedInvoice) => {
    if (!inv.id) return;
    setDownloadingId(inv.id);
    try {
      const pdfItems = (inv.items || [])
        .filter(i => i.name?.trim() || Number(i.amount) > 0)
        .map(i => ({
          id: i.id,
          description: i.name || 'Payment Item',
          paymentType: i.paymentType,
          refCode: i.refCode || '—',
          date: i.date || inv.date,
          amount: Number(i.amount) || 0,
          quantity: 1,
          unitPrice: Number(i.amount) || 0
        }));

      await generateDocumentPDF('invoice', {
        docNumber: inv.docNumber,
        date: inv.date,
        dueDate: inv.dueDate,
        invoiceMode: inv.invoiceMode,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        clientPhone: inv.clientPhone,
        projectName: inv.projectName,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Payment Item',
          paymentType: 'Partial',
          refCode: '—',
          date: inv.date,
          amount: 0,
          quantity: 1,
          unitPrice: 0
        }],
        subtotal: inv.subtotal,
        discount: inv.discount,
        taxRate: inv.taxRate,
        taxAmount: inv.taxAmount,
        totalInvoiced: inv.totalInvoiced,
        amountPaid: inv.amountPaid,
        balanceDue: inv.balanceDue,
        notes: inv.notes,
        currencySymbol: 'KES',
        companyInfo: {
          name: 'Pamnim Interior Designers',
          address: content.contact?.address || 'Nairobi, Kenya',
          phone: content.contact?.phone || '0714 984 268',
          email: content.contact?.email || 'hinteriors01@gmail.com',
          tagline: 'Shinning outside, beautiful inside'
        }
      });
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Failed to generate PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSharePDF = async (inv: SavedInvoice) => {
    if (!inv.id) return;
    setSharingId(inv.id);
    try {
      const pdfItems = (inv.items || [])
        .filter(i => i.name?.trim() || Number(i.amount) > 0)
        .map(i => ({
          id: i.id,
          description: i.name || 'Payment Item',
          paymentType: i.paymentType,
          refCode: i.refCode || '—',
          date: i.date || inv.date,
          amount: Number(i.amount) || 0,
          quantity: 1,
          unitPrice: Number(i.amount) || 0
        }));

      await shareDocumentPDF('invoice', {
        docNumber: inv.docNumber,
        date: inv.date,
        dueDate: inv.dueDate,
        invoiceMode: inv.invoiceMode,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        clientPhone: inv.clientPhone,
        projectName: inv.projectName,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Payment Item',
          paymentType: 'Partial',
          refCode: '—',
          date: inv.date,
          amount: 0,
          quantity: 1,
          unitPrice: 0
        }],
        subtotal: inv.subtotal,
        discount: inv.discount,
        taxRate: inv.taxRate,
        taxAmount: inv.taxAmount,
        totalInvoiced: inv.totalInvoiced,
        amountPaid: inv.amountPaid,
        balanceDue: inv.balanceDue,
        notes: inv.notes,
        currencySymbol: 'KES',
        companyInfo: {
          name: 'Pamnim Interior Designers',
          address: content.contact?.address || 'Nairobi, Kenya',
          phone: content.contact?.phone || '0714 984 268',
          email: content.contact?.email || 'hinteriors01@gmail.com',
          tagline: 'Shinning outside, beautiful inside'
        }
      });
    } catch (err) {
      console.error('PDF share error:', err);
      alert('Failed to share invoice PDF.');
    } finally {
      setSharingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'invoices', invoiceToDelete.id));
      setInvoiceToDelete(null);
    } catch (err) {
      console.error('Failed to delete invoice:', err);
      alert('Could not delete invoice.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Log Payment Modal
  const handleOpenPaymentModal = (inv: SavedInvoice) => {
    setPaymentInvoice(inv);
    const remaining = inv.balanceDue && inv.balanceDue > 0 
      ? inv.balanceDue 
      : Math.max(0, (Number(inv.totalInvoiced) || 0) - (Number(inv.amountPaid) || 0));
    setPayAmount(remaining > 0 ? remaining : '');
    setPayMethod('M-Pesa');
    setPayReference('');
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayNotes('');
    setPaymentSuccess(null);
  };

  // Submit Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice?.id) return;

    const numericAmount = Number(payAmount);
    if (!numericAmount || numericAmount <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
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
      const receiptData: Record<string, any> = {
        receiptNumber,
        invoiceId: paymentInvoice.id,
        invoiceNumber: paymentInvoice.docNumber,
        clientName: paymentInvoice.clientName || 'Client',
        amount: numericAmount,
        paymentMethod: payMethod,
        referenceNumber: payReference.trim() || '—',
        balanceRemaining: newBalance,
        totalInvoiceAmount: totalInv,
        date: payDate,
        notes: payNotes.trim(),
        recordedBy: profile?.name || 'Staff',
        createdAt: new Date().toISOString()
      };
      if (paymentInvoice.projectId) receiptData.projectId = paymentInvoice.projectId;
      if (paymentInvoice.projectName) receiptData.projectName = paymentInvoice.projectName;
      if (paymentInvoice.clientId) receiptData.clientId = paymentInvoice.clientId;
      if (paymentInvoice.clientEmail) receiptData.clientEmail = paymentInvoice.clientEmail;
      if (paymentInvoice.clientPhone) receiptData.clientPhone = paymentInvoice.clientPhone;

      await addDoc(collection(db, 'invoices', paymentInvoice.id, 'paymentReceipts'), receiptData);

      // 2. If invoice is linked to a project, sync to projects/{projectId}/payments
      if (paymentInvoice.projectId) {
        try {
          await addDoc(collection(db, 'projects', paymentInvoice.projectId, 'payments'), {
            amount: numericAmount,
            type: 'credit',
            method: payMethod,
            reference: payReference.trim() || '—',
            date: payDate,
            notes: payNotes.trim() 
              ? `${payNotes.trim()} (Receipt: ${receiptNumber}, Inv: ${paymentInvoice.docNumber})`
              : `Invoice payment for ${paymentInvoice.docNumber} (Receipt: ${receiptNumber})`,
            recordedBy: profile?.name || 'Staff',
            createdAt: new Date().toISOString()
          });
        } catch (projErr) {
          console.warn('Could not sync payment to project payments subcollection:', projErr);
        }
      }

      // 3. Update invoice balance and status
      await updateDoc(doc(db, 'invoices', paymentInvoice.id), {
        amountPaid: newPaid,
        balanceDue: newBalance,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // 4. Generate and download official Payment Receipt PDF
      try {
        await generatePaymentReceiptPDF({
          receiptNumber,
          invoiceNumber: paymentInvoice.docNumber,
          date: payDate,
          clientName: paymentInvoice.clientName,
          clientEmail: paymentInvoice.clientEmail,
          clientPhone: paymentInvoice.clientPhone,
          projectName: paymentInvoice.projectName,
          amount: numericAmount,
          paymentMethod: payMethod,
          referenceNumber: payReference.trim() || '—',
          balanceRemaining: newBalance,
          totalInvoiceAmount: totalInv,
          notes: payNotes.trim(),
          recordedBy: profile?.name || 'Staff',
          companyInfo: {
            name: 'Pamnim Interior Designers',
            address: content.contact?.address || 'Nairobi, Kenya',
            phone: content.contact?.phone || '0714 984 268',
            email: content.contact?.email || 'hinteriors01@gmail.com'
          }
        });
      } catch (pdfErr) {
        console.error('Receipt PDF generation error:', pdfErr);
      }

      setPaymentSuccess(`Payment of KES ${formatMoney(numericAmount)} recorded successfully! Official Receipt ${receiptNumber} generated.`);
      setTimeout(() => {
        setPaymentInvoice(null);
        setPaymentSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      alert(err.message || 'Failed to record payment.');
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
      const snap = await getDocs(
        query(collection(db, 'invoices', inv.id, 'paymentReceipts'), orderBy('createdAt', 'desc'))
      );
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as PaymentReceipt[];
      setInvoiceReceipts(list);
    } catch (err) {
      console.error('Error loading receipts:', err);
      setInvoiceReceipts([]);
    } finally {
      setLoadingReceipts(false);
    }
  };

  // Re-download a specific Receipt PDF
  const handleDownloadReceiptPDF = async (receipt: PaymentReceipt, inv: SavedInvoice) => {
    setDownloadingReceiptId(receipt.id);
    try {
      await generatePaymentReceiptPDF({
        receiptNumber: receipt.receiptNumber,
        invoiceNumber: receipt.invoiceNumber || inv.docNumber,
        date: receipt.date,
        clientName: receipt.clientName || inv.clientName,
        clientEmail: inv.clientEmail,
        clientPhone: inv.clientPhone,
        projectName: receipt.projectName || inv.projectName,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        referenceNumber: receipt.referenceNumber,
        balanceRemaining: receipt.balanceRemaining !== undefined ? receipt.balanceRemaining : inv.balanceDue,
        totalInvoiceAmount: receipt.totalInvoiceAmount !== undefined ? receipt.totalInvoiceAmount : inv.totalInvoiced,
        notes: receipt.notes,
        recordedBy: receipt.recordedBy || 'Staff',
        companyInfo: {
          name: 'Pamnim Interior Designers',
          address: content.contact?.address || 'Nairobi, Kenya',
          phone: content.contact?.phone || '0714 984 268',
          email: content.contact?.email || 'hinteriors01@gmail.com'
        }
      });
    } catch (err) {
      console.error('Error re-downloading receipt PDF:', err);
      alert('Failed to generate receipt PDF.');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  // Filter logic
  const filtered = invoices.filter(inv => {
    const term = search.toLowerCase().trim();
    const matchesSearch = !term ||
      inv.docNumber.toLowerCase().includes(term) ||
      inv.clientName.toLowerCase().includes(term) ||
      (inv.projectName && inv.projectName.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Analytics
  const totalInvoicedSum = invoices.reduce((acc, i) => acc + (Number(i.totalInvoiced) || 0), 0);
  const totalPaidSum = invoices.reduce((acc, i) => acc + (Number(i.amountPaid) || 0), 0);
  const totalBalanceDue = invoices.reduce((acc, i) => acc + (Number(i.balanceDue) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Bar with Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Total Invoices</p>
          <p className="text-xl font-bold text-charcoal mt-1">{invoices.length}</p>
        </div>
        <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Total Invoiced</p>
          <p className="text-xl font-bold font-mono text-charcoal mt-1">KES {formatMoney(totalInvoicedSum)}</p>
        </div>
        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Total Collected</p>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">KES {formatMoney(totalPaidSum)}</p>
        </div>
        <div className="p-4 bg-red-50/70 rounded-2xl border border-red-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-red-800">Outstanding Balance</p>
          <p className="text-xl font-bold font-mono text-red-700 mt-1">KES {formatMoney(totalBalanceDue)}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-charcoal/10 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by invoice number, client name, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-cream/30 border border-charcoal/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-cream/30 border border-charcoal/10 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-red-600 cursor-pointer"
          >
            <option value="all">All Statuses ({invoices.length})</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid in Full</option>
            <option value="partial">Partially Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={onCreateNew}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm shadow-red-600/20 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* Invoice List / Table */}
      {loading ? (
        <div className="p-12 text-center text-charcoal/40 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-charcoal/30" />
          <span>Loading saved invoices archive...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-charcoal/5 flex items-center justify-center mx-auto text-charcoal/30">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-charcoal">
            {search || statusFilter !== 'all' ? 'No invoices match your filter' : 'No saved invoices yet'}
          </h4>
          <p className="text-xs text-charcoal/50 max-w-sm mx-auto">
            {search || statusFilter !== 'all' 
              ? 'Try adjusting your search keywords or status filter.'
              : 'Generate and save your first branded invoice to keep a permanent archive with client payment tracking.'}
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-charcoal/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Invoice #</th>
                  <th className="p-3.5">Client & Project</th>
                  <th className="p-3.5">Date / Due</th>
                  <th className="p-3.5 text-right">Invoiced (KES)</th>
                  <th className="p-3.5 text-right">Paid (KES)</th>
                  <th className="p-3.5 text-right">Balance Due (KES)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5 text-xs">
                {filtered.map((inv) => {
                  const statusInfo = STATUS_CONFIG[inv.status || 'draft'] || STATUS_CONFIG.draft;
                  const isDownloading = downloadingId === inv.id;
                  const isSharing = sharingId === inv.id;
                  const isOverdue = inv.dueDate && inv.status !== 'paid' && new Date(inv.dueDate) < new Date();

                  return (
                    <tr key={inv.id} className="hover:bg-cream/20 transition-colors">
                      {/* Doc Number */}
                      <td className="p-3.5 pl-5 font-mono font-bold text-charcoal">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>{inv.docNumber}</span>
                        </div>
                      </td>

                      {/* Client & Project */}
                      <td className="p-3.5">
                        <div className="font-bold text-charcoal">{inv.clientName}</div>
                        {inv.projectName && (
                          <div className="text-[11px] text-charcoal/50 truncate max-w-xs">
                            {inv.projectName}
                          </div>
                        )}
                      </td>

                      {/* Date & Due */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="text-charcoal/80 font-medium">{inv.date}</div>
                        {inv.dueDate && (
                          <div className={cn(
                            "text-[10px] font-semibold mt-0.5",
                            isOverdue ? "text-red-600 font-bold" : "text-charcoal/50"
                          )}>
                            Due: {inv.dueDate} {isOverdue && '⚠️'}
                          </div>
                        )}
                      </td>

                      {/* Invoiced */}
                      <td className="p-3.5 text-right font-mono font-bold text-charcoal">
                        {formatMoney(inv.totalInvoiced)}
                      </td>

                      {/* Paid */}
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                        {formatMoney(inv.amountPaid)}
                      </td>

                      {/* Balance Due */}
                      <td className="p-3.5 text-right font-mono font-bold text-red-600">
                        {formatMoney(inv.balanceDue)}
                      </td>

                      {/* Status Dropdown */}
                      <td className="p-3.5 text-center">
                        <select
                          value={inv.status || 'draft'}
                          onChange={(e) => handleStatusChange(inv.id!, e.target.value as InvoiceStatus)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer",
                            statusInfo.bg, statusInfo.text, statusInfo.border
                          )}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="partial">Partially Paid</option>
                          <option value="paid">Paid in Full</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Log Payment Button */}
                          {(Number(inv.balanceDue) > 0 || inv.status !== 'paid') && (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(inv)}
                              title="Log Payment & Generate Receipt"
                              className="px-2.5 py-1.5 rounded-lg bg-ochre hover:bg-ochre-dark text-white text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Pay</span>
                            </button>
                          )}

                          {/* View Receipts Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenReceiptsModal(inv)}
                            title="View Payment Receipts"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-charcoal/10 text-charcoal/70 hover:text-charcoal transition-colors cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>

                          {/* Share via WhatsApp / Web Share */}
                          <button
                            type="button"
                            onClick={() => handleSharePDF(inv)}
                            disabled={isSharing}
                            title="Share Invoice (WhatsApp / Web Share)"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-emerald-50 text-charcoal hover:text-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Print / Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPDF(inv)}
                            disabled={isDownloading}
                            title="Download PDF"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-red-50 text-charcoal hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit / Load into form */}
                          <button
                            type="button"
                            onClick={() => onLoadInvoice(inv)}
                            title="Edit Invoice"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-ochre/10 text-charcoal hover:text-ochre transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => onDuplicateInvoice(inv)}
                            title="Duplicate as New"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-charcoal/10 text-charcoal transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setInvoiceToDelete(inv)}
                            title="Delete Invoice"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-red-100 text-charcoal hover:text-red-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-charcoal/10 shadow-2xl space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-charcoal">Delete Invoice?</h3>
              <p className="text-xs text-charcoal/60 mt-1">
                Are you sure you want to permanently delete invoice <span className="font-mono font-bold text-charcoal">{invoiceToDelete.docNumber}</span> for <span className="font-bold">{invoiceToDelete.clientName}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-charcoal/70 hover:bg-charcoal/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Payment Modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-charcoal/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal/5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-ochre/10 text-ochre flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Record Invoice Payment</h3>
                  <p className="text-xs text-charcoal/50">Invoice #{paymentInvoice.docNumber} • {paymentInvoice.clientName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentInvoice(null)}
                className="p-1 rounded-lg text-charcoal/40 hover:text-charcoal cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Snapshot */}
            <div className="p-3.5 bg-cream/40 rounded-2xl border border-charcoal/10 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50 block">Invoiced</span>
                <span className="text-xs font-mono font-bold text-charcoal">KES {formatMoney(paymentInvoice.totalInvoiced)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50 block">Paid So Far</span>
                <span className="text-xs font-mono font-bold text-emerald-700">KES {formatMoney(paymentInvoice.amountPaid)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50 block">Remaining</span>
                <span className="text-xs font-mono font-bold text-red-700">KES {formatMoney(paymentInvoice.balanceDue)}</span>
              </div>
            </div>

            {paymentSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 border border-emerald-200 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{paymentSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                  Payment Amount (KES) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 50000"
                  className="w-full px-3.5 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-sm font-mono font-bold focus:outline-none focus:border-ochre"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre cursor-pointer"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                  Transaction Code / Reference
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. QHJ79K2L or Bank Cheque #4928"
                  className="w-full px-3.5 py-2 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-mono focus:outline-none focus:border-ochre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                  Payment Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. 50% deposit for kitchen cabinets..."
                  className="w-full px-3.5 py-2 bg-cream/30 border border-charcoal/15 rounded-xl text-xs focus:outline-none focus:border-ochre resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setPaymentInvoice(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-charcoal/60 hover:bg-charcoal/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2.5 rounded-xl bg-ochre text-white text-xs font-bold hover:bg-ochre-dark transition-all flex items-center gap-1.5 shadow-md shadow-ochre/20 disabled:opacity-50 cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{isSubmittingPayment ? 'Recording...' : 'Record & Download Receipt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipts Viewer Modal */}
      {receiptsInvoice && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-charcoal/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal/5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-charcoal/5 text-charcoal flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-charcoal">Payment Receipts Archive</h3>
                  <p className="text-xs text-charcoal/50">
                    Invoice #{receiptsInvoice.docNumber} • {receiptsInvoice.clientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptsInvoice(null)}
                className="p-1 rounded-lg text-charcoal/40 hover:text-charcoal cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingReceipts ? (
              <div className="p-8 text-center text-charcoal/40 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-charcoal/30" />
                <span>Loading payment receipts...</span>
              </div>
            ) : invoiceReceipts.length === 0 ? (
              <div className="p-8 text-center bg-cream/30 rounded-2xl border border-dashed border-charcoal/10 space-y-2">
                <Receipt className="w-8 h-8 text-charcoal/30 mx-auto" />
                <p className="text-xs font-bold text-charcoal/60">No payment receipts recorded yet for this invoice</p>
                <p className="text-[11px] text-charcoal/40">
                  Use the "Pay" button to log an incoming payment and issue an official branded receipt.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal/5 max-h-96 overflow-y-auto pr-1">
                {invoiceReceipts.map((rcpt) => (
                  <div key={rcpt.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-charcoal">
                          {rcpt.receiptNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {rcpt.paymentMethod}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal/50">
                        {rcpt.date} • Ref: <span className="font-mono text-charcoal/70">{rcpt.referenceNumber || '—'}</span>
                        {rcpt.notes && ` • "${rcpt.notes}"`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-sm text-emerald-700">
                        KES {formatMoney(rcpt.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadReceiptPDF(rcpt, receiptsInvoice)}
                        disabled={downloadingReceiptId === rcpt.id}
                        className="px-3 py-1.5 rounded-lg bg-charcoal/5 hover:bg-ochre/10 text-charcoal hover:text-ochre text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-charcoal/10">
              <span className="text-xs font-semibold text-charcoal/50">
                {invoiceReceipts.length} {invoiceReceipts.length === 1 ? 'receipt' : 'receipts'} on record
              </span>
              <button
                type="button"
                onClick={() => setReceiptsInvoice(null)}
                className="px-5 py-2 rounded-xl border border-charcoal/10 text-xs font-bold text-charcoal/60 hover:bg-cream/40 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
