import React, { useState, useEffect } from 'react';
import { RefreshCcw, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ProjectCostEditorProps {
  project: {
    id: string;
    totalCost?: number;
    name?: string;
  };
  onSaveCost: (projectId: string, cost: string | number) => Promise<void>;
  isSaving: boolean;
  feedback?: { type: 'success' | 'error'; message: string } | null;
}

export default function ProjectCostEditor({ 
  project, 
  onSaveCost, 
  isSaving, 
  feedback 
}: ProjectCostEditorProps) {
  const [costInput, setCostInput] = useState<string>(String(project.totalCost ?? 0));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setCostInput(String(project.totalCost ?? 0));
    setLocalError(null);
  }, [project.id, project.totalCost]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = costInput.trim();
    if (trimmed === '') {
      setLocalError('Cost cannot be empty. Please enter a valid number.');
      return;
    }
    const num = Number(trimmed);
    if (isNaN(num)) {
      setLocalError('Please enter a valid numeric value.');
      return;
    }
    if (num < 0) {
      setLocalError('Total Project Cost cannot be negative.');
      return;
    }

    onSaveCost(project.id, num);
  };

  const currentSavedCost = project.totalCost ?? 0;
  const hasChanged = Number(costInput) !== currentSavedCost;

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/40 font-bold text-sm select-none">$</span>
          <input
            type="number"
            min="0"
            step="any"
            value={costInput}
            onChange={(e) => {
              setCostInput(e.target.value);
              setLocalError(null);
            }}
            placeholder="0.00"
            aria-label="Total Project Cost"
            className={cn(
              "w-full sm:w-44 pl-8 pr-3 py-2.5 bg-cream/50 border rounded-xl text-sm font-bold text-charcoal focus:outline-none transition-all",
              localError || feedback?.type === 'error' ? "border-red-400 focus:border-red-500 bg-red-50/30" : "border-charcoal/15 focus:border-ochre focus:bg-white"
            )}
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className={cn(
            "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer",
            isSaving 
              ? "bg-charcoal/20 text-charcoal/60 cursor-not-allowed" 
              : hasChanged 
                ? "bg-ochre text-white hover:bg-ochre-dark shadow-ochre/20" 
                : "bg-charcoal text-white hover:bg-charcoal/80"
          )}
        >
          {isSaving ? (
            <>
              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Cost</span>
            </>
          )}
        </button>
      </form>

      {(localError || feedback) && (
        <div className={cn(
          "text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center gap-1.5",
          (localError || feedback?.type === 'error') ? "text-red-700 bg-red-50 border border-red-200" : "text-emerald-800 bg-emerald-50 border border-emerald-200"
        )}>
          {(localError || feedback?.type === 'error') ? (
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          )}
          <span>{localError || feedback?.message}</span>
        </div>
      )}
    </div>
  );
}
