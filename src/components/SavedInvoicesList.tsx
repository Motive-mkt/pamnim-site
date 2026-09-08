import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SavedInvoice, InvoiceStatus } from '../types/documents';
import { 
  FileText, Search, Download, Edit2, Copy, Trash2, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, Plus, ExternalLink, Filter, Calendar
} from 'lucide-react';
import { generateDocumentPDF, formatMoney } from '../utils/pdfGenerator';
import { useCMS } from '../hooks/useCMS';
import { cn } from '../lib/utils';

interface SavedInvoicesListProps {
  onLoadInvoice: (invoice: SavedInvoice) => void;
  onDuplicateInvoice: (invoice: SavedInvoice) => void;
  onCreateNew: () => void;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Draft', bg: 'bg-charcoal/5', text: 'text-charcoal/70', border: 'border-charcoal/10' },
  sent: { label: 'Sent', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  paid: { label: 'Paid in Full', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  partial: { label: 'Partially Paid', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
};

export default function SavedInvoicesList({
  onLoadInvoice,
  onDuplicateInvoice,
  onCreateNew
}: SavedInvoicesListProps) {
  const { content } = useCMS();
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
                  <th className="p-3.5">Date</th>
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

                      {/* Date */}
                      <td className="p-3.5 text-charcoal/60 whitespace-nowrap">
                        {inv.date}
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
    </div>
  );
}
