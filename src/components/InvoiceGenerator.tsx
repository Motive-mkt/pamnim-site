import React, { useState } from 'react';
import { Plus, Trash2, Download, FileText, Sparkles, Building2, User, Phone, Mail, DollarSign, Calendar, CheckCircle2 } from 'lucide-react';
import { generateDocumentPDF, PDFLineItem, formatMoney } from '../utils/pdfGenerator';
import { useCMS } from '../hooks/useCMS';

export default function InvoiceGenerator() {
  const { content } = useCMS();

  // Initial auto-generated Invoice ID
  const defaultInvoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const [docNumber, setDocNumber] = useState(defaultInvoiceNumber);
  const [date, setDate] = useState(todayStr);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectName, setProjectName] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState(
    'Payment Terms: 50% deposit upon contract signing, 40% upon interim milestone, 10% upon final handover.\nBank / M-Pesa Details: Pamnim Interior Designers, Paybill: 247247, Acc: 0714984268.'
  );

  const [items, setItems] = useState<PDFLineItem[]>([
    {
      id: '1',
      description: 'Living Room Space Planning & Bespoke Joinery Works',
      quantity: 1,
      unitPrice: 150000
    },
    {
      id: '2',
      description: 'Atmospheric LED Lighting & Electrical Fixtures Supply & Installation',
      quantity: 1,
      unitPrice: 45000
    }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const balanceDue = Math.max(0, subtotal - (Number(amountPaid) || 0));

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof PDFLineItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleQuickTemplate = (title: string, defaultPrice: number) => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: title,
        quantity: 1,
        unitPrice: defaultPrice
      }
    ]);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      alert('Please provide a client name.');
      return;
    }

    try {
      setIsGenerating(true);
      await generateDocumentPDF('invoice', {
        docNumber,
        date,
        clientName,
        clientEmail,
        clientPhone,
        projectName,
        items,
        amountPaid,
        notes,
        companyInfo: {
          name: 'Pamnim Interior Designers',
          address: content.contact?.address || 'Nairobi, Kenya',
          phone: content.contact?.phone || '0714 984 268',
          email: content.contact?.email || 'hinteriors01@gmail.com',
          tagline: 'Shinning outside, beautiful inside'
        }
      });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Invoice generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 border border-charcoal/5 shadow-sm space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-red-600 uppercase tracking-widest mb-1">
            <FileText className="w-4 h-4" />
            <span>Document Studio</span>
          </div>
          <h2 className="text-2xl font-bold text-charcoal">Invoice Generator</h2>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Create and download branded invoices with live line items and balance tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !clientName.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-40 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Invoice Downloaded!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generate Invoice PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="space-y-8">
        {/* Document Meta & Client Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 sm:p-6 bg-cream/40 rounded-2xl border border-charcoal/5">
          {/* Left: Document Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-charcoal flex items-center gap-2">
              <Building2 className="w-4 h-4 text-ochre" />
              <span>Invoice Specifications</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Issue Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Project Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Kilimani 3-Bedroom Full Renovation"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Right: Client Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-charcoal flex items-center gap-2">
              <User className="w-4 h-4 text-ochre" />
              <span>Bill To (Client Information)</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Client Full Name *</label>
              <input
                type="text"
                placeholder="e.g. David Mwangi"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs font-bold focus:outline-none focus:border-red-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Client Phone</label>
                <input
                  type="text"
                  placeholder="0712 345 678"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Client Email</label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Insert Templates */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[11px] font-bold text-charcoal/40 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-ochre" /> Quick Add:
          </span>
          <button
            type="button"
            onClick={() => handleQuickTemplate('Residential Space Planning & 3D Previews', 50000)}
            className="text-[11px] font-medium px-3 py-1.5 bg-cream hover:bg-ochre/10 hover:text-ochre rounded-lg border border-charcoal/5 transition-all shrink-0 cursor-pointer"
          >
            + Space Planning
          </button>
          <button
            type="button"
            onClick={() => handleQuickTemplate('Bespoke Joinery, Wainscoting & Custom Wardrobes', 250000)}
            className="text-[11px] font-medium px-3 py-1.5 bg-cream hover:bg-ochre/10 hover:text-ochre rounded-lg border border-charcoal/5 transition-all shrink-0 cursor-pointer"
          >
            + Bespoke Carpentry
          </button>
          <button
            type="button"
            onClick={() => handleQuickTemplate('Waterproof SPC Flooring Supply & Precision Installation', 180000)}
            className="text-[11px] font-medium px-3 py-1.5 bg-cream hover:bg-ochre/10 hover:text-ochre rounded-lg border border-charcoal/5 transition-all shrink-0 cursor-pointer"
          >
            + SPC Flooring
          </button>
          <button
            type="button"
            onClick={() => handleQuickTemplate('Anti-Glare LED Lighting & Ambient Ceiling Works', 120000)}
            className="text-[11px] font-medium px-3 py-1.5 bg-cream hover:bg-ochre/10 hover:text-ochre rounded-lg border border-charcoal/5 transition-all shrink-0 cursor-pointer"
          >
            + Luxury Lighting
          </button>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-charcoal">Line Items & Services</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1.5 text-xs font-bold text-ochre hover:text-ochre/80 bg-ochre/10 hover:bg-ochre/20 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="border border-charcoal/10 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Desktop Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-3 p-3.5 bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
              <div className="col-span-6">Description / Scope</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit Price (KES)</div>
              <div className="col-span-2 text-right">Total (KES)</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-charcoal/5">
              {items.map((item, idx) => {
                const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                return (
                  <div key={item.id} className="p-3 sm:p-3.5 flex flex-col sm:grid sm:grid-cols-12 gap-3 items-start sm:items-center hover:bg-cream/20 transition-colors">
                    {/* Description */}
                    <div className="w-full sm:col-span-6">
                      <label className="block sm:hidden text-[10px] font-bold uppercase text-charcoal/40 mb-1">Description #{idx + 1}</label>
                      <input
                        type="text"
                        placeholder="Service or item description..."
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        className="w-full p-2.5 bg-cream/30 border border-charcoal/10 rounded-xl text-xs font-medium focus:outline-none focus:border-red-500"
                        required
                      />
                    </div>

                    {/* Qty */}
                    <div className="w-full sm:col-span-2">
                      <label className="block sm:hidden text-[10px] font-bold uppercase text-charcoal/40 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full p-2.5 bg-cream/30 border border-charcoal/10 rounded-xl text-xs font-bold text-center focus:outline-none focus:border-red-500"
                        required
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="w-full sm:col-span-2">
                      <label className="block sm:hidden text-[10px] font-bold uppercase text-charcoal/40 mb-1">Unit Price (KES)</label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full p-2.5 bg-cream/30 border border-charcoal/10 rounded-xl text-xs font-mono font-bold text-right focus:outline-none focus:border-red-500"
                        required
                      />
                    </div>

                    {/* Total & Action */}
                    <div className="w-full sm:col-span-2 flex items-center justify-between sm:justify-end gap-3">
                      <span className="sm:hidden text-xs font-bold text-charcoal/60">Row Total:</span>
                      <span className="text-xs font-mono font-bold text-charcoal">{formatMoney(itemTotal)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length <= 1}
                        className="p-1.5 text-charcoal/30 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-20 transition-all cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Section: Notes on Left, Financial Summary on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-charcoal/5">
          {/* Notes & Payment Instructions */}
          <div className="lg:col-span-7 space-y-2">
            <label className="block text-xs font-bold uppercase text-charcoal/60">Payment Instructions & Notes</label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add bank details, M-Pesa paybill, or milestone terms..."
              className="w-full p-3 bg-cream/30 border border-charcoal/10 rounded-xl text-xs text-charcoal font-mono focus:outline-none focus:border-red-500"
            />
            <p className="text-[10px] text-charcoal/40">These instructions will be printed clearly at the bottom of the invoice PDF.</p>
          </div>

          {/* Financial Summary Card */}
          <div className="lg:col-span-5 p-5 bg-cream/50 rounded-2xl border border-charcoal/10 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal/60 border-b border-charcoal/10 pb-2">
              Invoice Summary
            </h4>

            <div className="flex justify-between items-center text-sm">
              <span className="text-charcoal/60">Subtotal:</span>
              <span className="font-bold font-mono text-charcoal">KES {formatMoney(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <label className="text-charcoal/60">Amount Paid:</label>
              <div className="w-36">
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-charcoal/10 rounded-lg text-xs font-mono font-bold text-right focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-charcoal/10 flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-xl">
              <div>
                <span className="block text-xs font-bold text-red-700 uppercase">Balance Due:</span>
                <span className="text-[10px] text-red-600/70">Payable by client</span>
              </div>
              <span className="text-base font-bold font-mono text-red-700">KES {formatMoney(balanceDue)}</span>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !clientName.trim()}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-md shadow-red-600/20 disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Branded Invoice</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
