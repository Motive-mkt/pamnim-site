import React, { useState } from 'react';
import { serviceCategories, ServiceCategory, ServiceItem } from '../data/servicesData';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { X, Check, Compass, FolderPlus, Layers, Plus, Trash2, Tag } from 'lucide-react';

export interface SelectedScopeItem {
  id: string;
  type: 'category' | 'service';
  title: string;
  categoryTitle: string;
  categoryId: string;
  slug?: string;
}

interface StartProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Array<{ uid: string; id?: string; name: string; email: string; phone?: string; whatsapp?: string }>;
  onProjectStarted: () => void;
}

export default function StartProjectModal({ isOpen, onClose, clients, onProjectStarted }: StartProjectModalProps) {
  const { profile } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedScopeItem[]>([]);
  const [projectNameOverride, setProjectNameOverride] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggleCategory = (cat: ServiceCategory) => {
    const itemId = `cat:${cat.id}`;
    const exists = selectedItems.some(i => i.id === itemId);
    if (exists) {
      setSelectedItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      setSelectedItems(prev => [
        ...prev,
        {
          id: itemId,
          type: 'category',
          title: cat.title,
          categoryTitle: cat.title,
          categoryId: cat.id
        }
      ]);
    }
  };

  const toggleService = (cat: ServiceCategory, item: ServiceItem) => {
    const itemId = `svc:${item.slug}`;
    const exists = selectedItems.some(i => i.id === itemId);
    if (exists) {
      setSelectedItems(prev => prev.filter(i => i.id !== itemId));
    } else {
      setSelectedItems(prev => [
        ...prev,
        {
          id: itemId,
          type: 'service',
          title: item.name,
          categoryTitle: cat.title,
          categoryId: cat.id,
          slug: item.slug
        }
      ]);
    }
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleStartProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError('Please select a client for this project.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please select at least one service or category scope for this project.');
      return;
    }

    const client = clients.find(c => c.uid === selectedClientId || c.id === selectedClientId);
    if (!client) {
      setError('Selected client invalid.');
      return;
    }

    // Build default name summary
    let defaultTitle = '';
    if (selectedItems.length === 1) {
      defaultTitle = `${selectedItems[0].title} for ${client.name}`;
    } else if (selectedItems.length === 2) {
      defaultTitle = `${selectedItems[0].title} & ${selectedItems[1].title} for ${client.name}`;
    } else {
      defaultTitle = `${selectedItems[0].title} + ${selectedItems.length - 1} More Services for ${client.name}`;
    }

    const finalProjectName = projectNameOverride.trim() || defaultTitle;

    // Concatenate summary fields for backward compatibility
    const summaryCategoryTitle = Array.from(new Set(selectedItems.map(i => i.categoryTitle))).join(', ');
    const summaryServiceName = selectedItems.map(i => i.title).join(', ');

    setLoading(true);
    setError('');

    try {
      await addDoc(collection(db, 'projects'), {
        name: finalProjectName,
        clientId: client.uid || client.id,
        clientName: client.name,
        clientPhone: client.whatsapp || client.phone || '',
        categoryTitle: summaryCategoryTitle,
        serviceName: summaryServiceName,
        selectedServices: selectedItems,
        currentStageIndex: 0,
        currentStageName: 'Started',
        stages: ['Started', 'In Progress', 'Almost Done', 'Complete'],
        isFinished: false,
        startedByUid: profile?.uid,
        startedByName: profile?.name || 'Staff',
        employeeIds: [profile?.uid],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      onProjectStarted();
      onClose();
    } catch (err: any) {
      console.error('Error starting project:', err);
      setError(err.message || 'Failed to start project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-charcoal/10 my-8">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-cream hover:bg-charcoal/5 flex items-center justify-center transition-colors text-charcoal/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-ochre/10 text-ochre flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-charcoal">Start New Project</h2>
            <p className="text-sm text-charcoal/60">Select any mix of categories and specific services for a single project.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 text-sm font-medium border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleStartProject} className="space-y-6">
          {/* Step 1: Select Client */}
          <div>
            <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-2">
              1. Select Client
            </label>
            {clients.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 p-4 rounded-2xl border border-amber-200">
                No approved clients available yet. Approve a pending signup request or add a client profile first.
              </p>
            ) : (
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 focus:border-ochre focus:ring-2 focus:ring-ochre/20 outline-none text-sm bg-white font-medium"
                required
              >
                <option value="">-- Choose Client --</option>
                {clients.map(c => (
                  <option key={c.uid || c.id} value={c.uid || c.id}>
                    {c.name} ({c.email || c.whatsapp || c.phone || 'Client'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2: Selected Included Scopes Summary Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-charcoal/60 uppercase tracking-widest flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-ochre" />
                2. Included Service Scopes ({selectedItems.length} selected)
              </label>
              {selectedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedItems([])}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <div className="p-4 rounded-2xl bg-cream/50 border border-dashed border-charcoal/20 text-xs text-charcoal/50 text-center">
                No categories or services selected yet. Pick any combination below!
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-cream/40 rounded-2xl border border-charcoal/10 max-h-36 overflow-y-auto">
                {selectedItems.map(item => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-ochre/30 text-xs font-bold text-charcoal shadow-sm"
                  >
                    <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-ochre/10 text-ochre">
                      {item.type === 'category' ? 'Category' : 'Service'}
                    </span>
                    <span>{item.title}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="ml-1 text-charcoal/40 hover:text-red-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Mix-and-Match Multi-Selection Cards */}
          <div>
            <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-3">
              3. Choose Services & Categories
            </label>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {serviceCategories.map(cat => {
                const catItemId = `cat:${cat.id}`;
                const isCatSelected = selectedItems.some(i => i.id === catItemId);

                return (
                  <div key={cat.id} className="border border-charcoal/15 rounded-2xl p-4 bg-white hover:border-ochre/50 transition-colors">
                    {/* Category Header with Whole Category Toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-charcoal/10 mb-3">
                      <div>
                        <h4 className="font-bold text-sm text-charcoal">{cat.title}</h4>
                        <p className="text-xs text-charcoal/50 line-clamp-1">{cat.description}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                          isCatSelected
                            ? 'bg-ochre text-white shadow-sm'
                            : 'bg-cream text-charcoal border border-charcoal/15 hover:border-ochre hover:bg-white'
                        }`}
                      >
                        {isCatSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Whole Category Selected
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 text-ochre" />
                            + Whole Category
                          </>
                        )}
                      </button>
                    </div>

                    {/* Specific Sub-Services List */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal/40 mb-2 block">
                        Or select specific services in this category:
                      </span>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {cat.items.map(item => {
                          const svcItemId = `svc:${item.slug}`;
                          const isSvcSelected = selectedItems.some(i => i.id === svcItemId);

                          return (
                            <button
                              key={item.slug}
                              type="button"
                              onClick={() => toggleService(cat, item)}
                              className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 ${
                                isSvcSelected
                                  ? 'bg-ochre/10 border-ochre text-charcoal shadow-sm'
                                  : 'bg-cream/30 border-charcoal/10 hover:border-charcoal/30 text-charcoal/80'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                                isSvcSelected ? 'bg-ochre border-ochre text-white' : 'border-charcoal/30 bg-white'
                              }`}>
                                {isSvcSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <span className="text-xs font-bold block">{item.name}</span>
                                <span className="text-[10px] text-charcoal/50 line-clamp-1">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: Custom Project Title */}
          <div>
            <label className="block text-xs font-bold text-charcoal/60 uppercase tracking-widest mb-2">
              4. Custom Project Title (Optional)
            </label>
            <input
              type="text"
              placeholder="Leave blank to auto-generate from selected scope..."
              value={projectNameOverride}
              onChange={e => setProjectNameOverride(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-charcoal/15 focus:border-ochre outline-none text-sm"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-charcoal/10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl border border-charcoal/15 text-charcoal font-semibold text-sm hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedClientId || selectedItems.length === 0}
              className="px-8 py-3 rounded-2xl bg-ochre text-white font-bold text-sm shadow-lg shadow-ochre/20 hover:bg-ochre-dark transition-all disabled:opacity-50"
            >
              {loading ? 'Starting Project...' : `Start Project (${selectedItems.length} Scopes)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

