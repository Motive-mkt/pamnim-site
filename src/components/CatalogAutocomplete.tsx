import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ModalPortal from './ModalPortal';
import { CatalogItem } from '../types/catalog';
import { Layers, Tag, ChevronDown, Check, Plus, DollarSign, X } from 'lucide-react';
import { formatMoney } from '../utils/pdfGenerator';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';

export interface CatalogAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCatalogItem: (item: CatalogItem) => void;
  placeholder?: string;
  catalogItems?: CatalogItem[];
  className?: string;
  inputClassName?: string;
  onOpenCatalogModal?: () => void;
  autoFocus?: boolean;
}

const COMMON_UNITS = ['pcs', 'sqm', 'linear meters', 'set', 'hours', 'bags', 'litres'];

export default function CatalogAutocomplete({
  value,
  onChange,
  onSelectCatalogItem,
  placeholder = 'Type material, service name or select from catalog...',
  catalogItems: propCatalogItems,
  className,
  inputClassName,
  onOpenCatalogModal,
  autoFocus = false
}: CatalogAutocompleteProps) {
  const [internalCatalog, setInternalCatalog] = useState<CatalogItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listPos, setListPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);

  // Inline "Add to Catalog" prompt state
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [newUnit, setNewUnit] = useState<string>('pcs');
  const [newCategory, setNewCategory] = useState<string>('');
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // If catalogItems not supplied via props, subscribe to servicesMaterials
  useEffect(() => {
    if (propCatalogItems && propCatalogItems.length > 0) {
      setInternalCatalog(propCatalogItems);
      return;
    }

    const q = query(collection(db, 'servicesMaterials'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as CatalogItem[];
      setInternalCatalog(list);
    }, (err) => {
      console.warn('CatalogAutocomplete snapshot error:', err);
    });

    return () => unsubscribe();
  }, [propCatalogItems]);

  const items = propCatalogItems && propCatalogItems.length > 0 ? propCatalogItems : internalCatalog;

  // Filter items based on query
  const trimmedVal = (value || '').trim();
  const queryText = trimmedVal.toLowerCase();
  const filteredItems = items.filter(item => {
    if (!queryText) return true;
    const nameMatch = (item.name || '').toLowerCase().includes(queryText);
    const catMatch = (item.category || '').toLowerCase().includes(queryText);
    const descMatch = (item.description || '').toLowerCase().includes(queryText);
    return nameMatch || catMatch || descMatch;
  }).slice(0, 8); // Max 8 suggestions for snappy UX

  // Check if current value already exists as an exact match
  const exactMatch = items.some(item => item.name.toLowerCase() === queryText);
  const canShowAddToCatalog = trimmedVal.length > 0 && !exactMatch;

  // The suggestion list is rendered on <body> (see below), so "outside" means outside BOTH the
  // input container and the list. The Quick Add prompt is a modal with its own backdrop.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Anchor the floating list to the input, flip upwards when there is no room below, stay on screen.
  const updateListPos = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 300), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    const maxH = Math.max(160, Math.min(320, up ? above : below));
    setListPos(up
      ? { left, width, bottom: vh - r.top + 6, maxH }
      : { left, width, top: r.bottom + 6, maxH });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || showInlineAdd) return;
    updateListPos();
    window.addEventListener('resize', updateListPos);
    window.addEventListener('scroll', updateListPos, true);
    return () => {
      window.removeEventListener('resize', updateListPos);
      window.removeEventListener('scroll', updateListPos, true);
    };
  }, [isOpen, showInlineAdd, updateListPos]);

  const handleSelect = (item: CatalogItem) => {
    onChange(item.name);
    onSelectCatalogItem(item);
    setIsOpen(false);
    setShowInlineAdd(false);
    setHighlightedIndex(-1);
  };

  const handleStartInlineAdd = () => {
    setShowInlineAdd(true);
    setAddError(null);
  };

  const handleSaveNewItem = async (e?: React.SyntheticEvent) => {
    // This panel renders inside the quote/invoice <form>; never let events bubble into it.
    e?.preventDefault();
    e?.stopPropagation();
    if (!trimmedVal || isSavingNew) return;
    setIsSavingNew(true);
    setAddError(null);

    try {
      const newItemData = {
        name: trimmedVal,
        sellingPrice: Number(newPrice) || 0,
        purchasePrice: 0,
        unit: newUnit.trim() || 'pcs',
        category: newCategory.trim() || '',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'servicesMaterials'), newItemData);
      const createdItem: CatalogItem = {
        id: docRef.id,
        ...newItemData
      };

      // Select it onto the line item immediately
      handleSelect(createdItem);
      setShowInlineAdd(false);
      setNewPrice('');
    } catch (err: any) {
      console.error('Error adding item to catalog:', err);
      setAddError(err?.message || 'Could not save to catalog.');
    } finally {
      setIsSavingNew(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showInlineAdd) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
        e.preventDefault();
        handleSelect(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setShowInlineAdd(false);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full pr-14 sm:pr-28 pl-3 py-2 bg-transparent border border-charcoal/10 rounded-lg text-xs font-semibold focus:outline-none focus:border-ochre text-charcoal",
            inputClassName
          )}
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {onOpenCatalogModal && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCatalogModal();
              }}
              title="Open full catalog browser"
              className="text-[11px] font-bold text-ochre hover:text-ochre-dark px-1.5 py-0.5 rounded hover:bg-ochre/10 transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              <Layers className="w-3 h-3" />
              <span className="hidden sm:inline">Catalog</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-charcoal/60 hover:text-charcoal transition-colors cursor-pointer"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Suggestion list: floats on <body> so a scrolling table or card can never clip or squash it */}
      {isOpen && !showInlineAdd && listPos && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', left: listPos.left, width: listPos.width, top: listPos.top, bottom: listPos.bottom, maxHeight: listPos.maxH }}
          className="bg-white border border-charcoal/15 rounded-xl shadow-xl z-[55] overflow-y-auto divide-y divide-charcoal/5"
        >
          {/* Option to Add New Item if not matching */}
          {canShowAddToCatalog && (
            <div
              onClick={handleStartInlineAdd}
              className="px-3.5 py-2.5 bg-ochre/10 hover:bg-ochre/20 text-ochre font-bold text-xs cursor-pointer flex items-center justify-between gap-2 border-b border-ochre/20 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 shrink-0 text-ochre" />
                <span>Add <strong className="text-charcoal underline">"{trimmedVal}"</strong> to catalog</span>
              </div>
              <span className="text-[11px] bg-white px-2 py-0.5 rounded text-ochre font-bold shadow-2xs">
                Quick Add
              </span>
            </div>
          )}

          {filteredItems.length > 0 ? (
            <div>
              <div className="px-3 py-1.5 bg-cream/50 text-[11px] uppercase font-bold tracking-wider text-charcoal/60 flex items-center justify-between">
                <span>Matching Catalog Items</span>
                <span>{filteredItems.length} found</span>
              </div>
              {filteredItems.map((item, idx) => {
                const isSelected = item.name.toLowerCase() === queryText;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "px-3.5 py-2.5 text-left cursor-pointer transition-colors flex items-start justify-between gap-3",
                      isHighlighted ? "bg-ochre/10 text-charcoal" : "hover:bg-cream/40 text-charcoal",
                      isSelected && "font-bold text-ochre"
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-charcoal">{item.name}</span>
                        {item.category && (
                          <span className="text-[11px] px-1.5 py-0.5 bg-charcoal/5 text-charcoal/60 rounded border border-charcoal/10 font-medium">
                            {item.category}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-charcoal/65 truncate max-w-sm">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-ochre">
                        KES {formatMoney(item.sellingPrice)}
                      </div>
                      {item.unit && (
                        <div className="text-[11px] text-charcoal/60 lowercase">
                          per {item.unit}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-charcoal/65 space-y-1">
              <p className="font-semibold text-charcoal/70">No matching catalog items found</p>
              <p className="text-[11px] text-charcoal/60">
                Click "Add to catalog" above or continue typing freely.
              </p>
            </div>
          )}

          {/* Footer action to open catalog manager */}
          {onOpenCatalogModal && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCatalogModal();
              }}
              className="w-full px-3 py-2 bg-cream/70 hover:bg-cream text-[11px] font-bold text-ochre text-center flex items-center justify-center gap-1.5 border-t border-charcoal/10 cursor-pointer transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Browse full Catalog Manager</span>
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Quick Add prompt: always a centred modal on top of the page, on every screen size */}
      {showInlineAdd && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/60 p-4 overflow-y-auto"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowInlineAdd(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Add ${trimmedVal} to catalog`}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setShowInlineAdd(false);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if ((e.target as HTMLElement).tagName !== 'SELECT') handleSaveNewItem(e);
                }
              }}
              className="w-full max-w-md bg-white rounded-2xl border border-charcoal/10 shadow-2xl p-5 space-y-4 animate-scale-up"
            >
              <div className="flex items-center justify-between pb-2 border-b border-charcoal/10">
                <span className="text-sm font-bold text-charcoal flex items-center gap-1.5 min-w-0">
                  <Plus className="w-4 h-4 text-ochre shrink-0" />
                  <span className="truncate">Add to Catalog: <strong className="text-ochre">"{trimmedVal}"</strong></span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowInlineAdd(false)}
                  className="p-1 text-charcoal/60 hover:text-charcoal cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addError && (
                <p className="text-xs text-red-600 font-semibold">{addError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                    Selling Price (KES) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    autoFocus
                    placeholder="e.g. 2500"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-lg text-sm font-mono font-bold focus:border-ochre focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                    Unit of Measure *
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-charcoal/15 rounded-lg text-sm font-semibold focus:border-ochre focus:outline-none cursor-pointer"
                  >
                    {COMMON_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-charcoal/60 mb-1">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wall Finishes, Gypsum, Lighting"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-charcoal/15 rounded-lg text-sm focus:border-ochre focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInlineAdd(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-charcoal/60 hover:bg-cream cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewItem}
                  disabled={isSavingNew || newPrice === ''}
                  className="px-4 py-2 rounded-lg bg-ochre hover:bg-ochre-dark text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isSavingNew ? 'Saving...' : 'Add to Catalog & Use'}</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
