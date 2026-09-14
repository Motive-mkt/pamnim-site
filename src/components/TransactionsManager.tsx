import React, { useState, useEffect, useMemo } from 'react';
import { collection, collectionGroup, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCMS } from '../hooks/useCMS';
import { PaymentReceipt } from '../types/documents';
import { WorkerPayment } from '../types/hrms';
import { generatePaymentReceiptPDF, formatMoney } from '../utils/pdfGenerator';
import { 
  Receipt, Search, Filter, Download, ArrowUpDown, Calendar, 
  CreditCard, DollarSign, Wallet, Building2, User, RefreshCw, FileText, 
  CheckCircle2, ArrowDownLeft, ArrowUpRight, HardHat, TrendingUp, TrendingDown
} from 'lucide-react';
import { cn } from '../lib/utils';

export type TransactionType = 'client_payment' | 'worker_payout' | 'project_expense';
export type TransactionDirection = 'inflow' | 'outflow';

export interface UnifiedTransaction {
  id: string;
  type: TransactionType;
  direction: TransactionDirection; // 'inflow' (+) vs 'outflow' (-)
  date: string; // YYYY-MM-DD or ISO
  amount: number;
  partyName: string; // Client Name, Worker Name, or Vendor / Creator
  partyRole: 'Client' | 'Worker' | 'Site / Vendor';
  projectName?: string;
  projectId?: string;
  paymentMethod: string;
  referenceCode?: string;
  category: string; // e.g. "Invoice Payment", "Labor & Wages", "Materials", etc.
  notes?: string;
  recordedBy?: string;
  receiptData?: PaymentReceipt; // For client payments to generate official receipt PDF
  balanceRemaining?: number;
  docNumber?: string;
  createdAt: string;
}

export default function TransactionsManager() {
  const { content } = useCMS();
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [selectedDirection, setSelectedDirection] = useState<'all' | TransactionDirection>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'month' | 'year'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const unifiedList: UnifiedTransaction[] = [];

      // 1. Fetch Client Payment Receipts (Income / Inflow)
      let allReceipts: PaymentReceipt[] = [];
      try {
        const cgQuery = query(collectionGroup(db, 'paymentReceipts'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(cgQuery);
        if (!snap.empty) {
          allReceipts = snap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentReceipt));
        }
      } catch (cgErr) {
        console.warn('Collection group query fallback to invoice-level traversal:', cgErr);
      }

      // Fallback if collection group was empty or blocked by indexing
      if (allReceipts.length === 0) {
        try {
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
        } catch (invErr) {
          console.warn('Error reading invoice-level receipts:', invErr);
        }
      }

      // Map client receipts to unified transactions
      allReceipts.forEach(r => {
        const dateStr = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
        unifiedList.push({
          id: `receipt_${r.id || r.receiptNumber}`,
          type: 'client_payment',
          direction: 'inflow',
          date: dateStr,
          amount: Number(r.amount) || 0,
          partyName: r.clientName || 'Client',
          partyRole: 'Client',
          projectName: r.projectName || undefined,
          projectId: (r as any).projectId,
          paymentMethod: r.paymentMethod || 'M-Pesa',
          referenceCode: r.referenceNumber || r.reference || r.receiptNumber || '—',
          category: r.invoiceNumber ? `Invoice #${r.invoiceNumber}` : 'Client Payment',
          notes: r.notes || '',
          recordedBy: r.recordedBy || 'Pamnim Finance',
          receiptData: r,
          balanceRemaining: r.balanceRemaining,
          docNumber: r.receiptNumber,
          createdAt: r.createdAt || dateStr
        });
      });

      // 2. Fetch Worker Payments (HRMS Labor Payouts - Outflow)
      const knownWagePayoutKeys = new Set<string>();
      try {
        const wpSnap = await getDocs(collection(db, 'workerPayments'));
        wpSnap.docs.forEach(d => {
          const wp = d.data() as WorkerPayment;
          const dateStr = wp.date || (wp.createdAt ? wp.createdAt.split('T')[0] : '');
          const amt = Number(wp.amount) || 0;

          // Record key to prevent duplicate counting if auto-synced into project expenses
          if (wp.referenceCode) {
            knownWagePayoutKeys.add(wp.referenceCode.trim().toLowerCase());
          }
          if (wp.projectId) {
            knownWagePayoutKeys.add(`${wp.projectId}_${amt}_${dateStr}`);
          }

          unifiedList.push({
            id: `wp_${d.id}`,
            type: 'worker_payout',
            direction: 'outflow',
            date: dateStr,
            amount: amt,
            partyName: wp.workerName || 'Worker',
            partyRole: 'Worker',
            projectName: wp.projectName || undefined,
            projectId: wp.projectId,
            paymentMethod: wp.paymentMethod || 'M-Pesa',
            referenceCode: wp.referenceCode || '—',
            category: 'Labor & Wages',
            notes: wp.notes || '',
            recordedBy: wp.recordedBy || 'Site Admin',
            docNumber: wp.referenceCode || d.id.slice(0, 8),
            createdAt: wp.createdAt || dateStr
          });
        });
      } catch (wpErr) {
        console.warn('Error reading worker payments:', wpErr);
      }

      // 3. Fetch Project Expenses (`projects/{projectId}/expenses`)
      try {
        const projectsSnap = await getDocs(collection(db, 'projects'));
        for (const pDoc of projectsSnap.docs) {
          const pData = pDoc.data();
          const pName = pData.name || pData.title || 'Project';
          
          try {
            const expRef = collection(db, 'projects', pDoc.id, 'expenses');
            const expSnap = await getDocs(expRef);
            
            expSnap.docs.forEach(eDoc => {
              const eData = eDoc.data();
              const amt = Number(eData.amount) || 0;
              
              // Normalize date
              let dateStr = '';
              if (eData.date) {
                if (typeof eData.date === 'string') {
                  dateStr = eData.date.split('T')[0];
                } else if (eData.date.toDate) {
                  dateStr = eData.date.toDate().toISOString().split('T')[0];
                }
              } else if (eData.createdAt) {
                dateStr = typeof eData.createdAt === 'string' 
                  ? eData.createdAt.split('T')[0]
                  : eData.createdAt.toDate ? eData.createdAt.toDate().toISOString().split('T')[0] : '';
              }

              // Deduplicate check: if this expense is already logged from a worker payment
              const refCode = (eData.referenceNumber || eData.reference || '').trim().toLowerCase();
              const wageKey = `${pDoc.id}_${amt}_${dateStr}`;
              if (
                (refCode && knownWagePayoutKeys.has(refCode)) ||
                (eData.category === 'Labor & Wages' && knownWagePayoutKeys.has(wageKey)) ||
                refCode === 'wage-payout'
              ) {
                // Already accounted for in worker payments
                return;
              }

              // Extract vendor / party name
              const partyName = eData.vendor || eData.createdBy || eData.recordedBy || 'Site Vendor';
              const category = eData.category || 'Materials';
              const notes = eData.description || eData.note || '';

              // Payment method mapping
              let method = 'Cash';
              if (eData.method) {
                const m = eData.method.toLowerCase();
                if (m.includes('mpesa') || m.includes('m-pesa')) method = 'M-Pesa';
                else if (m.includes('bank')) method = 'Bank Transfer';
                else if (m.includes('cheque')) method = 'Cheque';
              }

              unifiedList.push({
                id: `exp_${pDoc.id}_${eDoc.id}`,
                type: 'project_expense',
                direction: 'outflow',
                date: dateStr,
                amount: amt,
                partyName,
                partyRole: 'Site / Vendor',
                projectName: pName,
                projectId: pDoc.id,
                paymentMethod: method,
                referenceCode: eData.referenceNumber || eData.reference || '—',
                category,
                notes,
                recordedBy: eData.recordedBy || eData.createdBy || 'Site Team',
                docNumber: eData.referenceNumber || eDoc.id.slice(0, 8),
                createdAt: dateStr
              });
            });
          } catch (pExpErr) {
            console.warn(`Error reading expenses for project ${pDoc.id}:`, pExpErr);
          }
        }
      } catch (projErr) {
        console.warn('Error reading projects for expenses:', projErr);
      }

      // Sort all transactions newest first
      unifiedList.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });

      setTransactions(unifiedList);
    } catch (err) {
      console.error('Error fetching unified transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const thisMonthStr = todayStr.slice(0, 7); // YYYY-MM
    const thisYearStr = todayStr.slice(0, 4);

    return transactions.filter(t => {
      // Type match
      if (selectedType !== 'all' && t.type !== selectedType) {
        return false;
      }

      // Direction match
      if (selectedDirection !== 'all' && t.direction !== selectedDirection) {
        return false;
      }

      // Search match
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches = 
          (t.docNumber && t.docNumber.toLowerCase().includes(q)) ||
          (t.partyName && t.partyName.toLowerCase().includes(q)) ||
          (t.projectName && t.projectName.toLowerCase().includes(q)) ||
          (t.referenceCode && t.referenceCode.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Method match
      if (selectedMethod !== 'all') {
        const m = t.paymentMethod.toLowerCase();
        if (!m.includes(selectedMethod.toLowerCase())) {
          return false;
        }
      }

      // Time match
      if (timeFilter !== 'all' && t.date) {
        if (timeFilter === 'today' && !t.date.startsWith(todayStr)) return false;
        if (timeFilter === 'month' && !t.date.startsWith(thisMonthStr)) return false;
        if (timeFilter === 'year' && !t.date.startsWith(thisYearStr)) return false;
      }

      return true;
    });
  }, [transactions, selectedType, selectedDirection, searchQuery, selectedMethod, timeFilter]);

  // Financial Statistics
  const stats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let mpesaInflow = 0;
    let bankInflow = 0;
    let laborOutflow = 0;
    let siteExpenseOutflow = 0;

    filteredTransactions.forEach(t => {
      if (t.direction === 'inflow') {
        inflow += t.amount;
        const m = t.paymentMethod.toLowerCase();
        if (m.includes('mpesa') || m.includes('m-pesa')) mpesaInflow += t.amount;
        else if (m.includes('bank')) bankInflow += t.amount;
      } else {
        outflow += t.amount;
        if (t.type === 'worker_payout') laborOutflow += t.amount;
        else siteExpenseOutflow += t.amount;
      }
    });

    const netCash = inflow - outflow;
    return {
      inflow,
      outflow,
      netCash,
      mpesaInflow,
      bankInflow,
      laborOutflow,
      siteExpenseOutflow
    };
  }, [filteredTransactions]);

  // Counts by Type
  const counts = useMemo(() => {
    const all = transactions.length;
    const clientPayments = transactions.filter(t => t.type === 'client_payment').length;
    const workerPayouts = transactions.filter(t => t.type === 'worker_payout').length;
    const siteExpenses = transactions.filter(t => t.type === 'project_expense').length;
    return { all, clientPayments, workerPayouts, siteExpenses };
  }, [transactions]);

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
          address: content.contact?.address || 'Nairobi, Kenya',
          phone: content.contact?.phone || '+254 714 984 268',
          email: content.contact?.email || 'hinteriors01@gmail.com'
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
    if (filteredTransactions.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = [
      'Date', 
      'Type', 
      'Direction', 
      'Party Name', 
      'Party Role', 
      'Project', 
      'Category', 
      'Payment Method', 
      'Reference Code', 
      'Amount (KES)', 
      'Net Impact (KES)', 
      'Notes', 
      'Recorded By'
    ];

    const rows = filteredTransactions.map(t => [
      `"${t.date}"`,
      `"${t.type === 'client_payment' ? 'Client Payment' : t.type === 'worker_payout' ? 'Worker Wage Payout' : 'Site Expense'}"`,
      `"${t.direction === 'inflow' ? 'INFLOW (+)' : 'OUTFLOW (-)'}"`,
      `"${t.partyName}"`,
      `"${t.partyRole}"`,
      `"${t.projectName || '—'}"`,
      `"${t.category}"`,
      `"${t.paymentMethod}"`,
      `"${t.referenceCode || '—'}"`,
      t.amount,
      t.direction === 'inflow' ? t.amount : -t.amount,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      `"${t.recordedBy || '—'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pamnim_Unified_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span>Unified Transactions & Cash Ledger</span>
          </h2>
          <p className="text-xs sm:text-sm text-charcoal/60 mt-1">
            Consolidated real-time ledger merging customer invoice payments, worker wage payouts, and project site expenses.
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
        {/* Total Inflow (Revenue) */}
        <div className="p-5 rounded-2xl bg-white border border-emerald-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Total Inflow (Income)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
            KES {formatMoney(stats.inflow)}
          </div>
          <p className="text-[11px] text-charcoal/50">
            Client invoice payments & receipts
          </p>
        </div>

        {/* Total Outflow (Expenses + Wages) */}
        <div className="p-5 rounded-2xl bg-white border border-rose-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Total Outflow (Expenses)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-700">
            KES {formatMoney(stats.outflow)}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-charcoal/50">
            <span>Labor: KES {formatMoney(stats.laborOutflow)}</span>
            <span>•</span>
            <span>Site: KES {formatMoney(stats.siteExpenseOutflow)}</span>
          </div>
        </div>

        {/* Net Cash Position */}
        <div className={cn(
          "p-5 rounded-2xl border shadow-sm space-y-2",
          stats.netCash >= 0 ? "bg-emerald-50/40 border-emerald-300" : "bg-red-50/40 border-red-300"
        )}>
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              stats.netCash >= 0 ? "text-emerald-900" : "text-red-900"
            )}>
              Net Cash Position
            </span>
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              stats.netCash >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            )}>
              {stats.netCash >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className={cn(
            "text-xl sm:text-2xl font-black font-mono",
            stats.netCash >= 0 ? "text-emerald-800" : "text-red-700"
          )}>
            {stats.netCash >= 0 ? `+KES ${formatMoney(stats.netCash)}` : `-KES ${formatMoney(Math.abs(stats.netCash))}`}
          </div>
          <p className="text-[11px] text-charcoal/60">
            Inflow minus Outflow across all records
          </p>
        </div>

        {/* M-Pesa Collections */}
        <div className="p-5 rounded-2xl bg-white border border-charcoal/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal/50">M-Pesa Inflow</span>
            <div className="w-8 h-8 rounded-xl bg-green-50 text-green-700 flex items-center justify-center font-bold text-xs">
              M
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-green-700">
            KES {formatMoney(stats.mpesaInflow)}
          </div>
          <p className="text-[11px] text-charcoal/40">Bank Inflow: KES {formatMoney(stats.bankInflow)}</p>
        </div>
      </div>

      {/* Transaction Type Tabs & Filters */}
      <div className="space-y-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-charcoal/10 pb-3">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              selectedType === 'all' 
                ? "bg-charcoal text-white shadow-xs" 
                : "bg-cream/60 text-charcoal/70 hover:bg-cream hover:text-charcoal"
            )}
          >
            All Transactions ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('client_payment')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              selectedType === 'client_payment' 
                ? "bg-emerald-700 text-white shadow-xs" 
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            )}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Client Payments ({counts.clientPayments})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('worker_payout')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              selectedType === 'worker_payout' 
                ? "bg-amber-700 text-white shadow-xs" 
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            )}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>Worker Wages ({counts.workerPayouts})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('project_expense')}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              selectedType === 'project_expense' 
                ? "bg-purple-700 text-white shadow-xs" 
                : "bg-purple-50 text-purple-800 hover:bg-purple-100"
            )}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Project Site Expenses ({counts.siteExpenses})</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-charcoal/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search receipt #, name, project, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-cream/40 border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre focus:bg-white"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
            {/* Direction Filter */}
            <div className="flex items-center gap-1 bg-cream/40 p-1 rounded-xl border border-charcoal/10 text-xs">
              <button
                onClick={() => setSelectedDirection('all')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  selectedDirection === 'all' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                In / Out
              </button>
              <button
                onClick={() => setSelectedDirection('inflow')}
                className={cn(
                  "px-2 py-1 rounded-lg font-bold transition-all cursor-pointer text-emerald-700",
                  selectedDirection === 'inflow' ? "bg-white shadow-xs" : "hover:text-emerald-800"
                )}
              >
                + Inflow
              </button>
              <button
                onClick={() => setSelectedDirection('outflow')}
                className={cn(
                  "px-2 py-1 rounded-lg font-bold transition-all cursor-pointer text-rose-700",
                  selectedDirection === 'outflow' ? "bg-white shadow-xs" : "hover:text-rose-800"
                )}
              >
                - Outflow
              </button>
            </div>

            {/* Method Filter */}
            <div className="flex items-center gap-1 bg-cream/40 p-1 rounded-xl border border-charcoal/10 text-xs">
              <button
                onClick={() => setSelectedMethod('all')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                  selectedMethod === 'all' ? "bg-white text-charcoal shadow-xs" : "text-charcoal/60 hover:text-charcoal"
                )}
              >
                All Methods
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
                Month
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
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-charcoal/10 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-charcoal/40 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-ochre" />
            <span>Loading unified financial ledger...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-16 text-center text-charcoal/40 text-xs space-y-2">
            <Receipt className="w-8 h-8 text-charcoal/20 mx-auto" />
            <p className="font-bold text-charcoal/60">No financial transactions match your query.</p>
            <p className="text-[11px]">When client payments, worker payouts, or site expenses are logged, they reflect here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Type & Ref</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Party & Project</th>
                  <th className="p-3.5">Category & Method</th>
                  <th className="p-3.5">Reference Code</th>
                  <th className="p-3.5 text-right">Amount (KES)</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5 text-xs">
                {filteredTransactions.map((t) => {
                  const isInflow = t.direction === 'inflow';
                  const isMpesa = t.paymentMethod?.toLowerCase().includes('mpesa') || t.paymentMethod?.toLowerCase().includes('m-pesa');
                  const isBank = t.paymentMethod?.toLowerCase().includes('bank');

                  return (
                    <tr key={t.id} className="hover:bg-cream/20 transition-all">
                      {/* Type & Direction & DocNumber */}
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold",
                            isInflow ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          )}>
                            {isInflow ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block",
                              t.type === 'client_payment' ? "bg-emerald-100 text-emerald-800" :
                              t.type === 'worker_payout' ? "bg-amber-100 text-amber-800" :
                              "bg-purple-100 text-purple-800"
                            )}>
                              {t.type === 'client_payment' ? 'Client Payment' :
                               t.type === 'worker_payout' ? 'Worker Wage' :
                               'Site Expense'}
                            </span>
                            {t.docNumber && (
                              <div className="font-mono text-[10px] text-charcoal/50 mt-0.5">
                                {t.docNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-charcoal/70 whitespace-nowrap">
                        {t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>

                      {/* Party & Project */}
                      <td className="p-3.5">
                        <div className="font-bold text-charcoal flex items-center gap-1.5">
                          <span>{t.partyName}</span>
                          <span className="text-[10px] text-charcoal/40 font-normal">({t.partyRole})</span>
                        </div>
                        {t.projectName ? (
                          <div className="text-[11px] text-ochre font-medium truncate max-w-xs">{t.projectName}</div>
                        ) : (
                          <div className="text-[10px] text-charcoal/40">General Workshop</div>
                        )}
                      </td>

                      {/* Category & Method */}
                      <td className="p-3.5">
                        <div className="font-semibold text-charcoal">{t.category}</div>
                        <span className={cn(
                          "inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-0.5",
                          isMpesa ? "bg-green-100 text-green-800" : isBank ? "bg-blue-100 text-blue-800" : "bg-charcoal/10 text-charcoal"
                        )}>
                          {t.paymentMethod || 'Payment'}
                        </span>
                      </td>

                      {/* Reference Code */}
                      <td className="p-3.5 font-mono text-[11px] text-charcoal/70 whitespace-nowrap">
                        {t.referenceCode && t.referenceCode !== '—' ? (
                          <span className="bg-cream/60 px-2 py-0.5 rounded border border-charcoal/10 font-bold">
                            {t.referenceCode}
                          </span>
                        ) : (
                          <span className="text-charcoal/30">—</span>
                        )}
                      </td>

                      {/* Amount (KES) with Inflow (+) / Outflow (-) color styling */}
                      <td className="p-3.5 text-right font-mono font-bold whitespace-nowrap">
                        <span className={cn(
                          "text-sm font-black",
                          isInflow ? "text-emerald-700" : "text-rose-600"
                        )}>
                          {isInflow ? '+' : '−'} KES {formatMoney(t.amount)}
                        </span>
                        {typeof t.balanceRemaining === 'number' && (
                          <div className="text-[10px] text-charcoal/40 font-normal">
                            Rem: KES {formatMoney(t.balanceRemaining)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                        {t.receiptData ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadPDF(t.receiptData!)}
                            disabled={downloadingId === (t.receiptData.id || t.receiptData.receiptNumber)}
                            className="px-3 py-1.5 rounded-xl bg-charcoal hover:bg-ochre text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                            title="Download Official Receipt PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>{downloadingId === (t.receiptData.id || t.receiptData.receiptNumber) ? 'PDF...' : 'Receipt PDF'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-charcoal/40 italic">
                            {t.notes ? (
                              <span title={t.notes} className="cursor-help underline decoration-dotted">
                                {t.notes.length > 20 ? t.notes.slice(0, 20) + '...' : t.notes}
                              </span>
                            ) : (
                              'Logged'
                            )}
                          </span>
                        )}
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
