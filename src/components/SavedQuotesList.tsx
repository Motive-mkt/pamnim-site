import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SavedQuote, QuoteStatus } from '../types/documents';
import { 
  FileSignature, Search, Download, Edit2, Copy, Trash2, CheckCircle2, 
  Clock, AlertCircle, RefreshCw, Plus, Filter, Calendar
} from 'lucide-react';
import { generateDocumentPDF, formatMoney } from '../utils/pdfGenerator';
import { useCMS } from '../hooks/useCMS';
import { cn } from '../lib/utils';

interface SavedQuotesListProps {
  onLoadQuote: (quote: SavedQuote) => void;
  onDuplicateQuote: (quote: SavedQuote) => void;
  onCreateNew: () => void;
}

const STATUS_CONFIG: Record<QuoteStatus, { label: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Draft', bg: 'bg-charcoal/5', text: 'text-charcoal/70', border: 'border-charcoal/10' },
  sent: { label: 'Sent', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  accepted: { label: 'Accepted', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  declined: { label: 'Declined', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  expired: { label: 'Expired', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
};

export default function SavedQuotesList({
  onLoadQuote,
  onDuplicateQuote,
  onCreateNew
}: SavedQuotesListProps) {
  const { content } = useCMS();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<SavedQuote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as SavedQuote[];
      setQuotes(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching quotes:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (quoteId: string, newStatus: QuoteStatus) => {
    try {
      await updateDoc(doc(db, 'quotes', quoteId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to update quote status:', err);
      alert('Could not update status.');
    }
  };

  const handleDownloadPDF = async (qt: SavedQuote) => {
    if (!qt.id) return;
    setDownloadingId(qt.id);
    try {
      const pdfItems = (qt.items || [])
        .filter(i => i.description?.trim() || Number(i.quantity) > 0)
        .map(i => {
          const qty = Number(i.quantity) || 1;
          const uPrice = Number(i.unitPrice) || 0;
          return {
            id: i.id,
            description: i.description,
            quantity: qty,
            unitPrice: uPrice,
            amount: qty * uPrice
          };
        });

      await generateDocumentPDF('quote', {
        docNumber: qt.docNumber,
        date: qt.date,
        validUntil: qt.validUntil,
        clientName: qt.clientName,
        clientEmail: qt.clientEmail,
        clientPhone: qt.clientPhone,
        projectName: qt.projectName,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Design Services Scope',
          quantity: 1,
          unitPrice: qt.subtotal || 0,
          amount: qt.subtotal || 0
        }],
        notes: qt.notes,
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
    if (!quoteToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'quotes', quoteToDelete.id));
      setQuoteToDelete(null);
    } catch (err) {
      console.error('Failed to delete quote:', err);
      alert('Could not delete quotation.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtering
  const filtered = quotes.filter(qt => {
    const term = search.toLowerCase().trim();
    const matchesSearch = !term ||
      qt.docNumber.toLowerCase().includes(term) ||
      qt.clientName.toLowerCase().includes(term) ||
      (qt.projectName && qt.projectName.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' || qt.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Metrics
  const totalQuotesValue = quotes.reduce((acc, q) => acc + (Number(q.subtotal) || 0), 0);
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
  const acceptedValue = acceptedQuotes.reduce((acc, q) => acc + (Number(q.subtotal) || 0), 0);
  const winRate = quotes.length > 0 ? Math.round((acceptedQuotes.length / quotes.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Bar with Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Total Quotations</p>
          <p className="text-xl font-bold text-charcoal mt-1">{quotes.length}</p>
        </div>
        <div className="p-4 bg-cream/40 rounded-2xl border border-charcoal/10">
          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/50">Total Quoted Value</p>
          <p className="text-xl font-bold font-mono text-charcoal mt-1">KES {formatMoney(totalQuotesValue)}</p>
        </div>
        <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Accepted Proposals</p>
          <p className="text-xl font-bold font-mono text-emerald-700 mt-1">KES {formatMoney(acceptedValue)}</p>
        </div>
        <div className="p-4 bg-ochre/10 rounded-2xl border border-ochre/20">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ochre-dark">Acceptance Rate</p>
          <p className="text-xl font-bold text-ochre mt-1">{winRate}%</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-charcoal/10 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by quote number, client name, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-cream/30 border border-charcoal/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-cream/30 border border-charcoal/10 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
          >
            <option value="all">All Statuses ({quotes.length})</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>

          <button
            type="button"
            onClick={onCreateNew}
            className="px-4 py-2 bg-ochre hover:bg-ochre-dark text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm shadow-ochre/20 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* Quote List / Table */}
      {loading ? (
        <div className="p-12 text-center text-charcoal/40 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-charcoal/30" />
          <span>Loading saved quotations archive...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-charcoal/5 flex items-center justify-center mx-auto text-charcoal/30">
            <FileSignature className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-charcoal">
            {search || statusFilter !== 'all' ? 'No quotes match your filter' : 'No saved quotations yet'}
          </h4>
          <p className="text-xs text-charcoal/50 max-w-sm mx-auto">
            {search || statusFilter !== 'all' 
              ? 'Try adjusting your search keywords or status filter.'
              : 'Generate and save your first professional quotation to keep an organized history of estimates and client scopes.'}
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="px-5 py-2.5 bg-ochre text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-ochre-dark transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quotation</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-charcoal/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Quote #</th>
                  <th className="p-3.5">Client & Scope</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Valid Until</th>
                  <th className="p-3.5 text-right">Quoted Amount (KES)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5 text-xs">
                {filtered.map((qt) => {
                  const statusInfo = STATUS_CONFIG[qt.status || 'draft'] || STATUS_CONFIG.draft;
                  const isDownloading = downloadingId === qt.id;

                  return (
                    <tr key={qt.id} className="hover:bg-cream/20 transition-colors">
                      {/* Doc Number */}
                      <td className="p-3.5 pl-5 font-mono font-bold text-charcoal">
                        <div className="flex items-center gap-2">
                          <FileSignature className="w-3.5 h-3.5 text-ochre shrink-0" />
                          <span>{qt.docNumber}</span>
                        </div>
                      </td>

                      {/* Client & Project */}
                      <td className="p-3.5">
                        <div className="font-bold text-charcoal">{qt.clientName}</div>
                        {qt.projectName && (
                          <div className="text-[11px] text-charcoal/50 truncate max-w-xs">
                            {qt.projectName}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-charcoal/60 whitespace-nowrap">
                        {qt.date}
                      </td>

                      {/* Valid Until */}
                      <td className="p-3.5 text-charcoal/60 whitespace-nowrap">
                        {qt.validUntil || '—'}
                      </td>

                      {/* Quoted Amount */}
                      <td className="p-3.5 text-right font-mono font-bold text-ochre-dark text-sm">
                        {formatMoney(qt.subtotal)}
                      </td>

                      {/* Status Dropdown */}
                      <td className="p-3.5 text-center">
                        <select
                          value={qt.status || 'draft'}
                          onChange={(e) => handleStatusChange(qt.id!, e.target.value as QuoteStatus)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer",
                            statusInfo.bg, statusInfo.text, statusInfo.border
                          )}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="accepted">Accepted</option>
                          <option value="declined">Declined</option>
                          <option value="expired">Expired</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPDF(qt)}
                            disabled={isDownloading}
                            title="Download PDF"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-ochre/10 text-charcoal hover:text-ochre transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit / Load into form */}
                          <button
                            type="button"
                            onClick={() => onLoadQuote(qt)}
                            title="Edit Quotation"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-ochre/10 text-charcoal hover:text-ochre transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate */}
                          <button
                            type="button"
                            onClick={() => onDuplicateQuote(qt)}
                            title="Duplicate as New"
                            className="p-2 rounded-lg bg-charcoal/5 hover:bg-charcoal/10 text-charcoal transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setQuoteToDelete(qt)}
                            title="Delete Quotation"
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
      {quoteToDelete && (
        <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-charcoal/10 shadow-2xl space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-charcoal">Delete Quotation?</h3>
              <p className="text-xs text-charcoal/60 mt-1">
                Are you sure you want to permanently delete quotation <span className="font-mono font-bold text-charcoal">{quoteToDelete.docNumber}</span> for <span className="font-bold">{quoteToDelete.clientName}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuoteToDelete(null)}
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
                {isDeleting ? 'Deleting...' : 'Delete Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
