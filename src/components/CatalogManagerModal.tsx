import React, { useState, useEffect } from 'react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CatalogItem, DEFAULT_CATALOG_CATEGORIES, PRESET_CATALOG_ITEMS } from '../types/catalog';
import { 
  Plus, Edit2, Trash2, X, Search, Sparkles, Check, DollarSign, Tag, Layers, 
  HelpCircle, TrendingUp, AlertCircle, RefreshCw
} from 'lucide-react';
import { formatMoney } from '../utils/pdfGenerator';

interface CatalogManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem?: (item: CatalogItem) => void;
  initialOpenAdd?: boolean;
}

export default function CatalogManagerModal({ isOpen, onClose, onSelectItem, initialOpenAdd = false }: CatalogManagerModalProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form State for Add / Edit
  const [isEditing, setIsEditing] = useState<boolean>(initialOpenAdd);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: DEFAULT_CATALOG_CATEGORIES[0],
    unit: 'pcs',
    purchasePrice: '',
    sellingPrice: '',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    if (isOpen && initialOpenAdd) {
      setIsEditing(true);
      setEditingId(null);
    }
  }, [isOpen, initialOpenAdd]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const catalogRef = collection(db, 'servicesMaterials');
    const q = query(catalogRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CatalogItem[];
      setItems(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching catalog:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: selectedCategory !== 'all' ? selectedCategory : DEFAULT_CATALOG_CATEGORIES[0],
      unit: 'pcs',
      purchasePrice: '',
      sellingPrice: '',
      description: ''
    });
    setFormError('');
    setIsEditing(true);
  };

  const handleOpenEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    const isService = item.category?.toLowerCase() === 'service' || 
      item.category?.includes('Design') || 
      item.category?.includes('Labor') || 
      item.category?.includes('Painting') || 
      item.category?.includes('Ceiling');
    const safeCategory = item.category === 'Service' || item.category === 'Product' 
      ? item.category 
      : (isService ? 'Service' : 'Product');

    setFormData({
      name: item.name,
      category: safeCategory,
      unit: item.unit || 'pcs',
      purchasePrice: item.purchasePrice ? item.purchasePrice.toString() : '',
      sellingPrice: item.sellingPrice ? item.sellingPrice.toString() : '',
      description: item.description || ''
    });
    setFormError('');
    setIsEditing(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please provide an item or service name.');
      return;
    }

    const selling = parseFloat(formData.sellingPrice);
    if (isNaN(selling) || selling < 0) {
      setFormError('Please enter a valid selling price.');
      return;
    }

    const purchase = parseFloat(formData.purchasePrice) || 0;

    setIsSaving(true);
    try {
      if (editingId) {
        // Update
        await updateDoc(doc(db, 'servicesMaterials', editingId), {
          name: formData.name.trim(),
          category: formData.category,
          unit: formData.unit.trim(),
          purchasePrice: purchase,
          sellingPrice: selling,
          description: formData.description.trim(),
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create
        await addDoc(collection(db, 'servicesMaterials'), {
          name: formData.name.trim(),
          category: formData.category,
          unit: formData.unit.trim(),
          purchasePrice: purchase,
          sellingPrice: selling,
          description: formData.description.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      setIsEditing(false);
      setEditingId(null);
    } catch (err: any) {
      console.error('Error saving catalog item:', err);
      setFormError(err.message || 'Failed to save item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the catalog?`)) return;
    try {
      await deleteDoc(doc(db, 'servicesMaterials', id));
    } catch (err) {
      console.error('Error deleting catalog item:', err);
      alert('Failed to delete item.');
    }
  };

  const handleSeedPresets = async () => {
    if (!window.confirm('Populate catalog with Pamnim interior design services & materials presets?')) return;
    setIsSeeding(true);
    try {
      for (const preset of PRESET_CATALOG_ITEMS) {
        await addDoc(collection(db, 'servicesMaterials'), {
          ...preset,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error seeding presets:', err);
      alert('Failed to seed presets.');
    } finally {
      setIsSeeding(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (selectedCategory === 'all') return matchesSearch;

    const isService = item.category?.toLowerCase() === 'service' || 
      item.category?.includes('Design') || 
      item.category?.includes('Labor') || 
      item.category?.includes('Painting') || 
      item.category?.includes('Ceiling');
    const normalizedCat = isService ? 'Service' : 'Product';

    const matchesCategory = item.category === selectedCategory || normalizedCat === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl border border-charcoal/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-charcoal/10 flex items-center justify-between bg-cream/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-charcoal">Services & Materials Catalog</h2>
              <p className="text-xs text-charcoal/60">
                Manage reusable line items with selling & purchase prices. Shared across Quotes and Invoices.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 rounded-full transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isEditing ? (
            /* Add / Edit Form */
            <form onSubmit={handleSaveItem} className="bg-cream/40 p-6 rounded-2xl border border-charcoal/10 space-y-5">
              <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal">
                  {editingId ? 'Edit Catalog Item' : 'New Catalog Item'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-charcoal/50 hover:text-charcoal"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                    Service / Material Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Waterproof Rigid-Core SPC Flooring"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs font-bold focus:outline-none focus:border-ochre"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                    Category <span className="text-ochre">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs font-bold text-charcoal focus:outline-none focus:border-ochre cursor-pointer"
                  >
                    <option value="Product">Product</option>
                    <option value="Service">Service</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    placeholder="e.g. sqm, linear meter, pcs, lump sum"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                    Selling Price (KES per unit) *
                    <span className="text-ochre font-normal lowercase ml-1">(shown on quote/invoice)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    placeholder="e.g. 5800"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-ochre"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                    Purchase / Cost Price (KES per unit)
                    <span className="text-charcoal/40 font-normal lowercase ml-1">(internal margin only)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="e.g. 3200"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs font-mono focus:outline-none focus:border-ochre"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                    Scope Description / Specifications (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detailed specifications auto-filled when this item is selected..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 bg-white border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                  />
                </div>
              </div>

              {/* Live Margin Calculation Preview */}
              {formData.sellingPrice && (
                <div className="p-3 bg-white rounded-xl border border-charcoal/10 flex items-center justify-between text-xs">
                  <span className="text-charcoal/60">Estimated Unit Profit Margin:</span>
                  <div className="flex items-center gap-3">
                    {formData.purchasePrice && Number(formData.sellingPrice) >= Number(formData.purchasePrice) ? (
                      <>
                        <span className="font-mono font-bold text-emerald-600">
                          +KES {formatMoney(Number(formData.sellingPrice) - Number(formData.purchasePrice))}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold text-[10px]">
                          {(((Number(formData.sellingPrice) - Number(formData.purchasePrice)) / Number(formData.sellingPrice)) * 100).toFixed(1)}% margin
                        </span>
                      </>
                    ) : (
                      <span className="text-charcoal/40 italic">Set purchase cost to calculate margin</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl border border-charcoal/10 text-xs font-bold text-charcoal/70 hover:bg-cream transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold transition-all shadow-md shadow-ochre/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Update Catalog Item' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          ) : (
            /* Controls & List View */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/40" />
                  <input
                    type="text"
                    placeholder="Search services or materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-cream/40 border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="p-2.5 bg-cream/40 border border-charcoal/10 rounded-xl text-xs focus:outline-none focus:border-ochre"
                  >
                    <option value="all">All Categories</option>
                    {DEFAULT_CATALOG_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="flex items-center gap-1.5 bg-ochre hover:bg-ochre-dark text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-ochre/20 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Item</span>
                  </button>
                </div>
              </div>

              {/* Items List */}
              {loading ? (
                <div className="p-12 text-center text-charcoal/40 animate-pulse text-xs">
                  Loading catalog items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center bg-cream/20 rounded-2xl border border-charcoal/10 space-y-4">
                  <Tag className="w-8 h-8 text-ochre/40 mx-auto" />
                  <div>
                    <h4 className="font-bold text-sm text-charcoal">No Catalog Items Found</h4>
                    <p className="text-xs text-charcoal/50 mt-1 max-w-md mx-auto">
                      {searchTerm ? 'No items match your search term.' : 'Add your first service or material item to reuse across all quotes and invoices.'}
                    </p>
                  </div>
                  {items.length === 0 && (
                    <button
                      type="button"
                      onClick={handleSeedPresets}
                      disabled={isSeeding}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal text-white text-xs font-bold rounded-xl hover:bg-ochre transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-ochre" />
                      <span>{isSeeding ? 'Loading Presets...' : 'Populate Standard Pamnim Presets'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-charcoal/5 border border-charcoal/10 rounded-2xl overflow-hidden bg-white shadow-sm">
                  {filteredItems.map((item) => {
                    const margin = item.sellingPrice - (item.purchasePrice || 0);
                    const marginPct = item.sellingPrice > 0 ? ((margin / item.sellingPrice) * 100).toFixed(0) : '0';

                    return (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-cream/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-charcoal">{item.name}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-ochre/10 text-ochre px-2.5 py-0.5 rounded-full">
                              {item.category}
                            </span>
                            <span className="text-[10px] text-charcoal/50 bg-charcoal/5 px-2 py-0.5 rounded-full">
                              per {item.unit || 'unit'}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-charcoal/60 line-clamp-1">{item.description}</p>
                          )}
                        </div>

                        {/* Pricing & Margin info */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-bold font-mono text-charcoal">
                              KES {formatMoney(item.sellingPrice)}
                            </div>
                            {item.purchasePrice > 0 && (
                              <div className="text-[10px] text-emerald-600 font-medium">
                                Cost: KES {formatMoney(item.purchasePrice)} ({marginPct}% margin)
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {onSelectItem && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectItem(item);
                                  onClose();
                                }}
                                className="px-3 py-1.5 bg-ochre/10 hover:bg-ochre hover:text-white text-ochre text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                              >
                                Select
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 rounded-lg transition-all cursor-pointer"
                              title="Edit item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="p-1.5 text-charcoal/40 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-charcoal/10 bg-cream/30 flex justify-between items-center text-xs text-charcoal/50">
          <span>{items.length} items in catalog</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-charcoal text-white rounded-xl text-xs font-bold hover:bg-ochre transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
