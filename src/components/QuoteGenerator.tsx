import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, query, getDocs, where, onSnapshot, orderBy, doc, addDoc, updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Plus, Trash2, FileSignature, Building2, User, Phone, Mail, DollarSign, Calendar, CheckCircle2, Layers, AlertCircle, TrendingUp, Info, Eye, History, X, Share2, Percent } from 'lucide-react';
import { generateDocumentPDF, shareDocumentPDF, formatMoney } from '../utils/pdfGenerator';
import { quoteToPDFData } from '../utils/documentPdfData';
import { persistKraPin } from '../utils/kraPinStore';
import { useCMS } from '../hooks/useCMS';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import CatalogManagerModal from './CatalogManagerModal';
import CatalogAutocomplete from './CatalogAutocomplete';
import SavedQuotesList from './SavedQuotesList';
import { CatalogItem } from '../types/catalog';
import { SavedQuote, QuoteStatus } from '../types/documents';
import { ItemTax, computeTotals, lineTaxAmount, resolveTaxes } from '../lib/tax';
import { useDocumentSettings, DEFAULT_QUOTE_TERMS } from '../lib/documentSettings';
import { subscribeToSavedPaymentDetails, SavedPaymentDetail } from '../services/paymentDetailsService';
import TermsEditor from './TermsEditor';
import ItemTaxPicker from './ItemTaxPicker';
import TaxSettingsModal from './TaxSettingsModal';
import PaymentDetailsSection from './PaymentDetailsSection';
import KraPinInput from './KraPinInput';

export interface QuoteLineItem {
  id: string;
  description: string;
  category?: string;
  unit?: string;
  quantity: number | '';
  unitPrice: number | ''; // Selling Price charged to client
  purchasePrice?: number; // Internal cost to derive margin
  taxes?: ItemTax[]; // undefined = follow the current default taxes
}

const newLineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const blankLine = (): QuoteLineItem => ({
  id: newLineId(),
  description: '',
  quantity: 1,
  unitPrice: '',
  purchasePrice: 0
});

const isBlankLine = (i: QuoteLineItem) => !i.description.trim() && !(Number(i.unitPrice) > 0);

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
  const [clientKraPin, setClientKraPin] = useState('');
  const [projectName, setProjectName] = useState('');

  // Saved settings: tax types, own KRA PIN, default terms and default payment details
  const { settings, loaded: settingsLoaded, save: saveSettings, defaultTaxes } = useDocumentSettings();
  const [taxModalOpen, setTaxModalOpen] = useState(false);

  // Payment details: site settings are the fallback when no saved default exists
  const getCompiledPaymentDetails = () => {
    const methods = content?.contact?.paymentDetailsByMethod || {};
    const parts = [methods.bank, methods.mpesa, methods.cash].filter(Boolean);
    if (parts.length > 0) return parts.join('\n\n');
    return content.contact.paymentDetails || 'Bank / M-Pesa Details: Pamnim Interior Designers, Paybill: 247247, Acc: 0714984268.';
  };

  const [terms, setTerms] = useState<string[]>(DEFAULT_QUOTE_TERMS);
  const [paymentDetails, setPaymentDetails] = useState<string>(() => getCompiledPaymentDetails());
  const [notes, setNotes] = useState(''); // optional additional notes (older quotes keep their combined text here)
  const [savedPaymentEntries, setSavedPaymentEntries] = useState<SavedPaymentDetail[]>([]);

  // A fresh quote picks up the saved defaults once; a loaded/edited quote never gets overwritten.
  const defaultsApplied = useRef(false);
  const paymentEdited = useRef(false);

  useEffect(() => {
    if (!settingsLoaded || defaultsApplied.current) return;
    defaultsApplied.current = true;
    setTerms([...settings.quoteTerms]);
    if (settings.quotePaymentDetails) setPaymentDetails(settings.quotePaymentDetails);
  }, [settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Site payment settings can arrive after first render; follow them until the owner edits the text.
  useEffect(() => {
    if (settings.quotePaymentDetails || paymentEdited.current) return;
    setPaymentDetails(getCompiledPaymentDetails());
  }, [content.contact.paymentDetails, content.contact.paymentDetailsByMethod, settings.quotePaymentDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = subscribeToSavedPaymentDetails((entries) => setSavedPaymentEntries(entries));
    return () => unsub();
  }, []);

  // Quote Line Items: Blank by default (no placeholder pre-filled mock items)
  const [items, setItems] = useState<QuoteLineItem[]>(() => [blankLine()]);

  // Catalog State
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogTargetId, setCatalogTargetId] = useState<string | null>(null); // the row the catalog browser will fill

  // UI Status
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [quoteCreationStep, setQuoteCreationStep] = useState<'idle' | 'saving' | 'generating'>('idle');
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
      setClientKraPin('');
    } else if (clientId === '') {
      setIsCustomClient(false);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setClientKraPin('');
    } else {
      setIsCustomClient(false);
      const found = clientsList.find(c => c.id === clientId || c.uid === clientId);
      if (found) {
        setClientName(found.name || found.displayName || '');
        setClientEmail(found.email || '');
        setClientPhone(found.phone || found.phoneNumber || '');
        setClientKraPin(found.kraPin || '');
      }
    }
  };

  // Calculations
  const totals = useMemo(() => computeTotals(items, defaultTaxes), [items, defaultTaxes]);
  const totalEstimate = totals.subtotal; // before tax; the internal margin is worked out on this

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

  // Item Handlers. Every update is functional and keyed by row id, so two updates in the same
  // tick (typing + picking a suggestion) or a row picked from the catalog can never land on the wrong line.
  const handleAddItem = () => {
    setItems(prev => [...prev, blankLine()]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => (prev.length <= 1 ? [blankLine()] : prev.filter(item => item.id !== id)));
  };

  const handleUpdateItem = (id: string, field: keyof QuoteLineItem, value: any) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleLineItemCatalogSelect = (itemId: string, catalogItem: CatalogItem) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
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
    }));
  };

  // Catalog browser: fills the row it was opened from, never a guessed one.
  const handleCatalogSelect = (catalogItem: CatalogItem) => {
    if (catalogTargetId) handleLineItemCatalogSelect(catalogTargetId, catalogItem);
    setCatalogTargetId(null);
  };

  const openCatalogForNewLine = () => {
    const blank = items.find(isBlankLine);
    if (blank) {
      setCatalogTargetId(blank.id);
    } else {
      const row = blankLine();
      setItems(prev => [...prev, row]);
      setCatalogTargetId(row.id);
    }
    setIsCatalogOpen(true);
  };

  const resetForNewQuote = () => {
    setEditingQuoteId(null);
    setDocNumber(`QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(todayStr);
    setValidUntil(validUntilDefault);
    setSelectedClientId('');
    setIsCustomClient(false);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientKraPin('');
    setProjectName('');
    setItems([blankLine()]);
    setTerms([...settings.quoteTerms]);
    paymentEdited.current = false;
    setPaymentDetails(settings.quotePaymentDetails || getCompiledPaymentDetails());
    setNotes('');
  };

  const handleCreateNew = () => {
    defaultsApplied.current = true;
    resetForNewQuote();
    setActiveView('generator');
  };

  // Load a saved quote into the form. For an edit it keeps its identity; for "make another" it gets a new number.
  const applySavedQuote = (qt: SavedQuote, asCopy: boolean) => {
    defaultsApplied.current = true;
    paymentEdited.current = true; // never let site settings overwrite a loaded quote
    setEditingQuoteId(asCopy ? null : (qt.id || null));
    setDocNumber(asCopy
      ? `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      : (qt.docNumber || `QT-${new Date().getFullYear()}-001`));
    setDate(asCopy ? todayStr : (qt.date || todayStr));
    setValidUntil(asCopy ? validUntilDefault : (qt.validUntil || validUntilDefault));
    setSelectedClientId(qt.clientId || '');
    setIsCustomClient(!qt.clientId);
    setClientName(qt.clientName || '');
    setClientEmail(qt.clientEmail || '');
    setClientPhone(qt.clientPhone || '');
    setClientKraPin(qt.clientKraPin || '');
    setProjectName(qt.projectName || '');

    // Older quotes keep their combined terms/payment text as notes; their items never had tax, so they keep none.
    setTerms(qt.terms ? [...qt.terms] : []);
    setPaymentDetails(qt.paymentDetails ?? '');
    setNotes(qt.notes || '');

    if (qt.items && qt.items.length > 0) {
      setItems(qt.items.map(i => ({
        ...i,
        id: asCopy ? newLineId() : (i.id || newLineId()),
        taxes: i.taxes ?? []
      })));
    } else {
      setItems([blankLine()]);
    }
    setActiveView('generator');
  };

  const handleLoadQuote = (qt: SavedQuote) => applySavedQuote(qt, false);
  const handleDuplicateQuote = (qt: SavedQuote) => applySavedQuote(qt, true);

  // The content of the quote as it is saved AND printed, so the PDF can never differ from the archive.
  const buildQuoteFields = () => {
    const activeItems = items.filter(i => !isBlankLine(i));
    const cleanedItems = activeItems.map(i => {
      const itemObj: Record<string, any> = {
        id: i.id || newLineId(),
        description: i.description || '',
        quantity: i.quantity === '' ? 0 : Number(i.quantity) || 0,
        unitPrice: i.unitPrice === '' ? 0 : Number(i.unitPrice) || 0,
        taxes: resolveTaxes(i, defaultTaxes).map(t => ({ id: t.id, name: t.name, rate: t.rate }))
      };
      if (i.category && i.category.trim()) itemObj.category = i.category.trim();
      if (i.unit && i.unit.trim()) itemObj.unit = i.unit.trim();
      if (typeof i.purchasePrice === 'number') itemObj.purchasePrice = i.purchasePrice;
      return itemObj;
    });

    const fields: Record<string, any> = {
      docNumber,
      date,
      validUntil,
      clientName: clientName.trim(),
      items: cleanedItems,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      taxSummary: totals.taxLines,
      total: totals.total,
      terms: terms.map(t => t.trim()).filter(Boolean),
      notes: notes.trim()
    };
    if (paymentDetails.trim()) fields.paymentDetails = paymentDetails.trim();
    if (settings.ownKraPin) fields.ownKraPin = settings.ownKraPin;
    if (clientKraPin) fields.clientKraPin = clientKraPin;
    if (selectedClientId && selectedClientId.trim() && selectedClientId !== 'NEW_CLIENT') fields.clientId = selectedClientId.trim();
    if (clientEmail && clientEmail.trim()) fields.clientEmail = clientEmail.trim();
    if (clientPhone && clientPhone.trim()) fields.clientPhone = clientPhone.trim();
    if (projectName && projectName.trim()) fields.projectName = projectName.trim();
    return fields;
  };

  const buildPdfData = () =>
    quoteToPDFData(
      { ...buildQuoteFields(), status: 'sent', createdAt: '', updatedAt: '' } as unknown as SavedQuote,
      content.contact
    );

  // Keep a registered client's KRA PIN on their profile so it pre-fills next time (never blocks saving).
  const rememberClientKraPin = () => {
    if (!selectedClientId || selectedClientId === 'NEW_CLIENT' || !clientKraPin) return;
    const known = clientsList.find(c => (c.id || c.uid) === selectedClientId);
    if (known && known.kraPin === clientKraPin) return;
    persistKraPin('client', selectedClientId, clientKraPin).then(ok => {
      if (ok) {
        setClientsList(list => list.map(c => ((c.id || c.uid) === selectedClientId ? { ...c, kraPin: clientKraPin } : c)));
      }
    });
  };

  const saveQuoteToFirestore = async (customStatus?: QuoteStatus): Promise<string | null> => {
    if (!clientName.trim()) {
      alert('Please provide a client name before saving.');
      return null;
    }

    try {
      setIsSavingDraft(true);

      const quoteData: Record<string, any> = {
        ...buildQuoteFields(),
        status: customStatus || 'sent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: profile?.name || 'Owner'
      };

      rememberClientKraPin();

      if (editingQuoteId) {
        // An edit keeps its original creation date.
        delete quoteData.createdAt;
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
    } catch (err: any) {
      console.error('Error saving quotation to Firestore:', err);
      const errMsg = err?.message || String(err);
      alert(`Failed to save quotation to archive. ${errMsg}`);
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
      setQuoteCreationStep('saving');

      // Auto-save to quotes collection; stop if it could not be saved
      const savedId = await saveQuoteToFirestore();
      if (!savedId) return;

      setQuoteCreationStep('generating');
      await generateDocumentPDF('quote', buildPdfData());

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Quote generation failed:', err);
      alert('Failed to generate PDF quotation. Please try again.');
    } finally {
      setIsGenerating(false);
      setQuoteCreationStep('idle');
    }
  };

  const handleShare = async () => {
    if (!clientName.trim()) {
      alert('Please provide a client name.');
      return;
    }

    try {
      setIsSharing(true);

      const savedId = await saveQuoteToFirestore();
      if (!savedId) return;

      await shareDocumentPDF('quote', buildPdfData());
    } catch (err) {
      console.error('Quote sharing failed:', err);
      alert('Failed to share PDF quotation. Please try again.');
    } finally {
      setIsSharing(false);
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
              <span className="text-[11px] px-1.5 py-0.5 bg-ochre/10 text-ochre-dark rounded-md font-mono">
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
      <div className="space-y-8">
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
                <label className="block text-[11px] font-bold uppercase text-charcoal/65 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="client@email.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/65 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+254 7..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                />
              </div>
            </div>

            <KraPinInput
              label="Client KRA PIN"
              value={clientKraPin}
              onChange={setClientKraPin}
              inputClassName="bg-white border-charcoal/10 rounded-xl p-2.5 text-xs"
            />
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
              <p className="text-xs text-charcoal/65">
                Add services or materials from your catalog or enter custom specifications.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTaxModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-charcoal/15 text-charcoal hover:bg-cream text-xs font-bold transition-all cursor-pointer"
              >
                <Percent className="w-3.5 h-3.5 text-ochre" />
                <span>Tax settings</span>
              </button>
              <button
                type="button"
                onClick={openCatalogForNewLine}
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
                    <th className="p-3.5 w-52">Tax</th>
                    <th className="p-3.5 w-44 text-right">Amount (KES)</th>
                    <th className="p-3.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5 text-xs">
                  {items.map((item) => {
                    const rowTaxes = resolveTaxes(item, defaultTaxes);
                    const rowTax = lineTaxAmount(item, defaultTaxes, totals.subtotal > 0 ? totals.discount / totals.subtotal : 0);
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
                                setCatalogTargetId(item.id);
                                setIsCatalogOpen(true);
                              }}
                            />
                            {item.purchasePrice !== undefined && item.purchasePrice > 0 && (
                              <span className="text-[11px] text-emerald-600 font-medium pl-1 block">
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

                        {/* Per-item tax */}
                        <td className="p-3 align-middle">
                          <ItemTaxPicker
                            taxes={rowTaxes}
                            available={settings.taxTypes.filter(t => t.enabled)}
                            onChange={(next) => handleUpdateItem(item.id, 'taxes', next)}
                          />
                          {rowTax > 0 && (
                            <span className="block mt-1 text-[11px] text-charcoal/60 font-mono">+ KES {formatMoney(rowTax)}</span>
                          )}
                        </td>

                        {/* Row amount (before tax) */}
                        <td className="p-3 text-right font-mono font-bold text-charcoal">
                          KES {formatMoney(rowTotal)}
                        </td>

                        {/* Delete Row */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-charcoal/60 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
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

        {/* Terms & Totals */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 p-6 bg-cream/30 rounded-2xl border border-charcoal/10">
          {/* Numbered terms & conditions (this quote's own copy; the default is saved separately for quotes) */}
          <div className="w-full md:flex-1 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
              Terms & Conditions
            </label>
            <TermsEditor
              terms={terms}
              onChange={setTerms}
              docLabel="quote"
              savedDefault={settings.quoteTerms}
              onSaveDefault={(list) => saveSettings({ quoteTerms: list })}
            />
            <p className="text-[11px] text-charcoal/65">
              Printed as a numbered list on the client-facing PDF. Changes here only affect this quote unless you save them as the default.
            </p>
          </div>

          {/* Totals & Internal Margin derivations */}
          <div className="w-full md:w-80 space-y-4 bg-white p-5 rounded-2xl border border-charcoal/10 shadow-sm shrink-0">
            {/* Client-Facing Quote Total */}
            <div className="p-4 bg-ochre/10 rounded-xl border border-ochre/20 space-y-2">
              {(totals.taxTotal > 0 || totals.discount > 0) && (
                <div className="space-y-1 text-xs text-charcoal/70 pb-2 border-b border-ochre/20">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">KES {formatMoney(totals.subtotal)}</span>
                  </div>
                  {totals.taxLines.map(t => (
                    <div key={t.key} className="flex justify-between">
                      <span>{t.name} ({Number.isInteger(t.rate) ? t.rate : t.rate.toFixed(2)}%)</span>
                      <span className="font-mono">+ KES {formatMoney(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ochre-dark block">
                  {totals.taxTotal > 0 ? 'Total Quotation Estimate (incl. tax)' : 'Total Quotation Estimate'}
                </span>
                <span className="font-mono font-black text-xl text-charcoal mt-1 block">
                  KES {formatMoney(totals.total)}
                </span>
              </div>
            </div>

            {/* Internal Margin Derived Preview (Owner Only - Not shown on client PDF) */}
            <div className="p-3.5 bg-cream/50 rounded-xl border border-charcoal/10 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-charcoal/60">
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
                    <span>Profit Margin (before tax):</span>
                    <span>{marginPercentage}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-charcoal/60 italic">
                  Select items from the catalog with purchase costs to see internal profit margins.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment details: saved presets, same as invoices */}
        <div className="p-6 bg-white rounded-2xl border border-charcoal/10 shadow-sm">
          <PaymentDetailsSection
            title="Payment Details"
            description="Pick a saved preset or type the details once and preserve them for future quotes."
            textareaLabel="Payment details printed on this quote"
            value={paymentDetails}
            onChange={(v) => {
              paymentEdited.current = true;
              setPaymentDetails(v);
            }}
            savedEntries={savedPaymentEntries}
            onSaveAsDefault={(v) => saveSettings({ quotePaymentDetails: v })}
            defaultLabel="Use as default for new quotes"
          />
        </div>

        {/* Optional extra notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
            Additional notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else the client should know about this quote"
            className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs text-charcoal/80 focus:outline-none focus:border-ochre leading-relaxed font-sans"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-charcoal/5">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing || isGenerating || isSavingDraft || !clientName.trim()}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 cursor-pointer"
          >
            {isSharing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sharing...</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Share Quote</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={isGenerating || isSavingDraft || !clientName.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-ochre hover:bg-ochre-dark text-white text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-lg disabled:opacity-40 cursor-pointer"
          >
            {isGenerating || isSavingDraft ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {quoteCreationStep === 'saving' || isSavingDraft
                    ? 'Saving to Archive...'
                    : 'Generating & Downloading PDF...'}
                </span>
              </>
            ) : (
              <>
                <FileSignature className="w-4 h-4" />
                <span>{editingQuoteId ? 'Update & Download Quote' : 'Create Quote'}</span>
              </>
            )}
          </button>
        </div>
      </div>
      )}

      {/* Catalog Manager Modal */}
      <CatalogManagerModal
        isOpen={isCatalogOpen}
        onClose={() => {
          setIsCatalogOpen(false);
          setCatalogTargetId(null);
        }}
        onSelectItem={(catItem) => {
          handleCatalogSelect(catItem);
          setIsCatalogOpen(false);
        }}
      />

      <TaxSettingsModal
        isOpen={taxModalOpen}
        onClose={() => setTaxModalOpen(false)}
        settings={settings}
        onSave={saveSettings}
      />
    </div>
  );
}
