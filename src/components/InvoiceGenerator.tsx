import React, { useState, useEffect } from 'react';
import { 
  collection, query, getDocs, where, onSnapshot, addDoc, doc, updateDoc, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useCMS } from '../hooks/useCMS';
import { 
  Plus, Trash2, Download, FileText, Sparkles, Building2, User, Phone, Mail, 
  DollarSign, Calendar, CheckCircle2, Layers, AlertCircle, RefreshCw, Briefcase,
  CreditCard, Check, ArrowRight, Save, History, X, Share2, Lock, HelpCircle
} from 'lucide-react';
import { generateDocumentPDF, shareDocumentPDF, formatMoney, PDFLineItem } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';
import CatalogManagerModal from './CatalogManagerModal';
import CatalogAutocomplete from './CatalogAutocomplete';
import SavedInvoicesList from './SavedInvoicesList';
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

export default function InvoiceGenerator() {
  const { content } = useCMS();
  const { profile } = useAuth();

  const defaultInvoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Document Metadata
  const [docNumber, setDocNumber] = useState(defaultInvoiceNumber);
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

  // Inline New Lead Quick Creation Modal
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [isSavingLead, setIsSavingLead] = useState(false);

  // Project Association: Manual choice, never auto-detected
  const [linkProject, setLinkProject] = useState(false);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Freeform Mode State
  const [freeformDescription, setFreeformDescription] = useState('Interior Design Planning & Turnkey Spatial Execution');
  const [freeformAmount, setFreeformAmount] = useState<number | ''>('');

  // Itemized Line Items State
  const [items, setItems] = useState<InvoiceLineItem[]>([
    {
      id: '1',
      description: '',
      unit: 'pcs',
      quantity: 1,
      unitPrice: '',
      amount: 0
    }
  ]);

  // Adjustments: Discount & Tax
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number | ''>(''); // e.g. 16 for 16% VAT

  // Payment Details from Settings
  const [paymentMethodSelection, setPaymentMethodSelection] = useState<'bank' | 'mpesa' | 'cash' | 'cheque' | 'all'>('all');
  const [notes, setNotes] = useState('');

  // Catalog State for Inline Picker
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [activeItemIndexForCatalog, setActiveItemIndexForCatalog] = useState<number | null>(null);

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

  // Helper to format payment instructions from Settings
  const getPaymentInstructions = (method: 'bank' | 'mpesa' | 'cash' | 'cheque' | 'all') => {
    const methods = content?.contact?.paymentDetailsByMethod || {};
    const bankText = methods.bank || 'Bank Transfer: Equity Bank Kenya, Acc Name: Pamnim Interior Designers, Acc No: 0123456789, Branch: Nairobi Main';
    const mpesaText = methods.mpesa || 'M-Pesa Paybill: 247247, Account No: 0714984268, Acc Name: Pamnim Interior Designers';
    const cashText = methods.cash || 'Cash payments accepted directly at our Nairobi workshop upon official receipt issue.';
    const chequeText = methods.cheque || 'Cheques payable to: Pamnim Interior Designers (handed over at our Nairobi offices).';

    if (method === 'bank') return `Payment Terms & Instructions:\n${bankText}`;
    if (method === 'mpesa') return `Payment Terms & Instructions:\n${mpesaText}`;
    if (method === 'cash') return `Payment Terms & Instructions:\n${cashText}`;
    if (method === 'cheque') return `Payment Terms & Instructions:\n${chequeText}`;

    // All methods
    return `Payment Terms: 50% deposit upon contract signing, 40% upon interim milestone, 10% upon final handover.\n\n${[bankText, mpesaText, cashText, chequeText].filter(Boolean).join('\n\n')}`;
  };

  // Sync default notes on init or when payment method selection changes
  useEffect(() => {
    setNotes(getPaymentInstructions(paymentMethodSelection));
  }, [paymentMethodSelection, content?.contact?.paymentDetailsByMethod]);

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
      return;
    }
    const found = clientsList.find(c => c.id === clientId || c.uid === clientId);
    if (found) {
      setClientName(found.name || found.displayName || '');
      setClientEmail(found.email || '');
      setClientPhone(found.phone || found.phoneNumber || '');
    }
  };

  const handleLeadChange = (leadId: string) => {
    setSelectedLeadId(leadId);
    if (!leadId) {
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      return;
    }
    const found = leadsList.find(l => l.id === leadId);
    if (found) {
      setClientName(found.name || '');
      setClientEmail(found.email || '');
      setClientPhone(found.phone || '');
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
      setShowNewLeadModal(false);
      setNewLeadForm({ name: '', phone: '', email: '', notes: '' });
    } catch (err) {
      console.error('Error saving new lead:', err);
      alert('Failed to save manual lead.');
    } finally {
      setIsSavingLead(false);
    }
  };

  // Calculations
  const itemizedSubtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + (qty * price);
  }, 0);

  const rawSubtotal = builderMode === 'freeform'
    ? (Number(freeformAmount) || 0)
    : itemizedSubtotal;

  // Discount
  const numericDiscountVal = Number(discountValue) || 0;
  const discountAmount = discountType === 'percentage'
    ? (rawSubtotal * Math.min(100, Math.max(0, numericDiscountVal))) / 100
    : Math.min(rawSubtotal, Math.max(0, numericDiscountVal));

  const afterDiscount = Math.max(0, rawSubtotal - discountAmount);

  // Tax
  const numericTaxRate = Number(taxRate) || 0;
  const taxAmount = (afterDiscount * Math.max(0, numericTaxRate)) / 100;

  // Total Invoiced Amount
  const totalInvoicedAmount = Math.round((afterDiscount + taxAmount) * 100) / 100;

  // If editing an invoice with payments, lock values
  const currentPaid = editingInvoice ? (Number(editingInvoice.amountPaid) || 0) : 0;
  const calculatedBalanceDue = Math.max(0, totalInvoicedAmount - currentPaid);

  // Line Item Handlers
  const handleAddItem = () => {
    if (isLockedInvoice) return;
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: '',
        unit: 'pcs',
        quantity: 1,
        unitPrice: '',
        amount: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (isLockedInvoice) return;
    if (items.length <= 1) {
      setItems([{
        id: Date.now().toString(),
        description: '',
        unit: 'pcs',
        quantity: 1,
        unitPrice: '',
        amount: 0
      }]);
      return;
    }
    setItems(items.filter(i => i.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
    if (isLockedInvoice) return;
    setItems(items.map(i => {
      if (i.id === id) {
        const updated = { ...i, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = Number(field === 'quantity' ? value : updated.quantity) || 0;
          const price = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0;
          updated.amount = qty * price;
        }
        return updated;
      }
      return i;
    }));
  };

  const handleCatalogSelect = (catalogItem: CatalogItem) => {
    if (isLockedInvoice) return;
    if (activeItemIndexForCatalog !== null && items[activeItemIndexForCatalog]) {
      const targetId = items[activeItemIndexForCatalog].id;
      setItems(items.map(i => {
        if (i.id === targetId) {
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
        }
        return i;
      }));
    }
    setActiveItemIndexForCatalog(null);
  };

  const handleResetToNew = () => {
    setEditingInvoiceId(null);
    setEditingInvoice(null);
    setIsLockedInvoice(false);
    setDocNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(todayStr);
    setDueDate(defaultDueDate);
    setBuilderMode('itemized');
    setRecipientType('walk_in');
    setSelectedClientId('');
    setSelectedLeadId('');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setLinkProject(false);
    setSelectedProjectId('');
    setFreeformDescription('Interior Design Planning & Turnkey Spatial Execution');
    setFreeformAmount('');
    setDiscountValue('');
    setTaxRate('');
    setItems([{ id: '1', description: '', unit: 'pcs', quantity: 1, unitPrice: '', amount: 0 }]);
    setPaymentMethodSelection('all');
    setNotes(getPaymentInstructions('all'));
    setActiveView('generator');
  };

  const handleLoadInvoice = (inv: SavedInvoice) => {
    setEditingInvoiceId(inv.id || null);
    setEditingInvoice(inv);
    const hasPayments = (Number(inv.amountPaid) || 0) > 0 || !!inv.isLocked;
    setIsLockedInvoice(hasPayments);

    setDocNumber(inv.docNumber || `INV-${new Date().getFullYear()}-001`);
    setDate(inv.date || todayStr);
    setDueDate(inv.dueDate || defaultDueDate);

    if (inv.invoiceMode === 'freeform') {
      setBuilderMode('freeform');
      setFreeformAmount(inv.totalInvoiced || inv.subtotal || '');
      setFreeformDescription(inv.items?.[0]?.description || 'Interior Spatial Service');
    } else {
      setBuilderMode('itemized');
      if (inv.items && inv.items.length > 0) {
        setItems(inv.items.map(i => ({
          id: i.id || Math.random().toString(),
          description: i.description || i.name || '',
          category: i.category,
          unit: i.unit || 'pcs',
          quantity: typeof i.quantity === 'number' ? i.quantity : 1,
          unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : (Number(i.amount) || 0),
          amount: Number(i.amount) || ((typeof i.quantity === 'number' ? i.quantity : 1) * (typeof i.unitPrice === 'number' ? i.unitPrice : 0))
        })));
      } else {
        setItems([{ id: '1', description: '', unit: 'pcs', quantity: 1, unitPrice: '', amount: 0 }]);
      }
    }

    setRecipientType(inv.recipientType || (inv.clientId ? 'client' : inv.leadId ? 'lead' : 'walk_in'));
    setSelectedClientId(inv.clientId || '');
    setSelectedLeadId(inv.leadId || '');
    setClientName(inv.clientName || '');
    setClientEmail(inv.clientEmail || '');
    setClientPhone(inv.clientPhone || '');

    setLinkProject(!!inv.projectId);
    setSelectedProjectId(inv.projectId || '');

    setDiscountType((inv.discountType as any) === 'percentage' ? 'percentage' : 'fixed');
    setDiscountValue(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || ''));
    setTaxRate(inv.taxRate !== undefined ? inv.taxRate : '');
    setNotes(inv.notes || getPaymentInstructions('all'));

    setActiveView('generator');
  };

  const handleDuplicateInvoice = (inv: SavedInvoice) => {
    handleResetToNew();
    setDocNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(todayStr);
    setDueDate(defaultDueDate);

    if (inv.invoiceMode === 'freeform') {
      setBuilderMode('freeform');
      setFreeformAmount(inv.totalInvoiced || inv.subtotal || '');
      setFreeformDescription(inv.items?.[0]?.description || 'Interior Spatial Service');
    } else {
      setBuilderMode('itemized');
      if (inv.items && inv.items.length > 0) {
        setItems(inv.items.map(i => ({
          ...i,
          id: Math.random().toString()
        })));
      }
    }

    setRecipientType(inv.recipientType || (inv.clientId ? 'client' : inv.leadId ? 'lead' : 'walk_in'));
    setSelectedClientId(inv.clientId || '');
    setSelectedLeadId(inv.leadId || '');
    setClientName(inv.clientName || '');
    setClientEmail(inv.clientEmail || '');
    setClientPhone(inv.clientPhone || '');
    setLinkProject(!!inv.projectId);
    setSelectedProjectId(inv.projectId || '');
    setDiscountType((inv.discountType as any) === 'percentage' ? 'percentage' : 'fixed');
    setDiscountValue(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || ''));
    setTaxRate(inv.taxRate !== undefined ? inv.taxRate : '');
    setNotes(inv.notes || getPaymentInstructions('all'));

    setActiveView('generator');
  };

  // Build clean items for persistence and PDF
  const getCleanLineItems = (): InvoiceLineItem[] => {
    if (builderMode === 'freeform') {
      return [{
        id: '1',
        description: freeformDescription.trim() || 'Interior Design & Spatial Planning Services',
        unit: 'lump sum',
        quantity: 1,
        unitPrice: Number(freeformAmount) || 0,
        amount: Number(freeformAmount) || 0
      }];
    }

    return items
      .filter(i => i.description.trim() || Number(i.unitPrice) > 0)
      .map(i => ({
        id: i.id || Math.random().toString(),
        description: i.description.trim() || 'Custom Interior Material / Service',
        category: i.category,
        unit: i.unit || 'pcs',
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        amount: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0)
      }));
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

    const cleanItems = getCleanLineItems();

    // Auto-calculate status purely from math:
    // If new invoice, amountPaid is 0 -> 'sent' (Unpaid)
    // If existing invoice, compare existing amountPaid to total
    const existingPaid = editingInvoice ? (Number(editingInvoice.amountPaid) || 0) : 0;
    const finalBalanceDue = Math.max(0, totalInvoicedAmount - existingPaid);
    const finalStatus: InvoiceStatus = existingPaid >= totalInvoicedAmount && totalInvoicedAmount > 0
      ? 'paid'
      : existingPaid > 0
      ? 'partial'
      : 'sent';

    const selectedProj = linkProject && selectedProjectId 
      ? projectsList.find(p => p.id === selectedProjectId)
      : null;

    const invoicePayload: Record<string, any> = cleanPayload({
      docNumber,
      date,
      dueDate,
      invoiceMode: builderMode,
      recipientType,
      clientId: recipientType === 'client' && selectedClientId ? selectedClientId : undefined,
      leadId: recipientType === 'lead' && selectedLeadId ? selectedLeadId : undefined,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      projectId: linkProject && selectedProjectId ? selectedProjectId : undefined,
      projectName: selectedProj ? (selectedProj.name || selectedProj.title || 'Project') : undefined,
      items: cleanItems,
      subtotal: rawSubtotal,
      discount: discountAmount > 0 ? discountAmount : undefined,
      discountType: discountAmount > 0 ? discountType : undefined,
      discountValue: discountAmount > 0 && numericDiscountVal > 0 ? numericDiscountVal : undefined,
      taxRate: numericTaxRate > 0 ? numericTaxRate : undefined,
      taxAmount: taxAmount > 0 ? taxAmount : undefined,
      totalInvoiced: totalInvoicedAmount,
      amountPaid: existingPaid,
      balanceDue: finalBalanceDue,
      notes: notes.trim(),
      status: finalStatus,
      isLocked: isLockedInvoice,
      selectedPaymentMethod: paymentMethodSelection,
      updatedAt: new Date().toISOString(),
      createdBy: profile?.name || 'Owner'
    });

    if (editingInvoiceId) {
      await updateDoc(doc(db, 'invoices', editingInvoiceId), invoicePayload);
      setSaveSuccessMessage(`Invoice ${docNumber} updated in archive!`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      return editingInvoiceId;
    } else {
      invoicePayload.createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'invoices'), invoicePayload);
      setEditingInvoiceId(docRef.id);
      setSaveSuccessMessage(`Invoice ${docNumber} created and saved to archive!`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      return docRef.id;
    }
  };

  // Build PDF line items for jsPDF generator
  const buildPDFLineItems = (cleanItems: InvoiceLineItem[]): PDFLineItem[] => {
    return cleanItems.map(i => ({
      id: i.id,
      description: i.unit ? `${i.description} (${i.quantity} ${i.unit})` : i.description,
      quantity: typeof i.quantity === 'number' ? i.quantity : 1,
      unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : 0,
      amount: Number(i.amount) || ((typeof i.quantity === 'number' ? i.quantity : 1) * (typeof i.unitPrice === 'number' ? i.unitPrice : 0))
    }));
  };

  // Requirement 5: Replaced separate "Download Invoice" and "Save to Archive" buttons
  // with a single "Create Invoice" button that saves to archive AND generates download
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

      const cleanItems = getCleanLineItems();
      const pdfItems = buildPDFLineItems(cleanItems);
      const existingPaid = editingInvoice ? (Number(editingInvoice.amountPaid) || 0) : 0;
      const finalBal = Math.max(0, totalInvoicedAmount - existingPaid);
      const selectedProj = linkProject && selectedProjectId 
        ? projectsList.find(p => p.id === selectedProjectId)
        : null;

      // 2. Generate and download PDF
      await generateDocumentPDF('invoice', {
        docNumber,
        date,
        dueDate,
        invoiceMode: builderMode === 'itemized' ? 'pay_later' : 'walk_in',
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        projectName: selectedProj ? (selectedProj.name || selectedProj.title) : undefined,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Custom Spatial Planning Services',
          quantity: 1,
          unitPrice: totalInvoicedAmount
        }],
        subtotal: rawSubtotal,
        discount: discountAmount > 0 ? discountAmount : undefined,
        taxRate: numericTaxRate > 0 ? numericTaxRate : undefined,
        taxAmount: taxAmount > 0 ? taxAmount : undefined,
        totalInvoiced: totalInvoicedAmount,
        amountPaid: existingPaid,
        balanceDue: finalBal,
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
      await saveInvoiceToFirestore();

      const cleanItems = getCleanLineItems();
      const pdfItems = buildPDFLineItems(cleanItems);
      const existingPaid = editingInvoice ? (Number(editingInvoice.amountPaid) || 0) : 0;
      const finalBal = Math.max(0, totalInvoicedAmount - existingPaid);
      const selectedProj = linkProject && selectedProjectId 
        ? projectsList.find(p => p.id === selectedProjectId)
        : null;

      await shareDocumentPDF('invoice', {
        docNumber,
        date,
        dueDate,
        invoiceMode: builderMode === 'itemized' ? 'pay_later' : 'walk_in',
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        projectName: selectedProj ? (selectedProj.name || selectedProj.title) : undefined,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Custom Spatial Planning Services',
          quantity: 1,
          unitPrice: totalInvoicedAmount
        }],
        subtotal: rawSubtotal,
        discount: discountAmount > 0 ? discountAmount : undefined,
        taxRate: numericTaxRate > 0 ? numericTaxRate : undefined,
        taxAmount: taxAmount > 0 ? taxAmount : undefined,
        totalInvoiced: totalInvoicedAmount,
        amountPaid: existingPaid,
        balanceDue: finalBal,
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
                ? "bg-ochre text-white shadow-md shadow-ochre/20"
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
                ? "bg-ochre text-white shadow-md shadow-ochre/20"
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
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-cream/30 border border-charcoal/15 rounded-xl text-xs font-bold text-charcoal focus:outline-none focus:border-ochre font-mono"
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
                <p className="text-xs text-charcoal/50">
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
                  <p className="text-[11px] text-charcoal/50">
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
                <p className="text-xs text-charcoal/50">
                  {builderMode === 'freeform'
                    ? 'Manually enter the overall service total/balance.'
                    : 'Type-ahead search pulls saved products and services with units of measure.'}
                </p>
              </div>

              {builderMode === 'itemized' && !isLockedInvoice && (
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-ochre/10 hover:bg-ochre/20 text-ochre text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Catalog Manager</span>
                </button>
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
                  <p className="text-[11px] text-charcoal/50 mt-1">
                    Owner manually sets the initial total. Payment status will be auto-calculated against logged payments.
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
                        <span className="text-xs font-bold text-charcoal/50">
                          Line Item #{index + 1}
                        </span>

                        {!isLockedInvoice && items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 text-charcoal/30 hover:text-red-600 transition-colors"
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Type-ahead Autocomplete for Material / Service */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                          Material / Service Name (Type-Ahead Search)
                        </label>
                        <CatalogAutocomplete
                          value={item.description}
                          onChange={(val) => handleUpdateItem(item.id, 'description', val)}
                          onSelectCatalogItem={(catalogItem) => {
                            setActiveItemIndexForCatalog(index);
                            handleCatalogSelect(catalogItem);
                          }}
                          onOpenCatalogModal={() => {
                            setActiveItemIndexForCatalog(index);
                            setIsCatalogModalOpen(true);
                          }}
                          placeholder="Type or pick from catalog (e.g. SPC Flooring, Gypsum Ceiling)..."
                          catalogItems={catalogItems}
                          inputClassName="bg-white border-charcoal/15 text-xs py-2.5 font-semibold"
                        />
                      </div>

                      {/* Quantity, Unit, Unit Price, Line Total */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
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
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
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
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
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
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal/60 mb-1">
                            Line Total (KES)
                          </label>
                          <div className="px-3 py-2 bg-cream/60 border border-charcoal/10 rounded-xl text-xs font-bold text-ochre flex items-center">
                            KES {formatMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                          </div>
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
                  <div className="flex items-center text-[10px] font-bold border border-charcoal/15 rounded-lg overflow-hidden">
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

              {/* Tax / VAT */}
              <div className="p-3.5 bg-cream/30 rounded-2xl border border-charcoal/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/70">
                    VAT / Tax Rate (Optional)
                  </label>
                  <span className="text-[10px] font-bold text-charcoal/40">e.g. 16% Kenya VAT</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  disabled={isLockedInvoice}
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Enter tax % (e.g. 16 for 16% VAT)"
                  className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre text-charcoal disabled:opacity-60"
                />
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

              {taxAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-300">
                  <span>VAT ({numericTaxRate}%)</span>
                  <span className="font-mono">+ KES {formatMoney(taxAmount)}</span>
                </div>
              )}

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

          {/* 4. Payment Details & Terms (Powered by Settings) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-charcoal/10 pb-4">
              <div>
                <h4 className="text-base font-bold text-charcoal flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-ochre" />
                  <span>Payment Instructions (Managed from Settings)</span>
                </h4>
                <p className="text-xs text-charcoal/50">
                  Pulls saved payment methods automatically without re-typing per invoice.
                </p>
              </div>

              {/* Method Selector Pills */}
              <div className="flex items-center gap-1 bg-cream/70 p-1 rounded-2xl border border-charcoal/10 flex-wrap">
                {(['all', 'bank', 'mpesa', 'cash', 'cheque'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethodSelection(m)}
                    className={cn(
                      "px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer",
                      paymentMethodSelection === m
                        ? "bg-white text-charcoal shadow-xs"
                        : "text-charcoal/60 hover:text-charcoal"
                    )}
                  >
                    {m === 'all' ? 'All Methods' : m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/60 mb-1.5">
                Invoice Payment Terms & Bank/M-Pesa Note
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3.5 bg-cream/30 border border-charcoal/15 rounded-2xl text-xs font-mono text-charcoal focus:outline-none focus:border-ochre leading-relaxed"
              />
              <p className="text-[11px] text-charcoal/40 mt-1">
                Updated from CMS Settings. You can also customize instructions directly above.
              </p>
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
                className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-ochre/25 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {creationStep === 'saving' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Archive...</span>
                  </>
                ) : creationStep === 'generating' ? (
                  <>
                    <Download className="w-4 h-4 animate-bounce" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-charcoal/15 shadow-2xl p-6 sm:p-8 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h3 className="text-base font-bold text-charcoal">Add Manual Customer / Lead</h3>
              <button
                onClick={() => setShowNewLeadModal(false)}
                className="p-1 rounded-xl text-charcoal/40 hover:text-charcoal"
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
                  className="px-5 py-2 rounded-xl bg-ochre text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-ochre/20"
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
    </div>
  );
}
