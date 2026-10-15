import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, query, getDocs, where, onSnapshot, addDoc, doc, updateDoc, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';
import { Plus, Trash2, Download, FileText, Building2, User, Phone, Mail, DollarSign, Calendar, CheckCircle2, Layers, AlertCircle, RefreshCw, Briefcase, CreditCard, Check, ArrowRight, Save, History, X, Share2, Lock, HelpCircle, Percent } from 'lucide-react';
import { generateDocumentPDF, shareDocumentPDF, formatMoney } from '../utils/pdfGenerator';
import { invoiceToPDFData } from '../utils/documentPdfData';
import { persistKraPin } from '../utils/kraPinStore';
import { cn } from '../lib/utils';
import CatalogManagerModal from './CatalogManagerModal';
import CatalogAutocomplete from './CatalogAutocomplete';
import SavedInvoicesList from './SavedInvoicesList';
import TermsEditor from './TermsEditor';
import ItemTaxPicker from './ItemTaxPicker';
import TaxSettingsModal from './TaxSettingsModal';
import PaymentDetailsSection from './PaymentDetailsSection';
import KraPinInput from './KraPinInput';
import { ItemTax, computeTotals, lineTaxAmount, resolveTaxes, legacyTaxes, vatSwitchTaxes, vatState, withVat, savedDocHasVat } from '../lib/tax';
import VatSwitch from './VatSwitch';
import { useDocumentSettings, DEFAULT_INVOICE_TERMS } from '../lib/documentSettings';
import { createNumberedDoc, useNextDocNumber } from '../lib/docNumbers';
import { invoiceBalance, invoiceStatusFor } from '../lib/credit';
import { subscribeToSavedPaymentDetails, SavedPaymentDetail } from '../services/paymentDetailsService';
import { CatalogItem } from '../types/catalog';
import { SavedInvoice, InvoiceStatus, InvoiceMode, RecipientType, InvoiceLineItem, Lead } from '../types/documents';

// Helper to sanitize Firestore payloads and eliminate undefined fields
function cleanPayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

const newLineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const blankLine = (taxes?: ItemTax[]): InvoiceLineItem => ({
  id: newLineId(),
  description: '',
  unit: 'pcs',
  quantity: 1,
  unitPrice: '',
  amount: 0,
  ...(taxes ? { taxes } : {})
});

const isBlankLine = (i: InvoiceLineItem) => !i.description.trim() && !(Number(i.unitPrice) > 0);

export default function InvoiceGenerator() {
  const { content } = useCMS();
  const { profile } = useAuth();

  // Invoice numbers are sequential and assigned when the invoice is first saved
  const nextInvoiceNumber = useNextDocNumber('invoice');
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Document Metadata
  const [docNumber, setDocNumber] = useState(''); // '' until the first save assigns the number
  const docNumberRef = useRef('');
  const updateDocNumber = (n: string) => {
    docNumberRef.current = n;
    setDocNumber(n);
  };
  const [date, setDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  // Builder Mode: Itemized Line Items vs Simple Freeform Total
  const [builderMode, setBuilderMode] = useState<'itemized' | 'freeform'>('itemized');

  // Recipient Source: 'client' | 'lead' | 'walk_in'
  const [recipientType, setRecipientType] = useState<RecipientType>('walk_in');
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientKraPin, setClientKraPin] = useState('');

  // Inline New Lead Quick Creation Modal
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '', email: '', kraPin: '', notes: '' });
  const [isSavingLead, setIsSavingLead] = useState(false);

  // Project Association: Manual choice, never auto-detected
  const [linkProject, setLinkProject] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Freeform Mode State
  const [freeformDescription, setFreeformDescription] = useState('Interior Design Planning & Turnkey Spatial Execution');
  const [freeformAmount, setFreeformAmount] = useState<number | ''>('');

  // Itemized Line Items State
  const [items, setItems] = useState<InvoiceLineItem[]>(() => [blankLine()]);

  // Freeform mode is one lump-sum line, so it carries its own taxes (undefined = follow the defaults)
  const [freeformTaxes, setFreeformTaxes] = useState<ItemTax[] | undefined>(undefined);

  // Adjustments: Discount (tax is per item now, see tax settings)
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number | ''>('');

  // Saved settings: tax types, own KRA PIN, default terms
  const { settings, loaded: settingsLoaded, save: saveSettings, defaultTaxes } = useDocumentSettings();
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [vatOn, setVatOn] = useState(true); // global VAT switch; new lines follow it

  // Payment details block, numbered terms, and optional extra notes
  const [paymentMethodSelection, setPaymentMethodSelection] = useState<'bank' | 'mpesa' | 'cash' | 'cheque' | 'all'>('all');
  const [terms, setTerms] = useState<string[]>(DEFAULT_INVOICE_TERMS);
  const [paymentDetails, setPaymentDetails] = useState('');
  const [notes, setNotes] = useState(''); // older invoices keep their combined text here

  // Reusable Saved Payment Details Presets
  const [savedPaymentEntries, setSavedPaymentEntries] = useState<SavedPaymentDetail[]>([]);

  // Catalog State for Inline Picker
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogTargetId, setCatalogTargetId] = useState<string | null>(null); // the row the catalog browser will fill

  // UI Status
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [creationStep, setCreationStep] = useState<'idle' | 'saving' | 'generating'>('idle');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Archive & Edit State
  const [activeView, setActiveView] = useState<'generator' | 'archive'>('generator');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<SavedInvoice | null>(null);
  const [isLockedInvoice, setIsLockedInvoice] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Helper to format payment instructions from Settings (the printed block has its own heading)
  const getPaymentInstructions = (method: 'bank' | 'mpesa' | 'cash' | 'cheque' | 'all') => {
    const methods = content?.contact?.paymentDetailsByMethod || {};
    const bankText = methods.bank || 'Bank Transfer: Equity Bank Kenya, Acc Name: Pamnim Interior Designers, Acc No: 0123456789, Branch: Nairobi Main';
    const mpesaText = methods.mpesa || 'M-Pesa Paybill: 247247, Account No: 0714984268, Acc Name: Pamnim Interior Designers';
    const cashText = methods.cash || 'Cash payments accepted directly at our Nairobi workshop upon official receipt issue.';
    const chequeText = methods.cheque || 'Cheques payable to: Pamnim Interior Designers (handed over at our Nairobi offices).';

    if (method === 'bank') return bankText;
    if (method === 'mpesa') return mpesaText;
    if (method === 'cash') return cashText;
    if (method === 'cheque') return chequeText;
    return [bankText, mpesaText, cashText, chequeText].filter(Boolean).join('\n\n');
  };

  // A fresh invoice picks up the saved default terms once; a loaded invoice is never overwritten.
  const defaultsApplied = useRef(false);
  const paymentEdited = useRef(false);

  useEffect(() => {
    if (!settingsLoaded || defaultsApplied.current) return;
    defaultsApplied.current = true;
    setTerms([...settings.invoiceTerms]);
  }, [settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the method pills / site payment settings until the owner edits or picks a preset.
  useEffect(() => {
    if (paymentEdited.current) return;
    setPaymentDetails(getPaymentInstructions(paymentMethodSelection));
  }, [paymentMethodSelection, content?.contact?.paymentDetailsByMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to Reusable Saved Payment Details
  useEffect(() => {
    const unsub = subscribeToSavedPaymentDetails((entries) => {
      setSavedPaymentEntries(entries);
    });
    return () => unsub();
  }, []);

  // 1. Fetch Registered Clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const q = query(collection(db, 'profiles'), where('role', '==', 'client'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setClientsList(list);
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };
    fetchClients();
  }, []);

  // 2. Fetch Manual Leads
  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Lead[];
      setLeadsList(list);
    }, (err) => console.error('Error fetching leads:', err));
    return () => unsub();
  }, []);

  // 3. Fetch Projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjectsList(list);
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };
    fetchProjects();
  }, []);

  // 4. Fetch Services & Materials Catalog
  useEffect(() => {
    const q = query(collection(db, 'servicesMaterials'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CatalogItem[];
      setCatalogItems(list);
    }, (err) => console.error('Error fetching catalog:', err));
    return () => unsub();
  }, []);

  // Handle Recipient Changes
  const handleClientAccountChange = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) {
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setClientKraPin('');
      return;
    }
    const found = clientsList.find(c => c.id === clientId || c.uid === clientId);
    if (found) {
      setClientName(found.name || found.displayName || '');
      setClientEmail(found.email || '');
      setClientPhone(found.phone || found.phoneNumber || '');
      setClientKraPin(found.kraPin || '');
    }
  };

  const handleLeadChange = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (!leadId) {
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setClientKraPin('');
      return;
    }
    const found = leadsList.find(l => l.id === leadId);
    if (found) {
      setClientName(found.name || '');
      setClientEmail(found.email || '');
      setClientPhone(found.phone || '');
      setClientKraPin(found.kraPin || '');
    }
  };

  const handleSaveQuickLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.name.trim()) {
      alert('Please enter a lead / customer name.');
      return;
    }

    setIsSavingLead(true);
    try {
      const leadData = cleanPayload({
        name: newLeadForm.name.trim(),
        phone: newLeadForm.phone.trim() || undefined,
        email: newLeadForm.email.trim() || undefined,
        kraPin: newLeadForm.kraPin || undefined,
        notes: newLeadForm.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdBy: profile?.name || 'Owner'
      });

      const docRef = await addDoc(collection(db, 'leads'), leadData);
      setRecipientType('lead');
      setSelectedLeadId(docRef.id);
      setClientName(newLeadForm.name.trim());
      setClientEmail(newLeadForm.email.trim());
      setClientPhone(newLeadForm.phone.trim());
      setClientKraPin(newLeadForm.kraPin);
      setShowNewLeadModal(false);
      setNewLeadForm({ name: '', phone: '', email: '', kraPin: '', notes: '' });
    } catch (err) {
      console.error('Error saving new lead:', err);
      alert('Failed to save manual lead.');
    } finally {
      setIsSavingLead(false);
    }
  };

  // Calculations. Tax is charged per item; the discount is spread across lines so the tax base shrinks with it.
  const taxableLines = useMemo(
    () => builderMode === 'freeform'
      ? [{ quantity: 1 as number | '', unitPrice: (Number(freeformAmount) || 0) as number | '', taxes: freeformTaxes }]
      : items,
    [builderMode, freeformAmount, freeformTaxes, items]
  );

  const baseSubtotal = useMemo(() => computeTotals(taxableLines, defaultTaxes, 0).subtotal, [taxableLines, defaultTaxes]);

  // Discount
  const numericDiscountVal = Number(discountValue) || 0;
  const discountAmount = discountType === 'percentage'
    ? (baseSubtotal * Math.min(100, Math.max(0, numericDiscountVal))) / 100
    : Math.min(baseSubtotal, Math.max(0, numericDiscountVal));

  const totals = useMemo(
    () => computeTotals(taxableLines, defaultTaxes, discountAmount),
    [taxableLines, defaultTaxes, discountAmount]
  );
  const rawSubtotal = totals.subtotal;
  const taxAmount = totals.taxTotal;
  const totalInvoicedAmount = totals.total;

  // If editing an invoice with payments, lock values
  const currentPaid = editingInvoice ? (Number(editingInvoice.amountPaid) || 0) : 0;
  const currentCredited = editingInvoice ? (Number(editingInvoice.creditedAmount) || 0) : 0;
  const calculatedBalanceDue = invoiceBalance(totalInvoicedAmount, currentPaid, currentCredited);

  // Line Item Handlers. Every update is functional and keyed by row id, so a row picked from the
  // catalog or two updates in the same tick can never land on the wrong line.
  const vatTaxes = useMemo(() => vatSwitchTaxes(settings.taxTypes, defaultTaxes), [settings.taxTypes, defaultTaxes]);
  const vatNow = vatState(taxableLines, defaultTaxes, vatTaxes);
  // A line added while the switch is off starts without VAT; otherwise it follows the defaults.
  const newLineTaxes = (): ItemTax[] | undefined => (vatOn ? undefined : withVat(defaultTaxes, vatTaxes, false));

  const setAllVat = (on: boolean) => {
    if (isLockedInvoice) return;
    setVatOn(on);
    setItems(prev => prev.map(i => ({ ...i, taxes: withVat(resolveTaxes(i, defaultTaxes), vatTaxes, on) })));
    setFreeformTaxes(prev => withVat(resolveTaxes({ taxes: prev }, defaultTaxes), vatTaxes, on));
  };

  const handleAddItem = () => {
    if (isLockedInvoice) return;
    setItems(prev => [...prev, blankLine(newLineTaxes())]);
  };

  const handleRemoveItem = (id: string) => {
    if (isLockedInvoice) return;
    setItems(prev => (prev.length <= 1 ? [blankLine(newLineTaxes())] : prev.filter(i => i.id !== id)));
  };

  const handleUpdateItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
    if (isLockedInvoice) return;
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : updated.quantity) || 0;
        const price = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0;
        updated.amount = qty * price;
      }
      return updated;
    }));
  };

  const applyCatalogItem = (targetId: string, catalogItem: CatalogItem) => {
    if (isLockedInvoice) return;
    setItems(prev => prev.map(i => {
      if (i.id !== targetId) return i;
      const qty = Number(i.quantity) || 1;
      const price = Number(catalogItem.sellingPrice) || 0;
      return {
        ...i,
        description: catalogItem.description
          ? `${catalogItem.name} — ${catalogItem.description}`
          : catalogItem.name,
        category: catalogItem.category,
        unit: catalogItem.unit || 'pcs',
        unitPrice: price,
        amount: qty * price
      };
    }));
  };

  // Catalog browser: fills the row it was opened from; opened from the top button it fills the
  // first empty row (or adds one) instead of silently dropping the pick.
  const handleCatalogSelect = (catalogItem: CatalogItem) => {
    if (isLockedInvoice) return;
    if (catalogTargetId) {
      applyCatalogItem(catalogTargetId, catalogItem);
    } else {
      const blank = items.find(isBlankLine);
      if (blank) {
        applyCatalogItem(blank.id, catalogItem);
      } else {
        const row = blankLine(newLineTaxes());
        setItems(prev => [...prev, row]);
        // The new row exists after this update; fill it in the same functional pass.
        setItems(prev => prev.map(i => i.id === row.id ? {
          ...i,
          description: catalogItem.description ? `${catalogItem.name} — ${catalogItem.description}` : catalogItem.name,
          category: catalogItem.category,
          unit: catalogItem.unit || 'pcs',
          unitPrice: Number(catalogItem.sellingPrice) || 0,
          amount: (Number(i.quantity) || 1) * (Number(catalogItem.sellingPrice) || 0)
        } : i));
      }
    }
    setCatalogTargetId(null);
  };

  const handleResetToNew = () => {
    defaultsApplied.current = true;
    paymentEdited.current = false;
    setEditingInvoiceId(null);
    setEditingInvoice(null);
    setIsLockedInvoice(false);
    updateDocNumber('');
    setDate(todayStr);
    setDueDate(defaultDueDate);
    setBuilderMode('itemized');
    setRecipientType('walk_in');
    setSelectedClientId('');
    setSelectedLeadId('');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setClientKraPin('');
    setLinkProject(false);
    setSelectedProjectId('');
    setFreeformDescription('Interior Design Planning & Turnkey Spatial Execution');
    setFreeformAmount('');
    setFreeformTaxes(undefined);
    setVatOn(true);
    setDiscountValue('');
    setItems([blankLine()]);
    setPaymentMethodSelection('all');
    setPaymentDetails(getPaymentInstructions('all'));
    setTerms([...settings.invoiceTerms]);
    setNotes('');
    setActiveView('generator');
  };

  // Load a saved invoice into the form (edit) or as the starting point of a new one (duplicate).
  const applySavedInvoice = (inv: SavedInvoice, asCopy: boolean) => {
    if (asCopy) {
      handleResetToNew();
    } else {
      setEditingInvoiceId(inv.id || null);
      setEditingInvoice(inv);
      const hasPayments = (Number(inv.amountPaid) || 0) > 0 || !!inv.isLocked;
      setIsLockedInvoice(hasPayments);
    }
    defaultsApplied.current = true;
    paymentEdited.current = true; // never let site settings overwrite a loaded invoice

    updateDocNumber(asCopy ? '' : (inv.docNumber || ''));
    setDate(asCopy ? todayStr : (inv.date || todayStr));
    setDueDate(asCopy ? defaultDueDate : (inv.dueDate || defaultDueDate));

    // Older invoices stored one document-level rate and no per-item taxes; map it onto each line.
    const fallbackTaxes = legacyTaxes(inv.taxRate);
    setVatOn(savedDocHasVat((inv.items || []).map(i => ({ taxes: i.taxes ?? fallbackTaxes }))));

    if (inv.invoiceMode === 'freeform') {
      setBuilderMode('freeform');
      const lump = inv.items?.[0]?.unitPrice;
      setFreeformAmount(typeof lump === 'number' ? lump : (inv.subtotal || inv.totalInvoiced || ''));
      setFreeformDescription(inv.items?.[0]?.description || 'Interior Spatial Service');
      setFreeformTaxes(inv.items?.[0]?.taxes ?? fallbackTaxes);
    } else {
      setBuilderMode('itemized');
      if (inv.items && inv.items.length > 0) {
        setItems(inv.items.map(i => ({
          id: asCopy ? newLineId() : (i.id || newLineId()),
          description: i.description || i.name || '',
          category: i.category,
          unit: i.unit || 'pcs',
          quantity: typeof i.quantity === 'number' ? i.quantity : 1,
          unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : (Number(i.amount) || 0),
          amount: Number(i.amount) || ((typeof i.quantity === 'number' ? i.quantity : 1) * (typeof i.unitPrice === 'number' ? i.unitPrice : 0)),
          taxes: i.taxes ?? fallbackTaxes
        })));
      } else {
        setItems([blankLine()]);
      }
    }

    setRecipientType(inv.recipientType || (inv.clientId ? 'client' : inv.leadId ? 'lead' : 'walk_in'));
    setSelectedClientId(inv.clientId || '');
    setSelectedLeadId(inv.leadId || '');
    setClientName(inv.clientName || '');
    setClientEmail(inv.clientEmail || '');
    setClientPhone(inv.clientPhone || '');
    setClientKraPin(inv.clientKraPin || '');

    setLinkProject(!!inv.projectId);
    setSelectedProjectId(inv.projectId || '');

    setDiscountType((inv.discountType as any) === 'percentage' ? 'percentage' : 'fixed');
    setDiscountValue(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || ''));

    // Older invoices keep their combined payment/terms text as notes.
    setTerms(inv.terms ? [...inv.terms] : []);
    setPaymentDetails(inv.paymentDetails ?? '');
    setNotes(inv.notes || '');

    setActiveView('generator');
  };

  const handleLoadInvoice = (inv: SavedInvoice) => applySavedInvoice(inv, false);
  const handleDuplicateInvoice = (inv: SavedInvoice) => applySavedInvoice(inv, true);

  // Build clean items for persistence and PDF (each carries a snapshot of its own taxes)
  const getCleanLineItems = (): InvoiceLineItem[] => {
    if (builderMode === 'freeform') {
      return [{
        id: '1',
        description: freeformDescription.trim() || 'Interior Design & Spatial Planning Services',
        unit: 'lump sum',
        quantity: 1,
        unitPrice: Number(freeformAmount) || 0,
        amount: Number(freeformAmount) || 0,
        taxes: resolveTaxes({ taxes: freeformTaxes }, defaultTaxes).map(t => ({ id: t.id, name: t.name, rate: t.rate }))
      }];
    }

    return items
      .filter(i => !isBlankLine(i))
      .map(i => ({
        id: i.id || newLineId(),
        description: i.description.trim() || 'Custom Interior Material / Service',
        category: i.category,
        unit: i.unit || 'pcs',
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        amount: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
        taxes: resolveTaxes(i, defaultTaxes).map(t => ({ id: t.id, name: t.name, rate: t.rate }))
      }));
  };

  // The content of the invoice as it is saved AND printed, so the PDF can never differ from the archive.
  const buildInvoiceFields = (numberOverride?: string): Record<string, any> => {
    const cleanItems = getCleanLineItems();
    const existingPaid = editingInvoice ? (Number(editingInvoice.amountPaid) || 0) : 0;
    const existingCredited = editingInvoice ? (Number(editingInvoice.creditedAmount) || 0) : 0;
    const finalBalanceDue = invoiceBalance(totalInvoicedAmount, existingPaid, existingCredited);
    const finalStatus: InvoiceStatus = invoiceStatusFor(totalInvoicedAmount, existingPaid, existingCredited);

    const selectedProj = linkProject && selectedProjectId
      ? projectsList.find(p => p.id === selectedProjectId)
      : null;

    return cleanPayload({
      docNumber: numberOverride ?? docNumberRef.current,
      date,
      dueDate,
      invoiceMode: builderMode,
      recipientType,
      clientId: recipientType === 'client' && selectedClientId ? selectedClientId : undefined,
      leadId: recipientType === 'lead' && selectedLeadId ? selectedLeadId : undefined,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientKraPin: clientKraPin || undefined,
      ownKraPin: settings.ownKraPin || undefined,
      projectId: linkProject && selectedProjectId ? selectedProjectId : undefined,
      projectName: selectedProj ? (selectedProj.name || selectedProj.title || 'Project') : undefined,
      items: cleanItems,
      subtotal: rawSubtotal,
      discount: discountAmount > 0 ? discountAmount : undefined,
      discountType: discountAmount > 0 ? discountType : undefined,
      discountValue: discountAmount > 0 && numericDiscountVal > 0 ? numericDiscountVal : undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      taxSummary: totals.taxLines,
      totalInvoiced: totalInvoicedAmount,
      amountPaid: existingPaid,
      balanceDue: finalBalanceDue,
      terms: terms.map(t => t.trim()).filter(Boolean),
      paymentDetails: paymentDetails.trim() || undefined,
      notes: notes.trim(),
      status: finalStatus,
      isLocked: isLockedInvoice,
      selectedPaymentMethod: paymentMethodSelection
    });
  };

  const buildPdfData = () =>
    invoiceToPDFData(
      { ...buildInvoiceFields(), createdAt: '', updatedAt: '' } as unknown as SavedInvoice,
      content.contact
    );

  // Keep the recipient's KRA PIN on their record so it pre-fills next time (never blocks saving).
  const rememberKraPin = () => {
    if (!clientKraPin) return;
    if (recipientType === 'client' && selectedClientId) {
      const known = clientsList.find(c => (c.id || c.uid) === selectedClientId);
      if (known?.kraPin !== clientKraPin) {
        persistKraPin('client', selectedClientId, clientKraPin).then(ok => {
          if (ok) setClientsList(list => list.map(c => ((c.id || c.uid) === selectedClientId ? { ...c, kraPin: clientKraPin } : c)));
        });
      }
    } else if (recipientType === 'lead' && selectedLeadId) {
      const known = leadsList.find(l => l.id === selectedLeadId);
      if (known?.kraPin !== clientKraPin) persistKraPin('lead', selectedLeadId, clientKraPin);
    }
  };

  // Save to Firestore (Clean payload without undefined fields)
  const saveInvoiceToFirestore = async (): Promise<string | null> => {
    if (!clientName.trim()) {
      alert('Please provide a client or recipient name before generating.');
      return null;
    }

    if (totalInvoicedAmount <= 0) {
      alert('Invoice total must be greater than KES 0.');
      return null;
    }

    rememberKraPin();

    if (editingInvoiceId) {
      await updateDoc(doc(db, 'invoices', editingInvoiceId), {
        ...buildInvoiceFields(),
        updatedAt: new Date().toISOString(),
        createdBy: profile?.name || 'Owner'
      });
      setSaveSuccessMessage(`Invoice ${docNumberRef.current} updated in archive!`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      return editingInvoiceId;
    }

    // New invoice: the next sequential number is assigned in the same transaction as the save.
    const created = await createNumberedDoc('invoice', collection(db, 'invoices'), (n) => ({
      ...buildInvoiceFields(n),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: profile?.name || 'Owner'
    }));
    updateDocNumber(created.docNumber);
    setEditingInvoiceId(created.id);
    setSaveSuccessMessage(`Invoice ${created.docNumber} created and saved to archive!`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
    return created.id;
  };

  // Single "Create Invoice" button that saves to archive AND generates the download
  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!clientName.trim()) {
      alert('Please specify a client name.');
      return;
    }

    try {
      setIsGenerating(true);
      setCreationStep('saving');

      // 1. Save to Archive
      const savedId = await saveInvoiceToFirestore();
      if (!savedId) return;

      setCreationStep('generating');

      // 2. Generate and download PDF
      await generateDocumentPDF('invoice', buildPdfData());

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Invoice creation failed:', err);
      alert('Could not complete invoice creation. Please verify details and try again.');
    } finally {
      setIsGenerating(false);
      setCreationStep('idle');
    }
  };

  const handleShare = async () => {
    if (!clientName.trim()) {
      alert('Please specify a client name.');
      return;
    }

    try {
      setIsSharing(true);
      const savedId = await saveInvoiceToFirestore();
      if (!savedId) return;

      await shareDocumentPDF('invoice', buildPdfData());
    } catch (err) {
      console.error('Invoice share failed:', err);
      alert('Could not share invoice document.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation: Builder vs Archive */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-charcoal/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('generator')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer",
              activeView === 'generator'
                ? "bg-ochre text-white shadow-md"
                : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
            )}
          >
            <FileText className="w-4 h-4" />
            <span>Invoice Builder</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('archive')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer",
              activeView === 'archive'
                ? "bg-ochre text-white shadow-md"
                : "bg-white text-charcoal/70 hover:bg-cream border border-charcoal/10"
            )}
          >
            <History className="w-4 h-4" />
            <span>Saved Invoices Archive</span>
          </button>
        </div>

        {activeView === 'generator' && (
          <div className="flex items-center gap-2">
            {editingInvoiceId && (
              <span className="text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                Editing: {docNumber}
              </span>
            )}
            <button
              type="button"
              onClick={handleResetToNew}
              className="px-3.5 py-1.5 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
            >
              Start Fresh
            </button>
          </div>
        )}
      </div>

      {saveSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* VIEW: ARCHIVE */}
      {activeView === 'archive' ? (
        <SavedInvoicesList
          onLoadInvoice={handleLoadInvoice}
          onDuplicateInvoice={handleDuplicateInvoice}
          onCreateNew={handleResetToNew}
        />
      ) : (
        /* VIEW: GENERATOR */
        <div className="space-y-6">
          {/* Audit Lock Banner if Payments Exist */}
          {isLockedInvoice && (
            <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-3xl text-amber-900 text-xs space-y-1 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Audit Lock: Original Financial Amount & Terms Locked</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Payments have already been logged against invoice <strong>{docNumber}</strong> (KES {formatMoney(Number(editingInvoice?.amountPaid) || 0)} recorded). 
                To maintain audit compliance, line items and contract pricing cannot be altered. Logged payments generate separate standalone payment receipts. 
                If you need to re-issue modified terms, use <strong>"Edit to make another"</strong> in the archive to create a new invoice.
              </p>
            </div>
          )}

          {/* 1. Header Card: Invoice Meta & Mode Toggle */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/10 pb-5">
              <div>
                <span className="text-[11px] font-bold tracking-widest text-ochre uppercase block mb-1">
                  OFFICIAL TAX / COMMERCIAL INVOICE
                </span>
                <h3 className="text-2xl font-bold text-charcoal">Pamnim Interior Designers</h3>
              </div>

              {/* Mode Toggle: Itemized vs Freeform */}
              <div className="flex items-center bg-cream/70 p-1 rounded-2xl border border-charcoal/10 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={isLockedInvoice}
                  onClick={() => setBuilderMode('itemized')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    builderMode === 'itemized'
                      ? "bg-white text-charcoal shadow-xs"
                      : "text-charcoal/60 hover:text-charcoal disabled:opacity-50"
                  )}
                >
                  Itemized Line Items
                </button>
                <button
                  type="button"
                  disabled={isLockedInvoice}
                  onClick={() => setBuilderMode('freeform')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    builderMode === 'freeform'
                      ? "bg-white text-charcoal shadow-xs"
                      : "text-charcoal/60 hover:text-charcoal disabled:opacity-50"
                  )}
                >
                  Simple Freeform Total
                </button>
              </div>
            </div>

            {/* Document Numbers & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1.5">
                  Invoice Number
                </label>
                <input
                  type="text"
                  readOnly
                  value={docNumber}
                  placeholder={nextInvoiceNumber ? `Assigned on save (next: ${nextInvoiceNumber})` : 'Assigned on save'}
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-bold text-charcoal focus:outline-none font-mono cursor-default"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1.5">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* 2. Recipient Section: Client vs Manual Lead vs Walk-in + Project Association */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/10 pb-4">
              <div>
                <h4 className="text-base font-bold text-charcoal flex items-center gap-2">
                  <User className="w-4 h-4 text-ochre" />
                  <span>Invoice Recipient</span>
                </h4>
                <p className="text-xs text-charcoal/65">
                  Select a registered client account, a manual lead, or enter walk-in details.
                </p>
              </div>

              {/* Recipient Type Pills */}
              <div className="flex items-center gap-1 bg-cream/70 p-1 rounded-2xl border border-charcoal/10 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setRecipientType('walk_in');
                    setSelectedClientId('');
                    setSelectedLeadId('');
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    recipientType === 'walk_in'
                      ? "bg-white text-charcoal shadow-xs"
                      : "text-charcoal/60 hover:text-charcoal"
                  )}
                >
                  Walk-in Name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientType('client');
                    setSelectedLeadId('');
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    recipientType === 'client'
                      ? "bg-white text-charcoal shadow-xs"
                      : "text-charcoal/60 hover:text-charcoal"
                  )}
                >
                  Client Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientType('lead');
                    setSelectedClientId('');
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    recipientType === 'lead'
                      ? "bg-white text-charcoal shadow-xs"
                      : "text-charcoal/60 hover:text-charcoal"
                  )}
                >
                  Manual Leads
                </button>
              </div>
            </div>

            {/* Recipient Source Pickers */}
            {recipientType === 'client' && (
              <div className="space-y-3 p-4 bg-cream/30 rounded-2xl border border-charcoal/10">
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                  Select Registered Client Account
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientAccountChange(e.target.value)}
                  className="w-full p-3 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="">-- Choose from {clientsList.length} registered clients --</option>
                  {clientsList.map(c => (
                    <option key={c.id || c.uid} value={c.id || c.uid}>
                      {c.name || c.displayName || 'Client'} ({c.email || 'No email'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {recipientType === 'lead' && (
              <div className="space-y-3 p-4 bg-cream/30 rounded-2xl border border-charcoal/10">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                    Select from Manual Leads & Inquiries
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewLeadModal(true)}
                    className="text-xs font-bold text-ochre hover:text-ochre-dark flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Lead</span>
                  </button>
                </div>
                <select
                  value={selectedLeadId}
                  onChange={(e) => handleLeadChange(e.target.value)}
                  className="w-full p-3 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
                >
                  <option value="">-- Choose from {leadsList.length} manual customer leads --</option>
                  {leadsList.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.phone ? `(${l.phone})` : ''} {l.email ? `• ${l.email}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipient Details (Editable for walk-in or fine-tuning) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1.5">
                  Client / Recipient Name <span className="text-ochre">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Dr. Peter Otieno"
                  className="w-full px-3.5 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:border-ochre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="e.g. 0714 984 268"
                  className="w-full px-3.5 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:border-ochre"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="e.g. client@example.com"
                  className="w-full px-3.5 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:border-ochre"
                />
              </div>

              <KraPinInput
                label="Client KRA PIN"
                value={clientKraPin}
                onChange={setClientKraPin}
                inputClassName="px-3.5 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:border-ochre"
                labelClassName="text-xs text-charcoal/60 mb-1.5"
              />
            </div>

            {/* Project Association: Manual choice, never auto-detected */}
            <div className="pt-2 border-t border-charcoal/5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={linkProject}
                  onChange={(e) => {
                    setLinkProject(e.target.checked);
                    if (!e.target.checked) setSelectedProjectId('');
                  }}
                  className="w-4 h-4 text-ochre rounded focus:ring-ochre border-charcoal/30 cursor-pointer"
                />
                <span className="text-xs font-bold text-charcoal">
                  Link this invoice to an active project (Manual Choice)
                </span>
              </label>

              {linkProject && (
                <div className="mt-3 p-4 bg-cream/40 rounded-2xl border border-charcoal/10 animate-fade-in space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                    Select Project
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
                  >
                    <option value="">-- Choose active project --</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.title || 'Untitled Project'} {p.clientName ? `(${p.clientName})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-charcoal/65">
                    Payments logged on this invoice will automatically synchronize with this project's cashflow tracker.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. Items / Financial Details */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <div>
                <h4 className="text-base font-bold text-charcoal flex items-center gap-2">
                  <Layers className="w-4 h-4 text-ochre" />
                  <span>
                    {builderMode === 'freeform' ? 'Simple Freeform Total' : 'Itemized Materials & Services'}
                  </span>
                </h4>
                <p className="text-xs text-charcoal/65">
                  {builderMode === 'freeform'
                    ? 'Manually enter the overall service total/balance.'
                    : 'Type-ahead search pulls saved products and services with units of measure.'}
                </p>
              </div>

              {builderMode === 'itemized' && !isLockedInvoice && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTaxModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl border border-charcoal/15 hover:bg-cream text-charcoal text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Percent className="w-3.5 h-3.5 text-ochre" />
                    <span>Tax settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogTargetId(null);
                      setIsCatalogModalOpen(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-ochre/10 hover:bg-ochre/20 text-ochre text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Catalog Manager</span>
                  </button>
                </div>
              )}
            </div>

            {/* FREEFORM MODE BUILDER */}
            {builderMode === 'freeform' ? (
              <div className="space-y-4 p-5 bg-cream/30 rounded-2xl border border-charcoal/10">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                    Service Description
                  </label>
                  <input
                    type="text"
                    disabled={isLockedInvoice}
                    value={freeformDescription}
                    onChange={(e) => setFreeformDescription(e.target.value)}
                    placeholder="e.g. Master Bedroom Remodel & Full Joinery Scope"
                    className="w-full px-3.5 py-2.5 bg-white border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold text-charcoal focus:outline-none focus:border-ochre disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-ochre" />
                    <span>Initial Balance / Total Amount (KES) <span className="text-ochre">*</span></span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    disabled={isLockedInvoice}
                    value={freeformAmount}
                    onChange={(e) => setFreeformAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 450000"
                    className="w-full px-3.5 py-3 bg-white border border-charcoal/15 rounded-xl text-base sm:text-lg font-bold text-ochre focus:outline-none focus:border-ochre disabled:opacity-60"
                  />
                  <p className="text-[11px] text-charcoal/65 mt-1">
                    Owner manually sets the initial total. Payment status will be auto-calculated against logged payments.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1.5">
                    Tax on this amount
                  </label>
                  <ItemTaxPicker
                    taxes={resolveTaxes({ taxes: freeformTaxes }, defaultTaxes)}
                    available={settings.taxTypes.filter(t => t.enabled)}
                    onChange={setFreeformTaxes}
                    disabled={isLockedInvoice}
                  />
                  <p className="text-[11px] text-charcoal/65 mt-1">
                    The amount above is before tax; tax is added on top.
                  </p>
                </div>
              </div>
            ) : (
              /* ITEMIZED LINE ITEMS BUILDER */
              <div className="space-y-4">
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-4 bg-cream/20 rounded-2xl border border-charcoal/10 space-y-3 hover:border-charcoal/20 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-charcoal/65">
                          Line Item #{index + 1}
                        </span>

                        {!isLockedInvoice && items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-charcoal/60 hover:text-red-600 transition-colors"
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Type-ahead Autocomplete for Material / Service */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                          Material / Service Name (Type-Ahead Search)
                        </label>
                        <CatalogAutocomplete
                          value={item.description}
                          onChange={(val) => handleUpdateItem(item.id, 'description', val)}
                          onSelectCatalogItem={(catalogItem) => applyCatalogItem(item.id, catalogItem)}
                          onOpenCatalogModal={() => {
                            setCatalogTargetId(item.id);
                            setIsCatalogModalOpen(true);
                          }}
                          placeholder="Type or pick from catalog (e.g. SPC Flooring, Gypsum Ceiling)..."
                          catalogItems={catalogItems}
                          inputClassName="bg-white border-charcoal/15 text-xs py-2.5 font-semibold"
                        />
                      </div>

                      {/* Quantity, Unit, Unit Price, Line Total */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                            Unit
                          </label>
                          <input
                            type="text"
                            disabled={isLockedInvoice}
                            value={item.unit || 'pcs'}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                            placeholder="pcs, sqm, m..."
                            className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={isLockedInvoice}
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-semibold text-charcoal focus:outline-none focus:border-ochre disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                            Unit Price (KES)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            disabled={isLockedInvoice}
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-bold text-charcoal focus:outline-none focus:border-ochre disabled:opacity-60"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                            Line Total (KES)
                          </label>
                          <div className="px-3 py-2 bg-cream/60 border border-charcoal/10 rounded-xl text-xs font-bold text-ochre flex items-center">
                            KES {formatMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                          </div>
                        </div>

                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                            Tax
                          </label>
                          <ItemTaxPicker
                            taxes={resolveTaxes(item, defaultTaxes)}
                            available={settings.taxTypes.filter(t => t.enabled)}
                            onChange={(next) => handleUpdateItem(item.id, 'taxes', next)}
                            disabled={isLockedInvoice}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {!isLockedInvoice && (
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full py-2.5 border-2 border-dashed border-charcoal/20 hover:border-ochre rounded-2xl text-xs font-bold text-charcoal/70 hover:text-ochre flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Line Item</span>
                  </button>
                )}
              </div>
            )}

            {/* Adjustments: Discount & Tax */}
            <div className="pt-4 border-t border-charcoal/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Discount */}
              <div className="p-3.5 bg-cream/30 rounded-2xl border border-charcoal/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70">
                    Discount (Optional)
                  </label>
                  <div className="flex items-center text-[11px] font-bold border border-charcoal/15 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      disabled={isLockedInvoice}
                      onClick={() => setDiscountType('fixed')}
                      className={cn(
                        "px-2 py-0.5 transition-colors cursor-pointer",
                        discountType === 'fixed' ? "bg-ochre text-white" : "bg-white text-charcoal/60"
                      )}
                    >
                      KES Fixed
                    </button>
                    <button
                      type="button"
                      disabled={isLockedInvoice}
                      onClick={() => setDiscountType('percentage')}
                      className={cn(
                        "px-2 py-0.5 transition-colors cursor-pointer",
                        discountType === 'percentage' ? "bg-ochre text-white" : "bg-white text-charcoal/60"
                      )}
                    >
                      % Rate
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={isLockedInvoice}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={discountType === 'fixed' ? "Amount in KES (e.g. 15000)" : "Percentage (e.g. 5)"}
                  className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre text-charcoal disabled:opacity-60"
                />
              </div>

              {/* Tax: charged per item (see each line); settings control which taxes exist */}
              <div className="p-3.5 bg-cream/30 rounded-2xl border border-charcoal/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70">
                    Tax
                  </label>
                  <button
                    type="button"
                    onClick={() => setTaxModalOpen(true)}
                    className="text-[11px] font-bold text-ochre hover:text-ochre-dark inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Percent className="w-3 h-3" />
                    <span>Tax settings</span>
                  </button>
                </div>
                <VatSwitch state={vatNow} onChange={setAllVat} disabled={isLockedInvoice} />
                <p className="text-xs text-charcoal/70 leading-relaxed">
                  {taxAmount > 0
                    ? `Charged per item: ${totals.taxLines.map(t => `${t.name} ${Number.isInteger(t.rate) ? t.rate : t.rate.toFixed(2)}%`).join(', ')}.`
                    : 'No tax on this invoice.'}{' '}
                  Change or remove tax on each item above.
                </p>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="p-5 bg-charcoal text-white rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>Subtotal (Base Services & Materials)</span>
                <span className="font-mono">KES {formatMoney(rawSubtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-400">
                  <span>Discount {discountType === 'percentage' ? `(${numericDiscountVal}%)` : ''}</span>
                  <span className="font-mono">- KES {formatMoney(discountAmount)}</span>
                </div>
              )}

              {totals.taxLines.map(t => (
                <div key={t.key} className="flex items-center justify-between text-xs text-amber-300">
                  <span>{t.name} ({Number.isInteger(t.rate) ? t.rate : t.rate.toFixed(2)}%)</span>
                  <span className="font-mono">+ KES {formatMoney(t.amount)}</span>
                </div>
              ))}

              <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-white/60 block">Total Invoiced</span>
                  <span className="text-2xl font-bold text-ochre">
                    KES {formatMoney(totalInvoicedAmount)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase font-bold tracking-wider text-white/60 block">Calculated Status</span>
                  <span className={cn(
                    "text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mt-0.5",
                    currentPaid >= totalInvoicedAmount && totalInvoicedAmount > 0
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : currentPaid > 0
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  )}>
                    {currentPaid >= totalInvoicedAmount && totalInvoicedAmount > 0 
                      ? 'Paid in Full' 
                      : currentPaid > 0 
                      ? `Partial (KES ${formatMoney(calculatedBalanceDue)} remaining)` 
                      : 'Unpaid (0 payments)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Terms, Payment Details & Notes */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                Terms & Conditions
              </label>
              <TermsEditor
                terms={terms}
                onChange={setTerms}
                docLabel="invoice"
                savedDefault={settings.invoiceTerms}
                onSaveDefault={(list) => saveSettings({ invoiceTerms: list })}
                disabled={isLockedInvoice}
              />
              <p className="text-[11px] text-charcoal/65">
                Printed as a numbered list on the PDF. Changes here only affect this invoice unless you save them as the default for invoices.
              </p>
            </div>

            <PaymentDetailsSection
              title="Payment Details"
              description="Pick a saved preset or type the details once and preserve them for future documents."
              textareaLabel="Payment details printed on this invoice"
              value={paymentDetails}
              onChange={(v) => {
                paymentEdited.current = true;
                setPaymentDetails(v);
              }}
              savedEntries={savedPaymentEntries}
              disabled={isLockedInvoice}
              methodPills={
                <div className="flex items-center gap-1 bg-cream/70 p-0.5 rounded-xl border border-charcoal/10 flex-wrap">
                  {(['all', 'bank', 'mpesa', 'cash', 'cheque'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        paymentEdited.current = false;
                        setPaymentMethodSelection(m);
                        setPaymentDetails(getPaymentInstructions(m));
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer",
                        paymentMethodSelection === m
                          ? "bg-white text-charcoal shadow-xs"
                          : "text-charcoal/60 hover:text-charcoal"
                      )}
                    >
                      {m === 'all' ? 'All Defaults' : m}
                    </button>
                  ))}
                </div>
              }
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                Additional notes (optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else to print on this invoice"
                className="w-full p-3 bg-cream/30 border border-charcoal/15 rounded-2xl text-xs text-charcoal focus:outline-none focus:border-ochre leading-relaxed"
              />
            </div>
          </div>

          {/* 5. Requirement 5: Unified "Create Invoice" Button & Action Controls */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-charcoal/60 space-y-0.5 text-center sm:text-left">
              <p className="font-bold text-charcoal">
                {editingInvoiceId ? 'Update & Download' : 'Ready to Issue'}
              </p>
              <p>
                Clicking <strong>{editingInvoiceId ? 'Update & Download' : 'Create Invoice'}</strong> saves this invoice directly to your archive AND generates the official PDF in one action.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Share Invoice Button */}
              <button
                type="button"
                onClick={handleShare}
                disabled={isSharing || isGenerating || !clientName.trim()}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-charcoal/20 text-charcoal hover:bg-cream text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-4 h-4 text-ochre" />
                <span>{isSharing ? 'Sharing...' : 'Share Invoice'}</span>
              </button>

              {/* Requirement 5: Primary Single Action "Create Invoice" */}
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGenerating || isSharing || !clientName.trim() || totalInvoicedAmount <= 0}
                className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {creationStep === 'saving' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Archive...</span>
                  </>
                ) : creationStep === 'generating' ? (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>{editingInvoiceId ? 'Update & Download Invoice' : 'Create Invoice'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK NEW LEAD CREATION MODAL */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-charcoal/15 shadow-2xl p-6 sm:p-8 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h3 className="text-base font-bold text-charcoal">Add Manual Customer / Lead</h3>
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="p-1 rounded-xl text-charcoal/60 hover:text-charcoal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickLead} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                  Full Name <span className="text-ochre">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newLeadForm.name}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  placeholder="e.g. Florence Wanjiru"
                  className="w-full px-3.5 py-2 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newLeadForm.phone}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                  placeholder="07XX XXX XXX"
                  className="w-full px-3.5 py-2 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newLeadForm.email}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  placeholder="client@example.com"
                  className="w-full px-3.5 py-2 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal"
                />
              </div>

              <KraPinInput
                label="KRA PIN"
                value={newLeadForm.kraPin}
                onChange={(v) => setNewLeadForm({ ...newLeadForm, kraPin: v })}
                inputClassName="w-full px-3.5 py-2 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal"
              />

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  placeholder="e.g. Referred from Instagram"
                  className="w-full px-3.5 py-2 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewLeadModal(false)}
                  className="px-4 py-2 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLead}
                  className="px-5 py-2 rounded-xl bg-ochre text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingLead ? 'Saving...' : 'Add Lead'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INLINE CATALOG MANAGER MODAL */}
      <CatalogManagerModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        onSelectItem={(catItem) => {
          handleCatalogSelect(catItem);
          setIsCatalogModalOpen(false);
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
