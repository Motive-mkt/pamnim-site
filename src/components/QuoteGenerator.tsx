import React, { useState, useEffect } from 'react';
import { 
  collection, query, getDocs, where, onSnapshot, orderBy, doc, addDoc, updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Plus, Trash2, Download, FileSignature, Sparkles, Building2, User, Phone, Mail, 
  DollarSign, Calendar, CheckCircle2, Layers, AlertCircle, TrendingUp, Info, Eye,
  Save, History, X
} from 'lucide-react';
import { generateDocumentPDF, PDFLineItem, formatMoney } from '../utils/pdfGenerator';
import { useCMS } from '../hooks/useCMS';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import CatalogManagerModal from './CatalogManagerModal';
import CatalogAutocomplete from './CatalogAutocomplete';
import SavedQuotesList from './SavedQuotesList';
import { CatalogItem } from '../types/catalog';
import { SavedQuote, QuoteStatus } from '../types/documents';

export interface QuoteLineItem {
  id: string;
  description: string;
  category?: string;
  unit?: string;
  quantity: number | '';
  unitPrice: number | ''; // Selling Price charged to client
  purchasePrice?: number; // Internal cost to derive margin
}

export default function QuoteGenerator() {
  const { content } = useCMS();
  const { profile } = useAuth();

  // Initial auto-generated Quote ID and dates
  const defaultQuoteNumber = `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 30 days validity default
  const validUntilDefault = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Document Metadata
  const [docNumber, setDocNumber] = useState(defaultQuoteNumber);
  const [date, setDate] = useState(todayStr);
  const [validUntil, setValidUntil] = useState(validUntilDefault);

  // Client Selection
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCustomClient, setIsCustomClient] = useState<boolean>(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectName, setProjectName] = useState('');

  // Quotation Terms & Disclaimer (Powered by CMS Settings)
  const defaultPaymentDetails = content.contact.paymentDetails || 'Bank / M-Pesa Details: Pamnim Interior Designers, Paybill: 247247, Acc: 0714984268.';
  const [notes, setNotes] = useState(
    `This quotation is an estimate valid for 30 days and is subject to final site inspection, scope adjustments, and material availability.\nAll prices include spatial design planning, premium materials supply, and professional installation by Pamnim Interior Designers.\n${defaultPaymentDetails}`
  );

  useEffect(() => {
    if (content.contact.paymentDetails) {
      setNotes(prev => {
        if (!prev || prev.includes('Paybill: 247247, Acc: 0714984268.')) {
          return `This quotation is an estimate valid for 30 days and is subject to final site inspection, scope adjustments, and material availability.\nAll prices include spatial design planning, premium materials supply, and professional installation by Pamnim Interior Designers.\n${content.contact.paymentDetails}`;
        }
        return prev;
      });
    }
  }, [content.contact.paymentDetails]);

  // Quote Line Items: Blank by default (no placeholder pre-filled mock items)
  const [items, setItems] = useState<QuoteLineItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      unitPrice: '',
      purchasePrice: 0
    }
  ]);

  // Catalog State
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [activeItemIndexForCatalog, setActiveItemIndexForCatalog] = useState<number | null>(null);

  // UI Status
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Archive & Edit State
  const [activeView, setActiveView] = useState<'generator' | 'archive'>('generator');
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // 1. Fetch Clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const q = query(collection(db, 'profiles'), where('role', '==', 'client'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setClientsList(list);
      } catch (err) {
        console.error('Error fetching clients for quote:', err);
      }
    };
    fetchClients();
  }, []);

  // 2. Fetch Catalog Items in Real-Time
  useEffect(() => {
    const q = query(collection(db, 'servicesMaterials'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setCatalogItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CatalogItem[]);
    }, (err) => console.error('Error fetching catalog:', err));
    return () => unsub();
  }, []);

  // Handle client dropdown selection
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId === 'NEW_CLIENT') {
      setIsCustomClient(true);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
    } else if (clientId === '') {
      setIsCustomClient(false);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
    } else {
      setIsCustomClient(false);
      const found = clientsList.find(c => c.id === clientId || c.uid === clientId);
      if (found) {
        setClientName(found.name || found.displayName || '');
        setClientEmail(found.email || '');
        setClientPhone(found.phone || found.phoneNumber || '');
      }
    }
  };

  // Calculations
  const totalEstimate = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + (qty * price);
  }, 0);

  // Internal Margin Derivations (Owner-only preview)
  const totalEstimatedCost = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.purchasePrice) || 0;
    return sum + (qty * cost);
  }, 0);

  const estimatedProfit = totalEstimate - totalEstimatedCost;
  const marginPercentage = totalEstimate > 0 
    ? ((estimatedProfit / totalEstimate) * 100).toFixed(1)
    : '0.0';

  // Item Handlers
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: '',
        purchasePrice: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setItems([{
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: '',
        purchasePrice: 0
      }]);
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof QuoteLineItem, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleCatalogSelect = (catalogItem: CatalogItem) => {
    if (activeItemIndexForCatalog !== null && items[activeItemIndexForCatalog]) {
      const targetId = items[activeItemIndexForCatalog].id;
      handleLineItemCatalogSelect(targetId, catalogItem);
    }
    setActiveItemIndexForCatalog(null);
  };

  const handleLineItemCatalogSelect = (itemId: string, catalogItem: CatalogItem) => {
    setItems(items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          description: catalogItem.description 
            ? `${catalogItem.name} — ${catalogItem.description}`
            : catalogItem.name,
          category: catalogItem.category,
          unit: catalogItem.unit,
          unitPrice: catalogItem.sellingPrice,
          purchasePrice: catalogItem.purchasePrice || 0,
          quantity: item.quantity || 1
        };
      }
      return item;
    }));
  };

  const handleCreateNew = () => {
    setEditingQuoteId(null);
    setDocNumber(`QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(todayStr);
    setValidUntil(validUntilDefault);
    setSelectedClientId('');
    setIsCustomClient(false);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setProjectName('');
    setItems([{ id: '1', description: '', quantity: 1, unitPrice: '', purchasePrice: 0 }]);
    setActiveView('generator');
  };

  const handleLoadQuote = (qt: SavedQuote) => {
    setEditingQuoteId(qt.id || null);
    setDocNumber(qt.docNumber || `QT-${new Date().getFullYear()}-001`);
    setDate(qt.date || todayStr);
    setValidUntil(qt.validUntil || validUntilDefault);
    setSelectedClientId(qt.clientId || '');
    setIsCustomClient(!qt.clientId);
    setClientName(qt.clientName || '');
    setClientEmail(qt.clientEmail || '');
    setClientPhone(qt.clientPhone || '');
    setProjectName(qt.projectName || '');
    setNotes(qt.notes || defaultPaymentDetails);
    if (qt.items && qt.items.length > 0) {
      setItems(qt.items);
    } else {
      setItems([{ id: '1', description: '', quantity: 1, unitPrice: '', purchasePrice: 0 }]);
    }
    setActiveView('generator');
  };

  const handleDuplicateQuote = (qt: SavedQuote) => {
    setEditingQuoteId(null);
    setDocNumber(`QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(todayStr);
    setValidUntil(validUntilDefault);
    setSelectedClientId(qt.clientId || '');
    setIsCustomClient(!qt.clientId);
    setClientName(qt.clientName || '');
    setClientEmail(qt.clientEmail || '');
    setClientPhone(qt.clientPhone || '');
    setProjectName(qt.projectName || '');
    setNotes(qt.notes || defaultPaymentDetails);
    if (qt.items && qt.items.length > 0) {
      setItems(qt.items.map(i => ({ ...i, id: Math.random().toString() })));
    }
    setActiveView('generator');
  };

  const saveQuoteToFirestore = async (customStatus?: QuoteStatus): Promise<string | null> => {
    if (!clientName.trim()) {
      alert('Please provide a client name before saving.');
      return null;
    }

    try {
      setIsSavingDraft(true);
      const quoteData: Omit<SavedQuote, 'id'> = {
        docNumber,
        date,
        validUntil,
        clientId: selectedClientId || undefined,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        projectName: projectName.trim() || undefined,
        items,
        subtotal: totalEstimate,
        notes,
        status: customStatus || 'sent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: profile?.name || 'Owner'
      };

      if (editingQuoteId) {
        await updateDoc(doc(db, 'quotes', editingQuoteId), {
          ...quoteData,
          updatedAt: new Date().toISOString()
        });
        setSaveSuccessMessage(`Quotation ${docNumber} updated in archive!`);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        return editingQuoteId;
      } else {
        const docRef = await addDoc(collection(db, 'quotes'), quoteData);
        setEditingQuoteId(docRef.id);
        setSaveSuccessMessage(`Quotation ${docNumber} saved to archive!`);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        return docRef.id;
      }
    } catch (err) {
      console.error('Error saving quotation to Firestore:', err);
      alert('Failed to save quotation to archive.');
      return null;
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!clientName.trim()) {
      alert('Please provide a client name.');
      return;
    }

    try {
      setIsGenerating(true);

      // Auto-save to quotes collection
      await saveQuoteToFirestore();

      const pdfItems: PDFLineItem[] = items
        .filter(i => i.description.trim() || Number(i.unitPrice) > 0)
        .map(i => ({
          id: i.id,
          description: i.description || 'Estimated Service Item',
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice) || 0
        }));

      await generateDocumentPDF('quote', {
        docNumber,
        date,
        validUntil,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        projectName: projectName.trim() || undefined,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Consultation & Spatial Planning Estimate',
          quantity: 1,
          unitPrice: 0
        }],
        notes,
        currencySymbol: 'KES',
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
      console.error('Quote generation failed:', err);
      alert('Failed to generate PDF quotation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 border border-charcoal/5 shadow-sm space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-ochre uppercase tracking-widest mb-1">
            <FileSignature className="w-4 h-4" />
            <span>Document Studio</span>
          </div>
          <h2 className="text-2xl font-bold text-charcoal">Quotation Management</h2>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Generate bespoke price estimates with automated catalog pricing, internal margins, and saved quote archive.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-cream/50 p-1.5 rounded-2xl border border-charcoal/10">
          <button
            type="button"
            onClick={() => setActiveView('generator')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === 'generator'
                ? "bg-white text-charcoal shadow-sm"
                : "text-charcoal/60 hover:text-charcoal"
            )}
          >
            <FileSignature className="w-3.5 h-3.5 text-ochre" />
            <span>{editingQuoteId ? 'Edit Quotation' : 'New Quotation'}</span>
            {editingQuoteId && (
              <span className="text-[10px] px-1.5 py-0.5 bg-ochre/10 text-ochre-dark rounded-md font-mono">
                {docNumber}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('archive')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === 'archive'
                ? "bg-white text-charcoal shadow-sm"
                : "text-charcoal/60 hover:text-charcoal"
            )}
          >
            <History className="w-3.5 h-3.5 text-ochre" />
            <span>Saved Quotes</span>
          </button>
        </div>
      </div>

      {/* Editing Saved Quote Notice Bar */}
      {activeView === 'generator' && editingQuoteId && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Currently editing archived quote <strong className="font-mono">{docNumber}</strong> for <strong>{clientName || 'Client'}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleCreateNew}
            className="text-xs font-bold text-amber-900 hover:text-black underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Switch to Blank Quote</span>
          </button>
        </div>
      )}

      {/* Success Notification Banners */}
      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Conditional View: Archive vs Generator Form */}
      {activeView === 'archive' ? (
        <SavedQuotesList
          onLoadQuote={handleLoadQuote}
          onDuplicateQuote={handleDuplicateQuote}
          onCreateNew={handleCreateNew}
        />
      ) : (
      <form onSubmit={handleGenerate} className="space-y-8">
        {/* Document Meta & Client Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-6 bg-cream/40 rounded-2xl border border-charcoal/5">
          {/* Left: Document Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal/70 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-ochre" />
              <span>Quotation Details</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Quote Number</label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-ochre"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Project Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Karen Villa Master Suite Renovation"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
              />
            </div>
          </div>

          {/* Right: Client Information with Dropdown + Free Text */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal/70 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-ochre" />
              <span>Client Information</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Select Client *</label>
              <select
                value={isCustomClient ? 'NEW_CLIENT' : selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre"
              >
                <option value="">-- Choose Existing Client --</option>
                {clientsList.map((c) => (
                  <option key={c.id || c.uid} value={c.id || c.uid}>
                    {c.name || c.displayName || c.email} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
                <option value="NEW_CLIENT">+ New client (Enter details manually)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Client Full Name *</label>
              <input
                type="text"
                required
                placeholder="Client full name"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  if (!isCustomClient && selectedClientId) {
                    setIsCustomClient(true);
                  }
                }}
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-bold focus:outline-none focus:border-ochre"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-charcoal/50 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="client@email.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-charcoal/50 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+254 7..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quote Line Items */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-charcoal flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-ochre" />
                <span>Quotation Scope & Line Items</span>
              </h3>
              <p className="text-xs text-charcoal/50">
                Add services or materials from your catalog or enter custom specifications.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveItemIndexForCatalog(items.length - 1);
                  setIsCatalogOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ochre/10 text-ochre hover:bg-ochre hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Add from Catalog</span>
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 bg-charcoal hover:bg-charcoal/80 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Blank Row</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-charcoal/10 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-3.5 pl-4">Description / Scope</th>
                    <th className="p-3.5 w-28 text-center">Quantity</th>
                    <th className="p-3.5 w-44 text-right">Unit Price (KES)</th>
                    <th className="p-3.5 w-44 text-right">Total (KES)</th>
                    <th className="p-3.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5 text-xs">
                  {items.map((item, index) => {
                    const rowTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                    const rowCost = (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0);
                    const rowProfit = rowTotal - rowCost;

                    return (
                      <tr key={item.id} className="hover:bg-cream/20 transition-all">
                        {/* Description with quick Catalog picker */}
                        <td className="p-3 pl-4">
                          <div className="space-y-1">
                            <CatalogAutocomplete
                              value={item.description}
                              onChange={(val) => handleUpdateItem(item.id, 'description', val)}
                              onSelectCatalogItem={(catItem) => handleLineItemCatalogSelect(item.id, catItem)}
                              catalogItems={catalogItems}
                              placeholder="e.g. Smart Space Planning & 3D Photorealistic Previews"
                              onOpenCatalogModal={() => {
                                setActiveItemIndexForCatalog(index);
                                setIsCatalogOpen(true);
                              }}
                            />
                            {item.purchasePrice !== undefined && item.purchasePrice > 0 && (
                              <span className="text-[10px] text-emerald-600 font-medium pl-1 block">
                                Cost: KES {formatMoney(item.purchasePrice)}/unit • Est. Profit: +KES {formatMoney(rowProfit)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value ? parseFloat(e.target.value) : '')}
                            className="w-full p-2 bg-transparent border border-charcoal/10 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-ochre text-center"
                          />
                        </td>

                        {/* Unit Price (Selling Price) */}
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            placeholder="0"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value ? parseFloat(e.target.value) : '')}
                            className="w-full p-2 bg-transparent border border-charcoal/10 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-ochre text-right"
                          />
                        </td>

                        {/* Row Total */}
                        <td className="p-3 text-right font-mono font-bold text-charcoal">
                          KES {formatMoney(rowTotal)}
                        </td>

                        {/* Delete Row */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-charcoal/30 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Terms & Internal Margin Summary */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 p-6 bg-cream/30 rounded-2xl border border-charcoal/10">
          {/* Quotation Terms & Disclaimer (Kept as editable default) */}
          <div className="w-full md:w-1/2 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
              Quotation Terms & Disclaimer
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs text-charcoal/80 focus:outline-none focus:border-ochre leading-relaxed font-sans"
            />
            <p className="text-[10px] text-charcoal/50">
              This text appears on the client-facing PDF quote.
            </p>
          </div>

          {/* Estimate Total & Internal Margin derivations */}
          <div className="w-full md:w-80 space-y-4 bg-white p-5 rounded-2xl border border-charcoal/10 shadow-sm shrink-0">
            {/* Client-Facing Quote Total */}
            <div className="p-4 bg-ochre/10 rounded-xl border border-ochre/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ochre-dark block">
                Total Quotation Estimate
              </span>
              <span className="font-mono font-black text-xl text-charcoal mt-1 block">
                KES {formatMoney(totalEstimate)}
              </span>
            </div>

            {/* Internal Margin Derived Preview (Owner Only - Not shown on client PDF) */}
            <div className="p-3.5 bg-cream/50 rounded-xl border border-charcoal/10 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-charcoal/60">
                <Eye className="w-3 h-3 text-ochre" />
                <span>Internal Margin (Owner Eyes Only)</span>
              </div>

              {totalEstimatedCost > 0 ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-charcoal/60">
                    <span>Est. Material/Labor Cost:</span>
                    <span className="font-mono font-medium">KES {formatMoney(totalEstimatedCost)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 pt-1 border-t border-charcoal/5">
                    <span>Est. Gross Profit:</span>
                    <span className="font-mono">+KES {formatMoney(estimatedProfit)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-emerald-600 font-semibold">
                    <span>Profit Margin:</span>
                    <span>{marginPercentage}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-charcoal/40 italic">
                  Select items from the catalog with purchase costs to see internal profit margins.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-charcoal/5">
          <button
            type="button"
            onClick={() => saveQuoteToFirestore()}
            disabled={isSavingDraft || !clientName.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-charcoal text-white hover:bg-charcoal/90 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 cursor-pointer"
          >
            <Save className="w-4 h-4 text-ochre" />
            <span>{isSavingDraft ? 'Saving to Archive...' : editingQuoteId ? 'Update in Archive' : 'Save to Archive'}</span>
          </button>

          <button
            type="submit"
            disabled={isGenerating || !clientName.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ochre hover:bg-ochre-dark text-white text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-ochre/20 disabled:opacity-40 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating Quote PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Official Quote</span>
              </>
            )}
          </button>
        </div>
      </form>
      )}

      {/* Catalog Manager Modal */}
      <CatalogManagerModal
        isOpen={isCatalogOpen}
        onClose={() => {
          setIsCatalogOpen(false);
          setActiveItemIndexForCatalog(null);
        }}
        onSelectItem={handleCatalogSelect}
      />
    </div>
  );
}
