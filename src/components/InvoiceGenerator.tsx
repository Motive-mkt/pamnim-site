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
  CreditCard, Check, ArrowRight, Save, History, X, Share2
} from 'lucide-react';
import { generateDocumentPDF, shareDocumentPDF, formatMoney } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';
import CatalogManagerModal from './CatalogManagerModal';
import CatalogAutocomplete from './CatalogAutocomplete';
import SavedInvoicesList from './SavedInvoicesList';
import { CatalogItem } from '../types/catalog';
import { SavedInvoice, InvoiceStatus, InvoiceMode, Lead } from '../types/documents';

export interface InvoicePaymentItem {
  id: string;
  name: string; // Name of client / item
  paymentType: 'Partial' | 'Full';
  amount: number | '';
  refCode: string;
  date: string;
}

export default function InvoiceGenerator() {
  const { content } = useCMS();
  const { profile } = useAuth();

  const defaultInvoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Document Info
  const [docNumber, setDocNumber] = useState(defaultInvoiceNumber);
  const [date, setDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [invoiceMode, setInvoiceMode] = useState<InvoiceMode>('pay_later');

  // Adjustments: Discount & Tax/VAT
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [taxRate, setTaxRate] = useState<number | ''>(''); // e.g. 16 for 16% VAT
  const [isSharing, setIsSharing] = useState(false);

  // Client Selection
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCustomClient, setIsCustomClient] = useState<boolean>(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Project Selection & Subcollection link
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [existingPayments, setExistingPayments] = useState<any[]>([]);
  const [totalInvoiced, setTotalInvoiced] = useState<number | ''>('');

  // Notes - Default editable text kept as requested (powered by Settings)
  const defaultPaymentDetails = content.contact.paymentDetails || 'Bank / M-Pesa Details: Pamnim Interior Designers, Paybill: 247247, Acc: 0714984268.';
  const [notes, setNotes] = useState(
    `Payment Terms: 50% deposit upon contract signing, 40% upon interim milestone, 10% upon final handover.\n${defaultPaymentDetails}`
  );

  useEffect(() => {
    if (content.contact.paymentDetails) {
      setNotes(prev => {
        if (!prev || prev.includes('Paybill: 247247, Acc: 0714984268.')) {
          return `Payment Terms: 50% deposit upon contract signing, 40% upon interim milestone, 10% upon final handover.\n${content.contact.paymentDetails}`;
        }
        return prev;
      });
    }
  }, [content.contact.paymentDetails]);

  // Invoice Line Items: Blank by default (no placeholder data)
  const [items, setItems] = useState<InvoicePaymentItem[]>([
    {
      id: '1',
      name: '',
      paymentType: 'Partial',
      amount: '',
      refCode: '',
      date: todayStr
    }
  ]);

  // Catalog State
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [activeItemIndexForCatalog, setActiveItemIndexForCatalog] = useState<number | null>(null);

  // UI status
  const [isGenerating, setIsGenerating] = useState(false);
  const [invoiceCreationStep, setInvoiceCreationStep] = useState<'idle' | 'saving' | 'generating'>('idle');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Archive & Edit State
  const [activeView, setActiveView] = useState<'generator' | 'archive'>('generator');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
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
        console.error('Error fetching clients for invoice:', err);
      }
    };
    fetchClients();
  }, []);

  // 1b. Fetch Leads
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Lead[];
        setLeadsList(list);
      } catch (err) {
        console.error('Error fetching leads for invoice:', err);
      }
    };
    fetchLeads();
  }, []);

  // 2. Fetch Projects (all staff projects)
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjectsList(list);
      } catch (err) {
        console.error('Error fetching projects for invoice:', err);
      }
    };
    fetchProjects();
  }, []);

  // 3. Listen to Catalog
  useEffect(() => {
    const q = query(collection(db, 'servicesMaterials'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setCatalogItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CatalogItem[]);
    }, (err) => console.error('Error fetching catalog:', err));
    return () => unsub();
  }, []);

  // 4. Listen to Project's Payments subcollection when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProject(null);
      setExistingPayments([]);
      return;
    }

    const proj = projectsList.find(p => p.id === selectedProjectId);
    if (proj) {
      setSelectedProject(proj);
      if (typeof proj.totalCost === 'number' && proj.totalCost > 0) {
        setTotalInvoiced(proj.totalCost);
      }
    }

    const paymentsRef = collection(db, 'projects', selectedProjectId, 'payments');
    const unsub = onSnapshot(paymentsRef, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExistingPayments(list);
    }, (err) => {
      console.error('Error reading project payments:', err);
    });

    return () => unsub();
  }, [selectedProjectId, projectsList]);

  // Handle client dropdown change
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId === 'NEW_CLIENT') {
      setIsCustomClient(true);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setSelectedProjectId('');
    } else if (clientId === '') {
      setIsCustomClient(false);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setSelectedProjectId('');
    } else if (clientId.startsWith('LEAD_')) {
      setIsCustomClient(false);
      const leadId = clientId.replace('LEAD_', '');
      const lead = leadsList.find(l => l.id === leadId);
      if (lead) {
        setClientName(lead.name || '');
        setClientEmail(lead.email || '');
        setClientPhone(lead.phone || '');
        setSelectedProjectId('');
      }
    } else {
      setIsCustomClient(false);
      const found = clientsList.find(c => c.id === clientId || c.uid === clientId);
      if (found) {
        setClientName(found.name || found.displayName || '');
        setClientEmail(found.email || '');
        setClientPhone(found.phone || found.phoneNumber || '');

        // Auto-select project if client has matching project
        const clientProjects = projectsList.filter(p => p.clientId === found.id || p.clientId === found.uid);
        if (clientProjects.length === 1) {
          setSelectedProjectId(clientProjects[0].id);
        }
      }
    }
  };

  // Financial Calculations
  const newPaymentsSum = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const existingPaymentsSum = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  // Base Subtotal before discounts and tax
  const baseSubtotal = typeof totalInvoiced === 'number' && totalInvoiced > 0
    ? totalInvoiced
    : (newPaymentsSum + existingPaymentsSum);

  // Discount Calculation
  const numericDiscountVal = Number(discountValue) || 0;
  const discountAmount = discountType === 'percentage'
    ? (baseSubtotal * Math.min(100, Math.max(0, numericDiscountVal))) / 100
    : Math.min(baseSubtotal, Math.max(0, numericDiscountVal));

  const afterDiscount = Math.max(0, baseSubtotal - discountAmount);

  // Tax/VAT Calculation (e.g. 16% in Kenya)
  const numericTaxRate = Number(taxRate) || 0;
  const taxAmount = (afterDiscount * Math.max(0, numericTaxRate)) / 100;

  // Effective Total Invoiced (Subtotal - Discount + Tax)
  const effectiveTotalInvoiced = Math.round((afterDiscount + taxAmount) * 100) / 100;

  const totalPaymentsLogged = existingPaymentsSum + newPaymentsSum;
  // Automatically calculated: Total Invoiced - sum of payments logged against that invoice/project
  const outstandingBalance = Math.max(0, effectiveTotalInvoiced - totalPaymentsLogged);

  // Line Item Handlers
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        name: '',
        paymentType: 'Partial',
        amount: '',
        refCode: '',
        date: todayStr
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setItems([{
        id: Date.now().toString(),
        name: '',
        paymentType: 'Partial',
        amount: '',
        refCode: '',
        date: todayStr
      }]);
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof InvoicePaymentItem, value: any) => {
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
          name: catalogItem.name,
          amount: catalogItem.sellingPrice || item.amount
        };
      }
      return item;
    }));
  };

  // Link & Sync: write payments directly to projects/{projectId}/payments subcollection
  const recordPaymentsToProjectTracker = async (): Promise<boolean> => {
    if (!selectedProjectId) return true;

    // Filter valid payment items with positive amounts
    const validItems = items.filter(i => Number(i.amount) > 0);
    if (validItems.length === 0) return true;

    try {
      const paymentsRef = collection(db, 'projects', selectedProjectId, 'payments');
      for (const item of validItems) {
        await addDoc(paymentsRef, {
          amount: Number(item.amount),
          date: new Date(item.date).toISOString(),
          method: item.paymentType === 'Full' ? 'full_payment' : 'partial_payment',
          paymentType: item.paymentType,
          reference: item.refCode || 'N/A',
          note: `${item.name || 'Invoice Payment'} (${docNumber})`,
          recordedBy: profile?.name || 'Owner',
          createdAt: new Date().toISOString()
        });
      }
      return true;
    } catch (err) {
      console.error('Error writing to project payments subcollection:', err);
      return false;
    }
  };

  const handleCreateNew = () => {
    setEditingInvoiceId(null);
    setDocNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(todayStr);
    setDueDate(defaultDueDate);
    setInvoiceMode('pay_later');
    setSelectedClientId('');
    setIsCustomClient(false);
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setSelectedProjectId('');
    setSelectedProject(null);
    setTotalInvoiced('');
    setDiscountType('fixed');
    setDiscountValue('');
    setTaxRate('');
    setItems([{ id: '1', name: '', paymentType: 'Partial', amount: '', refCode: '', date: todayStr }]);
    setActiveView('generator');
  };

  const handleLoadInvoice = (inv: SavedInvoice) => {
    setEditingInvoiceId(inv.id || null);
    setDocNumber(inv.docNumber || `INV-${new Date().getFullYear()}-001`);
    setDate(inv.date || todayStr);
    setDueDate(inv.dueDate || defaultDueDate);
    setInvoiceMode(inv.invoiceMode || 'pay_later');
    setSelectedClientId(inv.clientId || '');
    setIsCustomClient(!inv.clientId);
    setClientName(inv.clientName || '');
    setClientEmail(inv.clientEmail || '');
    setClientPhone(inv.clientPhone || '');
    setSelectedProjectId(inv.projectId || '');
    setTotalInvoiced(inv.subtotal || inv.totalInvoiced || '');
    setDiscountType(inv.discountType || 'fixed');
    setDiscountValue(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || ''));
    setTaxRate(inv.taxRate !== undefined ? inv.taxRate : '');
    setNotes(inv.notes || defaultPaymentDetails);
    if (inv.items && inv.items.length > 0) {
      setItems(inv.items);
    } else {
      setItems([{ id: '1', name: '', paymentType: 'Partial', amount: '', refCode: '', date: todayStr }]);
    }
    setActiveView('generator');
  };

  const handleDuplicateInvoice = (inv: SavedInvoice) => {
    setEditingInvoiceId(null);
    setDocNumber(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setDate(todayStr);
    setDueDate(defaultDueDate);
    setInvoiceMode(inv.invoiceMode || 'pay_later');
    setSelectedClientId(inv.clientId || '');
    setIsCustomClient(!inv.clientId);
    setClientName(inv.clientName || '');
    setClientEmail(inv.clientEmail || '');
    setClientPhone(inv.clientPhone || '');
    setSelectedProjectId(inv.projectId || '');
    setTotalInvoiced(inv.subtotal || inv.totalInvoiced || '');
    setDiscountType(inv.discountType || 'fixed');
    setDiscountValue(inv.discountValue !== undefined ? inv.discountValue : (inv.discount || ''));
    setTaxRate(inv.taxRate !== undefined ? inv.taxRate : '');
    setNotes(inv.notes || defaultPaymentDetails);
    if (inv.items && inv.items.length > 0) {
      setItems(inv.items.map(i => ({ ...i, id: Math.random().toString(), date: todayStr })));
    }
    setActiveView('generator');
  };

  const saveInvoiceToFirestore = async (customStatus?: InvoiceStatus): Promise<string | null> => {
    if (!clientName.trim()) {
      alert('Please provide a client name before saving.');
      return null;
    }

    try {
      setIsSavingDraft(true);

      const cleanedItems = items.map(i => {
        const itemObj: Record<string, any> = {
          id: i.id || Math.random().toString(),
          name: i.name || '',
          paymentType: i.paymentType || 'Partial',
          amount: i.amount === '' ? 0 : Number(i.amount) || 0,
          date: i.date || todayStr
        };
        if (i.refCode && i.refCode.trim()) {
          itemObj.refCode = i.refCode.trim();
        }
        return itemObj;
      });

      const invoiceData: Record<string, any> = {
        docNumber,
        date,
        dueDate,
        invoiceMode,
        clientName: clientName.trim(),
        items: cleanedItems,
        subtotal: baseSubtotal,
        discount: discountAmount,
        discountType,
        taxAmount,
        totalInvoiced: Number(effectiveTotalInvoiced) || 0,
        amountPaid: Number(totalPaymentsLogged) || 0,
        balanceDue: Number(outstandingBalance) || 0,
        notes,
        status: customStatus || (outstandingBalance <= 0 && Number(effectiveTotalInvoiced) > 0 ? 'paid' : totalPaymentsLogged > 0 ? 'partial' : 'sent'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: profile?.name || 'Owner'
      };

      if (selectedClientId && selectedClientId.trim()) {
        invoiceData.clientId = selectedClientId.trim();
      }
      if (clientEmail && clientEmail.trim()) {
        invoiceData.clientEmail = clientEmail.trim();
      }
      if (clientPhone && clientPhone.trim()) {
        invoiceData.clientPhone = clientPhone.trim();
      }
      if (selectedProjectId && selectedProjectId.trim()) {
        invoiceData.projectId = selectedProjectId.trim();
      }
      if (selectedProject?.name) {
        invoiceData.projectName = selectedProject.name;
      }
      if (typeof discountValue === 'number') {
        invoiceData.discountValue = discountValue;
      }
      if (typeof taxRate === 'number') {
        invoiceData.taxRate = taxRate;
      }

      if (editingInvoiceId) {
        await updateDoc(doc(db, 'invoices', editingInvoiceId), {
          ...invoiceData,
          updatedAt: new Date().toISOString()
        });
        setSaveSuccessMessage(`Invoice ${docNumber} updated in archive!`);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        return editingInvoiceId;
      } else {
        const docRef = await addDoc(collection(db, 'invoices'), invoiceData);
        setEditingInvoiceId(docRef.id);
        setSaveSuccessMessage(`Invoice ${docNumber} saved to archive!`);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        return docRef.id;
      }
    } catch (err: any) {
      console.error('Error saving invoice to Firestore:', err);
      const errMsg = err?.message || String(err);
      alert(`Failed to save invoice to archive. ${errMsg}`);
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
      setInvoiceCreationStep('saving');

      // If tied to a project, write payment line items into projects/{projectId}/payments subcollection
      if (selectedProjectId) {
        const synced = await recordPaymentsToProjectTracker();
        if (synced) {
          setSyncMessage('Payments synchronized with Project Tracker!');
          setTimeout(() => setSyncMessage(null), 5000);
        }
      }

      // Automatically save/update in Firestore archive first
      const savedDocId = await saveInvoiceToFirestore();
      if (!savedDocId) {
        // Saving failed! Do NOT proceed to generate or download the PDF
        setIsGenerating(false);
        setInvoiceCreationStep('idle');
        return;
      }

      // Proceed to generate and download PDF
      setInvoiceCreationStep('generating');

      // Format PDF items matching the invoice columns: Name/Item, Payment Type, Ref Code, Date, Amount
      const pdfItems = items
        .filter(i => i.name.trim() || Number(i.amount) > 0)
        .map(i => ({
          id: i.id,
          description: i.name || 'Payment Item',
          paymentType: i.paymentType,
          refCode: i.refCode || '—',
          date: i.date,
          amount: Number(i.amount) || 0,
          quantity: 1,
          unitPrice: Number(i.amount) || 0
        }));

      const pdfData = {
        docNumber,
        date,
        dueDate,
        invoiceMode,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        projectName: selectedProject ? selectedProject.name : undefined,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Payment Item',
          paymentType: 'Partial' as const,
          refCode: '—',
          date,
          amount: 0,
          quantity: 1,
          unitPrice: 0
        }],
        subtotal: baseSubtotal,
        discount: discountAmount,
        taxRate: typeof taxRate === 'number' ? taxRate : undefined,
        taxAmount,
        totalInvoiced: Number(effectiveTotalInvoiced),
        amountPaid: Number(totalPaymentsLogged),
        balanceDue: Number(outstandingBalance),
        notes,
        currencySymbol: 'KES',
        companyInfo: {
          name: 'Pamnim Interior Designers',
          address: content.contact?.address || 'Nairobi, Kenya',
          phone: content.contact?.phone || '0714 984 268',
          email: content.contact?.email || 'hinteriors01@gmail.com',
          tagline: 'Shinning outside, beautiful inside'
        }
      };

      await generateDocumentPDF('invoice', pdfData);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Invoice generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
      setInvoiceCreationStep('idle');
    }
  };

  const handleShare = async () => {
    if (!clientName.trim()) {
      alert('Please provide a client name.');
      return;
    }

    try {
      setIsSharing(true);

      // If tied to a project, write payment line items into projects/{projectId}/payments subcollection
      if (selectedProjectId) {
        await recordPaymentsToProjectTracker();
      }

      // Automatically save/update in Firestore archive
      await saveInvoiceToFirestore();

      // Format PDF items matching the invoice columns
      const pdfItems = items
        .filter(i => i.name.trim() || Number(i.amount) > 0)
        .map(i => ({
          id: i.id,
          description: i.name || 'Payment Item',
          paymentType: i.paymentType,
          refCode: i.refCode || '—',
          date: i.date,
          amount: Number(i.amount) || 0,
          quantity: 1,
          unitPrice: Number(i.amount) || 0
        }));

      const pdfData = {
        docNumber,
        date,
        dueDate,
        invoiceMode,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        projectName: selectedProject ? selectedProject.name : undefined,
        items: pdfItems.length > 0 ? pdfItems : [{
          id: '1',
          description: 'Payment Item',
          paymentType: 'Partial' as const,
          refCode: '—',
          date,
          amount: 0,
          quantity: 1,
          unitPrice: 0
        }],
        subtotal: baseSubtotal,
        discount: discountAmount,
        taxRate: typeof taxRate === 'number' ? taxRate : undefined,
        taxAmount,
        totalInvoiced: Number(effectiveTotalInvoiced),
        amountPaid: Number(totalPaymentsLogged),
        balanceDue: Number(outstandingBalance),
        notes,
        currencySymbol: 'KES',
        companyInfo: {
          name: 'Pamnim Interior Designers',
          address: content.contact?.address || 'Nairobi, Kenya',
          phone: content.contact?.phone || '0714 984 268',
          email: content.contact?.email || 'hinteriors01@gmail.com',
          tagline: 'Shinning outside, beautiful inside'
        }
      };

      await shareDocumentPDF('invoice', pdfData);
    } catch (err) {
      console.error('Invoice share failed:', err);
      alert('Could not initiate share. Please try again.');
    } finally {
      setIsSharing(false);
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
          <h2 className="text-2xl font-bold text-charcoal">Invoice Management</h2>
          <p className="text-xs text-charcoal/60 mt-0.5">
            Create branded invoices with automated balance calculation, project tracker synchronization, and saved archive.
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
            <FileText className="w-3.5 h-3.5 text-red-600" />
            <span>{editingInvoiceId ? 'Edit Invoice' : 'New Invoice'}</span>
            {editingInvoiceId && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md font-mono">
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
            <span>Saved Invoices</span>
          </button>
        </div>
      </div>

      {/* Editing Saved Invoice Notice Bar */}
      {activeView === 'generator' && editingInvoiceId && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Currently editing archived invoice <strong className="font-mono">{docNumber}</strong> for <strong>{clientName || 'Client'}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleCreateNew}
            className="text-xs font-bold text-amber-900 hover:text-black underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Switch to Blank Invoice</span>
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

      {syncMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Conditional View: Archive vs Generator Form */}
      {activeView === 'archive' ? (
        <SavedInvoicesList
          onLoadInvoice={handleLoadInvoice}
          onDuplicateInvoice={handleDuplicateInvoice}
          onCreateNew={handleCreateNew}
        />
      ) : (
      <form onSubmit={handleGenerate} className="space-y-8">
        {/* Document Meta, Client & Project Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 sm:p-6 bg-cream/40 rounded-2xl border border-charcoal/5">
          {/* Column 1: Document Metadata */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal/70 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-ochre" />
              <span>Invoice Details</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Invoice Number</label>
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-red-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Invoice Mode</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-charcoal/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setInvoiceMode('pay_later')}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer",
                    invoiceMode === 'pay_later'
                      ? "bg-ochre text-white shadow-xs"
                      : "text-charcoal/60 hover:text-charcoal"
                  )}
                >
                  Pay Later
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceMode('walk_in')}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all text-center cursor-pointer",
                    invoiceMode === 'walk_in'
                      ? "bg-ochre text-white shadow-xs"
                      : "text-charcoal/60 hover:text-charcoal"
                  )}
                >
                  Walk-in
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Client Dropdown (+ New Client free text option) */}
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
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-600 cursor-pointer"
              >
                <option value="">-- Choose Existing Client / Lead --</option>
                {clientsList.length > 0 && (
                  <optgroup label="Registered Clients">
                    {clientsList.map((c) => (
                      <option key={c.id || c.uid} value={c.id || c.uid}>
                        {c.name || c.displayName || c.email} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {leadsList.length > 0 && (
                  <optgroup label="Website Inquiries & Leads">
                    {leadsList.map((lead) => (
                      <option key={lead.id} value={`LEAD_${lead.id}`}>
                        {lead.name} {lead.phone ? `(${lead.phone})` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Custom / Other">
                  <option value="NEW_CLIENT">+ New client (Enter details manually)</option>
                </optgroup>
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
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-bold focus:outline-none focus:border-red-600"
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
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-charcoal/50 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+254 7..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-red-600"
                />
              </div>
            </div>
          </div>

          {/* Column 3: Link to Project Tracker */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal/70 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-ochre" />
              <span>Link to Project Tracker</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                Active Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-600"
              >
                <option value="">Standalone (No Project Link)</option>
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.clientName ? `— ${p.clientName}` : ''} ({p.currentStageName || 'In Progress'})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-charcoal/50 mt-1">
                Linking a project syncs payments into its tracker ledger.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                Total Invoiced Amount (KES)
              </label>
              <input
                type="number"
                min="0"
                placeholder={selectedProject?.totalCost ? `KES ${formatMoney(selectedProject.totalCost)}` : 'e.g. 500000'}
                value={totalInvoiced}
                onChange={(e) => setTotalInvoiced(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full p-2.5 bg-white border border-charcoal/10 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-red-600"
              />
              <span className="text-[10px] text-charcoal/40">
                {selectedProject ? 'Auto-loaded from Project Contract Cost' : 'Leave blank to sum payments'}
              </span>
            </div>

            {selectedProject && existingPayments.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-charcoal/10 text-xs space-y-1">
                <div className="flex justify-between font-medium text-charcoal/70">
                  <span>Prior Payments Logged:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    KES {formatMoney(existingPaymentsSum)}
                  </span>
                </div>
                <div className="text-[10px] text-charcoal/40">
                  {existingPayments.length} payment records previously logged on this project.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Payment Line Items Table */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-charcoal flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-red-600" />
                <span>Payment Line Items</span>
              </h3>
              <p className="text-xs text-charcoal/50">
                Specify payment items with type, amount, reference code, and date.
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
                <span>Insert from Catalog</span>
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 bg-charcoal hover:bg-charcoal/80 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Payment Line</span>
              </button>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-charcoal/10 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-charcoal text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="p-3.5 pl-4">Name of Client / Item</th>
                    <th className="p-3.5 w-36">Payment Type</th>
                    <th className="p-3.5 w-40">Amount (KES) *</th>
                    <th className="p-3.5 w-44">Reference Code</th>
                    <th className="p-3.5 w-36">Date</th>
                    <th className="p-3.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5 text-xs">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-cream/20 transition-all">
                      {/* 1. Name of client / item with Catalog Autocomplete */}
                      <td className="p-3 pl-4">
                        <CatalogAutocomplete
                          value={item.name}
                          onChange={(val) => handleUpdateItem(item.id, 'name', val)}
                          onSelectCatalogItem={(catItem) => handleLineItemCatalogSelect(item.id, catItem)}
                          catalogItems={catalogItems}
                          placeholder="e.g. Deposit for living room joinery & gypsum"
                          inputClassName="focus:border-red-600"
                          onOpenCatalogModal={() => {
                            setActiveItemIndexForCatalog(index);
                            setIsCatalogOpen(true);
                          }}
                        />
                      </td>

                      {/* 2. Payment Type (Partial / Full dropdown) */}
                      <td className="p-3">
                        <select
                          value={item.paymentType}
                          onChange={(e) => handleUpdateItem(item.id, 'paymentType', e.target.value as 'Partial' | 'Full')}
                          className="w-full p-2 bg-transparent border border-charcoal/10 rounded-lg text-xs font-bold focus:outline-none focus:border-red-600"
                        >
                          <option value="Partial">Partial</option>
                          <option value="Full">Full</option>
                        </select>
                      </td>

                      {/* 3. Amount */}
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="10"
                          placeholder="0"
                          value={item.amount}
                          onChange={(e) => handleUpdateItem(item.id, 'amount', e.target.value ? parseFloat(e.target.value) : '')}
                          className="w-full p-2 bg-transparent border border-charcoal/10 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-red-600 text-right"
                        />
                      </td>

                      {/* 4. Reference Code */}
                      <td className="p-3">
                        <input
                          type="text"
                          placeholder="e.g. QA249XYZ / MPESA"
                          value={item.refCode}
                          onChange={(e) => handleUpdateItem(item.id, 'refCode', e.target.value)}
                          className="w-full p-2 bg-transparent border border-charcoal/10 rounded-lg text-xs font-mono focus:outline-none focus:border-red-600"
                        />
                      </td>

                      {/* 5. Date */}
                      <td className="p-3">
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleUpdateItem(item.id, 'date', e.target.value)}
                          className="w-full p-2 bg-transparent border border-charcoal/10 rounded-lg text-xs focus:outline-none focus:border-red-600"
                        />
                      </td>

                      {/* Remove Button */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-charcoal/30 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Financial Summary & Automated Balance Calculation */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 p-6 bg-cream/30 rounded-2xl border border-charcoal/10">
          {/* Notes & Payment Instructions (Kept as editable default) */}
          <div className="w-full md:w-1/2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70">
                Payment Instructions & Notes
              </label>
              {content.contact?.paymentDetailsByMethod && (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-charcoal/40 font-bold uppercase">Insert:</span>
                  {content.contact.paymentDetailsByMethod.mpesa && (
                    <button
                      type="button"
                      onClick={() => setNotes(prev => `${prev}\n\n${content.contact.paymentDetailsByMethod?.mpesa}`.trim())}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100 cursor-pointer"
                    >
                      M-Pesa
                    </button>
                  )}
                  {content.contact.paymentDetailsByMethod.bank && (
                    <button
                      type="button"
                      onClick={() => setNotes(prev => `${prev}\n\n${content.contact.paymentDetailsByMethod?.bank}`.trim())}
                      className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-bold hover:bg-blue-100 cursor-pointer"
                    >
                      Bank
                    </button>
                  )}
                  {content.contact.paymentDetailsByMethod.cash && (
                    <button
                      type="button"
                      onClick={() => setNotes(prev => `${prev}\n\n${content.contact.paymentDetailsByMethod?.cash}`.trim())}
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      Cash
                    </button>
                  )}
                  {content.contact.paymentDetailsByMethod.cheque && (
                    <button
                      type="button"
                      onClick={() => setNotes(prev => `${prev}\n\n${content.contact.paymentDetailsByMethod?.cheque}`.trim())}
                      className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-bold hover:bg-purple-100 cursor-pointer"
                    >
                      Cheque
                    </button>
                  )}
                </div>
              )}
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs text-charcoal/80 focus:outline-none focus:border-red-600 leading-relaxed font-sans"
            />
            <p className="text-[10px] text-charcoal/50">
              This text appears on the generated PDF invoice.
            </p>
          </div>

          {/* Calculated Totals Box */}
          <div className="w-full md:w-80 space-y-3 bg-white p-5 rounded-2xl border border-charcoal/10 shadow-sm shrink-0">
            {/* Base Subtotal */}
            <div className="flex items-center justify-between text-xs text-charcoal/60">
              <span>Subtotal:</span>
              <span className="font-mono font-bold text-charcoal">
                KES {formatMoney(baseSubtotal)}
              </span>
            </div>

            {/* Discount adjustment */}
            <div className="pt-2 border-t border-charcoal/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">
                  Discount
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all",
                      discountType === 'fixed' ? "bg-charcoal text-white" : "bg-cream text-charcoal/60 hover:text-charcoal"
                    )}
                  >
                    KES
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all",
                      discountType === 'percentage' ? "bg-charcoal text-white" : "bg-cream text-charcoal/60 hover:text-charcoal"
                    )}
                  >
                    %
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={discountType === 'percentage' ? 'e.g. 5%' : '0'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full p-2 bg-cream/40 border border-charcoal/10 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-red-600 text-right"
                />
                {discountAmount > 0 && (
                  <span className="text-xs font-mono font-bold text-emerald-700 whitespace-nowrap">
                    -KES {formatMoney(discountAmount)}
                  </span>
                )}
              </div>
            </div>

            {/* Tax / VAT adjustment */}
            <div className="pt-2 border-t border-charcoal/5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-charcoal/60">
                  Tax / VAT Rate (%)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTaxRate('')}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all",
                      !taxRate ? "bg-charcoal text-white" : "bg-cream text-charcoal/60 hover:text-charcoal"
                    )}
                  >
                    0%
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxRate(16)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all",
                      taxRate === 16 ? "bg-charcoal text-white" : "bg-cream text-charcoal/60 hover:text-charcoal"
                    )}
                  >
                    16% VAT
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0 (e.g. 16 for VAT)"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full p-2 bg-cream/40 border border-charcoal/10 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:border-red-600 text-right"
                />
                {taxAmount > 0 && (
                  <span className="text-xs font-mono font-bold text-amber-700 whitespace-nowrap">
                    +KES {formatMoney(taxAmount)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-charcoal pt-2 border-t border-charcoal/10">
              <span>Total Invoiced:</span>
              <span className="font-mono font-black text-charcoal text-sm">
                KES {formatMoney(effectiveTotalInvoiced)}
              </span>
            </div>

            {existingPayments.length > 0 && (
              <div className="flex items-center justify-between text-xs text-charcoal/60">
                <span>Prior Logged Payments:</span>
                <span className="font-mono font-medium text-charcoal/80">
                  KES {formatMoney(existingPaymentsSum)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-charcoal/60">
              <span>New Invoice Payments:</span>
              <span className="font-mono font-bold text-emerald-600">
                KES {formatMoney(newPaymentsSum)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-charcoal pt-2 border-t border-charcoal/10">
              <span>Total Payments Logged:</span>
              <span className="font-mono text-emerald-700">
                KES {formatMoney(totalPaymentsLogged)}
              </span>
            </div>

            {/* Automated Balance Due Box - NEVER manually entered */}
            <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 block">
                  Outstanding Balance
                </span>
                <span className="text-[10px] text-red-600">Total Invoiced − Sum of Payments</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-base text-red-600">
                  KES {formatMoney(outstandingBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-charcoal/5">
          {selectedProjectId && (
            <button
              type="button"
              onClick={async () => {
                const ok = await recordPaymentsToProjectTracker();
                if (ok) {
                  setSyncMessage('Payments successfully written to Project Tracker!');
                  setTimeout(() => setSyncMessage(null), 5000);
                } else {
                  alert('Failed to sync payments to project tracker.');
                }
              }}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal hover:bg-cream transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Sync to Project Tracker Now</span>
            </button>
          )}

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
                <span>Share Invoice</span>
              </>
            )}
          </button>

          <button
            type="submit"
            disabled={isGenerating || isSavingDraft || !clientName.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-40 cursor-pointer"
          >
            {isGenerating || isSavingDraft ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {invoiceCreationStep === 'saving' || isSavingDraft
                    ? 'Saving to Archive...'
                    : 'Generating & Downloading PDF...'}
                </span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>{editingInvoiceId ? 'Update & Download Invoice' : 'Create Invoice'}</span>
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
