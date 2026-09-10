import React, { useState, useEffect, useMemo } from 'react';
import { collection, collectionGroup, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { PaymentReceipt } from '../types/documents';
import { generatePaymentReceiptPDF, formatMoney } from '../utils/pdfGenerator';
import { 
  Receipt, Search, Filter, Download, ArrowUpDown, Calendar, 
  CreditCard, DollarSign, Wallet, Building2, User, RefreshCw, FileText, CheckCircle2 
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function TransactionsManager() {
  const { content } = useCMS();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'month' | 'year'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      let allReceipts: PaymentReceipt[] = [];

      // Try collectionGroup query first
      try {
        const cgQuery = query(collectionGroup(db, 'paymentReceipts'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(cgQuery);
        if (!snap.empty) {
          allReceipts = snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentReceipt));
        }
      } catch (cgErr) {
        console.warn('Collection group query fallback to invoice-level traversal:', cgErr);
      }

      // Fallback or union if collection group was blocked by indexing
      if (allReceipts.length === 0) {
        const invoicesSnap = await getDocs(collection(db, 'invoices'));
        for (const invDoc of invoicesSnap.docs) {
          const invData = invDoc.data();
          const receiptsRef = collection(db, 'invoices', invDoc.id, 'paymentReceipts');
          const recSnap = await getDocs(receiptsRef);
          recSnap.docs.forEach(rDoc => {
            allReceipts.push({
              id: rDoc.id,
              invoiceId: invDoc.id,
              invoiceNumber: invData.docNumber || 'INV',
              clientName: invData.clientName || 'Client',
              clientPhone: invData.clientPhone,
              clientEmail: invData.clientEmail,
              projectName: invData.projectName,
              totalInvoiceAmount: invData.totalInvoiced || 0,
              ...rDoc.data()
            } as unknown as PaymentReceipt);
          });
        }
      }

      // Sort newest first
      allReceipts.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      setReceipts(allReceipts);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const thisMonthStr = todayStr.slice(0, 7); // YYYY-MM
    const thisYearStr = todayStr.slice(0, 4);

    return receipts.filter(r => {
      // Search match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (r.receiptNumber && r.receiptNumber.toLowerCase().includes(q)) ||
        (r.clientName && r.clientName.toLowerCase().includes(q)) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(q)) ||
        (r.referenceNumber && r.referenceNumber.toLowerCase().includes(q)) ||
        (r.reference && r.reference.toLowerCase().includes(q)) ||
        (r.projectName && r.projectName.toLowerCase().includes(q));

      // Method match
      const matchesMethod = selectedMethod === 'all' || 
        (r.paymentMethod && r.paymentMethod.toLowerCase().includes(selectedMethod.toLowerCase()));

      // Time match
      let matchesTime = true;
      const recDate = r.date || r.createdAt;
      if (timeFilter === 'today') {
        matchesTime = recDate.startsWith(todayStr);
      } else if (timeFilter === 'month') {
        matchesTime = recDate.startsWith(thisMonthStr);
      } else if (timeFilter === 'year') {
        matchesTime = recDate.startsWith(thisYearStr);
      }

      return matchesSearch && matchesMethod && matchesTime;
    });
  }, [receipts, searchQuery, selectedMethod, timeFilter]);

  // Statistics
  const totalCollected = useMemo(() => {
    return filteredReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredReceipts]);

  const mpesaTotal = useMemo(() => {
    return filteredReceipts
      .filter(r => r.paymentMethod?.toLowerCase().includes('mpesa') || r.paymentMethod?.toLowerCase().includes('m-pesa'))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredReceipts]);

  const bankTotal = useMemo(() => {
    return filteredReceipts
      .filter(r => r.paymentMethod?.toLowerCase().includes('bank'))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredReceipts]);

  const cashChequeTotal = useMemo(() => {
    return filteredReceipts
      .filter(r => r.paymentMethod?.toLowerCase().includes('cash') || r.paymentMethod?.toLowerCase().includes('cheque'))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredReceipts]);

  const handleDownloadPDF = async (receipt: PaymentReceipt) => {
    try {
      setDownloadingId(receipt.id || receipt.receiptNumber);
      await generatePaymentReceiptPDF({
        receiptNumber: receipt.receiptNumber,
        date: receipt.date || receipt.createdAt,
        invoiceNumber: receipt.invoiceNumber || 'INV',
        clientName: receipt.clientName || 'Client',
        clientEmail: receipt.clientEmail,
        clientPhone: receipt.clientPhone,
        projectName: receipt.projectName,
        amount: Number(receipt.amount) || 0,
        paymentMethod: receipt.paymentMethod || 'Bank / M-Pesa',
        referenceNumber: receipt.referenceNumber || receipt.reference || '—',
        notes: receipt.notes,
        recordedBy: receipt.recordedBy || 'Pamnim Finance',
        totalInvoiceAmount: receipt.totalInvoiceAmount,
        balanceRemaining: receipt.balanceRemaining,
        companyInfo: {
          name: 'Pamnim Interior Designers',
          address: content.contact.address || 'Nairobi, Kenya',
          phone: content.contact.phone || '+254 714 984 268',
          email: content.contact.email || 'hinteriors01@gmail.com'
        }
      });
    } catch (err) {
      console.error('Failed to generate receipt PDF:', err);
      alert('Could not generate receipt PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredReceipts.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = ['Receipt Number', 'Date', 'Client Name', 'Invoice Number', 'Project', 'Method', 'Reference Code', 'Amount (KES)', 'Balance Remaining (KES)', 'Recorded By'];
    const rows = filteredReceipts.map(r => [
      `"${r.receiptNumber}"`,
      `"${r.date}"`,
      `"${r.clientName || ''}"`,
      `"${r.invoiceNumber || ''}"`,
      `"${r.projectName || ''}"`,
      `"${r.paymentMethod || ''}"`,
      `"${r.referenceNumber || r.reference || ''}"`,
      r.amount,
      r.balanceRemaining ?? '',
      `"${r.recordedBy || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pamnim_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-ochre" />
            <span>Customer Payments & Transactions</span>
          </h2>
          <p className="text-xs sm:text-sm text-charcoal/60 mt-1">
            Real-time ledger of all client invoice payments, M-Pesa receipts, bank transfers, and official payment slips.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTransactions}
            className="p-2.5 rounded-xl border border-charcoal/10 bg-white hover:bg-cream text-charcoal transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Refresh Transactions"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-ochre")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-charcoal text-white hover:bg-ochre transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Total Revenue Collected</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-charcoal">
            KES {formatMoney(totalCollected)}
          </div>
          <p className="text-[11px] text-charcoal/40">Across {filteredReceipts.length} recorded payments</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">M-Pesa Collections</span>
            <div className="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center font-bold text-xs">
              M
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-green-700">
            KES {formatMoney(mpesaTotal)}
          </div>
          <p className="text-[11px] text-charcoal/40">Paybill & Buy Goods transactions</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Bank Transfers</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-700">
            KES {formatMoney(bankTotal)}
          </div>
          <p className="text-[11px] text-charcoal/40">RTGS / EFT / Direct deposits</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">Cash & Cheques</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-charcoal">
            KES {formatMoney(cashChequeTotal)}
          </div>
          <p className="text-[11px] text-charcoal/40">Workshop counter & bank cheques</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-charcoal/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search receipt #, client, ref code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-cream/40 border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          {/* Method Filter */}
          <div className="flex items-center gap-1 bg-cream/40 p-1 rounded-xl border border-charcoal/10 text-xs">
            <button
              onClick={() => setSelectedMethod('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                selectedMethod === 'all' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              All
            </button>
            <button
              onClick={() => setSelectedMethod('mpesa')}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                selectedMethod === 'mpesa' ? "bg-white text-emerald-700 shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              M-Pesa
            </button>
            <button
              onClick={() => setSelectedMethod('bank')}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                selectedMethod === 'bank' ? "bg-white text-blue-700 shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              Bank
            </button>
            <button
              onClick={() => setSelectedMethod('cash')}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                selectedMethod === 'cash' ? "bg-white text-amber-700 shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              Cash
            </button>
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-1 bg-cream/40 p-1 rounded-xl border border-charcoal/10 text-xs">
            <button
              onClick={() => setTimeFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                timeFilter === 'all' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                timeFilter === 'month' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              This Month
            </button>
            <button
              onClick={() => setTimeFilter('today')}
              className={cn(
                "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                timeFilter === 'today' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
              )}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-charcoal/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-charcoal/40 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-ochre" />
            <span>Loading transactions archive...</span>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-16 text-center text-charcoal/40 text-xs space-y-2">
            <Receipt className="w-8 h-8 text-charcoal/20 mx-auto" />
            <p className="font-bold text-charcoal/60">No payment transactions match your query.</p>
            <p className="text-[11px]">When clients pay against invoices or projects, receipts automatically appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Receipt #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Client & Contact</th>
                  <th className="p-3.5">Invoice / Project</th>
                  <th className="p-3.5">Method & Ref</th>
                  <th className="p-3.5 text-right">Amount (KES)</th>
                  <th className="p-3.5 text-right">Balance (KES)</th>
                  <th className="p-3.5 pr-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5 text-xs">
                {filteredReceipts.map((rec) => {
                  const isMpesa = rec.paymentMethod?.toLowerCase().includes('mpesa') || rec.paymentMethod?.toLowerCase().includes('m-pesa');
                  const isBank = rec.paymentMethod?.toLowerCase().includes('bank');

                  return (
                    <tr key={rec.id || rec.receiptNumber} className="hover:bg-cream/20 transition-all">
                      {/* Receipt Number */}
                      <td className="p-3.5 pl-5 font-mono font-bold text-charcoal">
                        <span className="bg-cream px-2 py-1 rounded-md border border-charcoal/10">
                          {rec.receiptNumber}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-charcoal/70 whitespace-nowrap">
                        {rec.date ? new Date(rec.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>

                      {/* Client */}
                      <td className="p-3.5">
                        <div className="font-bold text-charcoal">{rec.clientName || 'Client'}</div>
                        {rec.clientPhone && (
                          <div className="text-[11px] text-charcoal/50">{rec.clientPhone}</div>
                        )}
                      </td>

                      {/* Invoice / Project */}
                      <td className="p-3.5">
                        <div className="font-semibold text-charcoal font-mono">{rec.invoiceNumber || 'INV'}</div>
                        {rec.projectName && (
                          <div className="text-[10px] text-ochre font-medium truncate max-w-xs">{rec.projectName}</div>
                        )}
                      </td>

                      {/* Method & Reference */}
                      <td className="p-3.5">
                        <span className={cn(
                          "inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mb-0.5",
                          isMpesa ? "bg-green-100 text-green-800" : isBank ? "bg-blue-100 text-blue-800" : "bg-charcoal/10 text-charcoal"
                        )}>
                          {rec.paymentMethod || 'Payment'}
                        </span>
                        {(rec.referenceNumber || rec.reference) && (rec.referenceNumber || rec.reference) !== '—' && (
                          <div className="font-mono text-[11px] text-charcoal/60 truncate max-w-xs">
                            Ref: {rec.referenceNumber || rec.reference}
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600 text-sm whitespace-nowrap">
                        KES {formatMoney(Number(rec.amount) || 0)}
                      </td>

                      {/* Balance */}
                      <td className="p-3.5 text-right font-mono text-xs whitespace-nowrap">
                        {typeof rec.balanceRemaining === 'number' ? (
                          <span className={rec.balanceRemaining <= 0 ? "text-emerald-700 font-bold" : "text-charcoal/70"}>
                            {rec.balanceRemaining <= 0 ? 'Settled (KES 0.00)' : `KES ${formatMoney(rec.balanceRemaining)}`}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(rec)}
                          disabled={downloadingId === (rec.id || rec.receiptNumber)}
                          className="px-3 py-1.5 rounded-xl bg-charcoal hover:bg-ochre text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          title="Download Official Receipt PDF"
                        >
                          <Download className="w-3 h-3" />
                          <span>{downloadingId === (rec.id || rec.receiptNumber) ? 'PDF...' : 'Receipt PDF'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
