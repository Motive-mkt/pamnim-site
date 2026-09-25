import React, { useState, useEffect } from 'react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CatalogItem, DEFAULT_CATALOG_CATEGORIES, PRESET_CATALOG_ITEMS } from '../types/catalog';
import { 
  Plus, Edit2, Trash2, X, Search, Sparkles, Check, DollarSign, Tag, Layers, 
  HelpCircle, TrendingUp, AlertCircle, RefreshCw, Filter, Package, Wrench
} from 'lucide-react';
import { formatMoney } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';

export const COMMON_UNITS = [
  'pcs',
  'sqm',
  'linear meter',
  'running meter',
  'lump sum',
  'set',
  'hours',
  'days',
  'sqft',
  'liters',
  'kg'
];

export default function CatalogManagerView() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: DEFAULT_CATALOG_CATEGORIES[0] as string,
    unit: 'pcs',
    customUnit: '',
    purchasePrice: '',
    sellingPrice: '',
    description: ''
  });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [deleteItemModal, setDeleteItemModal] = useState<CatalogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
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
      console.error('Error fetching catalog items:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      name: '',
      category: selectedCategory !== 'all' ? selectedCategory : DEFAULT_CATALOG_CATEGORIES[0],
      unit: 'pcs',
      customUnit: '',
      purchasePrice: '',
      sellingPrice: '',
      description: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    const unitVal = item.unit || 'pcs';
    const isStandardUnit = COMMON_UNITS.includes(unitVal);

    setFormData({
      name: item.name,
      category: item.category || DEFAULT_CATALOG_CATEGORIES[0],
      unit: isStandardUnit ? unitVal : 'other',
      customUnit: isStandardUnit ? '' : unitVal,
      purchasePrice: item.purchasePrice ? item.purchasePrice.toString() : '',
      sellingPrice: item.sellingPrice ? item.sellingPrice.toString() : '',
      description: item.description || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter an item or service name.');
      return;
    }

    const selling = parseFloat(formData.sellingPrice);
    if (isNaN(selling) || selling < 0) {
      setFormError('Please enter a valid client selling price.');
      return;
    }

    const purchase = formData.purchasePrice ? parseFloat(formData.purchasePrice) : 0;
    if (isNaN(purchase) || purchase < 0) {
      setFormError('Please enter a valid internal purchase cost.');
      return;
    }

    const resolvedUnit = formData.unit === 'other' 
      ? (formData.customUnit.trim() || 'unit')
      : formData.unit;

    setIsSaving(true);
    try {
      const itemData: Record<string, any> = {
        name: formData.name.trim(),
        category: formData.category,
        unit: resolvedUnit.toLowerCase().trim(),
        purchasePrice: purchase,
        sellingPrice: selling,
        description: formData.description.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'servicesMaterials', editingId), itemData);
        showToast(`Item "${formData.name.trim()}" updated successfully.`);
      } else {
        itemData.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'servicesMaterials'), itemData);
        showToast(`Item "${formData.name.trim()}" added to catalog.`);
      }

      setIsModalOpen(false);
      setEditingId(null);
    } catch (err: any) {
      console.error('Error saving catalog item:', err);
      setFormError(err?.message || 'Failed to save item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItemModal?.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'servicesMaterials', deleteItemModal.id));
      showToast(`Item "${deleteItemModal.name}" deleted from catalog.`);
      setDeleteItemModal(null);
    } catch (err: any) {
      console.error('Error deleting item:', err);
      alert('Could not delete item: ' + (err?.message || String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedPresets = async () => {
    if (items.length > 0 && !window.confirm('Populate preset interior materials and service items into your catalog? Existing items will be preserved.')) {
      return;
    }

    setIsSeeding(true);
    try {
      const batchPromises = PRESET_CATALOG_ITEMS.map(preset => {
        return addDoc(collection(db, 'servicesMaterials'), {
          ...preset,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      await Promise.all(batchPromises);
      showToast(`Added ${PRESET_CATALOG_ITEMS.length} preset interior items to catalog.`);
    } catch (err: any) {
      console.error('Error seeding catalog:', err);
      alert('Could not seed catalog: ' + (err?.message || String(err)));
    } finally {
      setIsSeeding(false);
    }
  };

  // Filtered items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.unit && item.unit.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-charcoal/10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ochre/10 text-ochre text-xs font-bold uppercase tracking-wider mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Master Price List & Inventory</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-charcoal">Materials & Services Catalog</h2>
          <p className="text-xs sm:text-sm text-charcoal/60 mt-1">
            Manage your spatial items, products, joinery rates, and services with exact units of measure.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {items.length === 0 && (
            <button
              type="button"
              onClick={handleSeedPresets}
              disabled={isSeeding}
              className="px-4 py-2.5 rounded-2xl border border-ochre/30 bg-ochre/5 hover:bg-ochre/10 text-ochre text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSeeding ? 'Seeding...' : 'Load Presets'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-2xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-ochre/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item / Service</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-charcoal/10 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, description, unit..."
            className="w-full pl-10 pr-4 py-2 bg-cream/50 border border-charcoal/10 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer",
              selectedCategory === 'all'
                ? "bg-charcoal text-white"
                : "bg-cream text-charcoal/60 hover:text-charcoal"
            )}
          >
            All Items ({items.length})
          </button>
          {DEFAULT_CATALOG_CATEGORIES.map(cat => {
            const count = items.filter(i => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer",
                  selectedCategory === cat
                    ? "bg-ochre text-white"
                    : "bg-cream text-charcoal/60 hover:text-charcoal"
                )}
              >
                {cat}s ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Grid / Table */}
      {loading ? (
        <div className="py-20 text-center text-charcoal/50 text-xs font-medium bg-white rounded-3xl border border-charcoal/10">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-ochre" />
          <span>Loading catalog materials and services...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-charcoal/10 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-cream flex items-center justify-center mx-auto text-charcoal/40">
            <Layers className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-charcoal">No catalog items found</h3>
            <p className="text-xs text-charcoal/60 mt-1">
              {searchTerm 
                ? 'No items matched your search query. Try clear filters or create a new item.'
                : 'Your catalog is empty. Click below to add your first spatial product or load presets.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 rounded-2xl bg-ochre text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-ochre/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Item</span>
            </button>
            {items.length === 0 && (
              <button
                onClick={handleSeedPresets}
                className="px-4 py-2.5 rounded-2xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
              >
                Load Presets
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const margin = item.sellingPrice > 0 
              ? (((item.sellingPrice - (item.purchasePrice || 0)) / item.sellingPrice) * 100).toFixed(0)
              : '0';

            return (
              <div 
                key={item.id} 
                className="bg-white rounded-2xl p-5 border border-charcoal/10 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn(
                      "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border",
                      item.category === 'Service'
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    )}>
                      {item.category || 'Product'}
                    </span>

                    <span className="text-[11px] font-bold text-charcoal/50 bg-charcoal/5 px-2 py-0.5 rounded-md">
                      per {item.unit || 'unit'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-charcoal leading-snug group-hover:text-ochre transition-colors">
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-xs text-charcoal/60 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-charcoal/5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-charcoal/40 uppercase font-bold block">Selling Price</span>
                      <span className="text-base font-bold text-ochre">
                        KES {formatMoney(item.sellingPrice)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-charcoal/40 uppercase font-bold block">Cost Price</span>
                      <span className="text-xs font-semibold text-charcoal/60">
                        KES {formatMoney(item.purchasePrice || 0)}
                      </span>
                      {Number(margin) > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600 block">
                          +{margin}% margin
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 rounded-lg text-charcoal/60 hover:text-ochre hover:bg-ochre/10 transition-colors cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteItemModal(item)}
                      className="p-1.5 rounded-lg text-charcoal/40 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Item"
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

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-charcoal/15 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-charcoal">
                  {editingId ? 'Edit Catalog Item' : 'Add New Item / Service'}
                </h3>
                <p className="text-xs text-charcoal/60">
                  Configure material rates, services, and saved units of measure.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-charcoal/40 hover:text-charcoal hover:bg-cream transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                  Item or Service Name <span className="text-ochre">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Waterproof SPC Rigid Core Flooring"
                  className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                    Category <span className="text-ochre">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-ochre focus:bg-white text-charcoal cursor-pointer"
                  >
                    {DEFAULT_CATALOG_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                    Unit of Measure <span className="text-ochre">*</span>
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-ochre focus:bg-white text-charcoal cursor-pointer"
                  >
                    {COMMON_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="other">Other (type custom unit)</option>
                  </select>
                </div>
              </div>

              {formData.unit === 'other' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                    Custom Unit of Measure
                  </label>
                  <input
                    type="text"
                    value={formData.customUnit}
                    onChange={(e) => setFormData({ ...formData, customUnit: e.target.value })}
                    placeholder="e.g. roll, bundle, box, bag..."
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                    Client Selling Price (KES) <span className="text-ochre">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="e.g. 5800"
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:border-ochre focus:bg-white text-ochre"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                    Internal Cost (KES)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="e.g. 3200"
                    className="w-full px-3.5 py-2.5 bg-cream/40 border border-charcoal/15 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal/70 mb-1">
                  Description / Specifications (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Material specs, thickness, origin, finish, warranty..."
                  className="w-full p-3 bg-cream/40 border border-charcoal/15 rounded-xl text-xs font-medium focus:outline-none focus:border-ochre focus:bg-white text-charcoal"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-ochre hover:bg-ochre-dark text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-ochre/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : editingId ? 'Update Item' : 'Save Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl border border-red-200 shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-charcoal">Delete Catalog Item</h3>
                <p className="text-xs text-charcoal/60">This removes it from future autocomplete pickers.</p>
              </div>
            </div>

            <p className="text-xs text-charcoal/70">
              Are you sure you want to permanently remove <strong className="text-charcoal">{deleteItemModal.name}</strong> ({deleteItemModal.unit})? Existing saved quotes and invoices will keep their saved text.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteItemModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-charcoal/20 text-xs font-bold text-charcoal/70 hover:bg-cream transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className="p-4 bg-charcoal text-white rounded-2xl shadow-xl flex items-center gap-3 border border-charcoal/20 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
