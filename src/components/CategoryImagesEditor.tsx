import { useState } from 'react';
import { ArrowLeft, ImagePlus, Link2, Star, Trash2, Upload } from 'lucide-react';

interface CategoryImagesEditorProps {
  categories: any[];
  onChange: (next: any[]) => void;
  /** Uploads a file and resolves with its public URL (same uploader the hero slideshow uses). */
  upload: (file: File) => Promise<string>;
}

/**
 * Homepage Editor section for the core service category photos.
 * The first photo of each category is the cover shown on the homepage card and at the top of that
 * category's service pages. Edits are held in the editor until "Save All Changes" is pressed.
 */
export default function CategoryImagesEditor({ categories, onChange, upload }: CategoryImagesEditorProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setImages = (categoryId: string, images: string[]) => {
    onChange(categories.map((c) => (c.id === categoryId ? { ...c, images } : c)));
  };

  const imagesOf = (category: any): string[] => (category.images || []).filter(Boolean);

  const handleFile = async (category: any, file: File) => {
    setBusyId(category.id);
    setErrors((prev) => ({ ...prev, [category.id]: '' }));
    try {
      const url = await upload(file);
      setImages(category.id, [...imagesOf(category), url]);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [category.id]: `Upload failed: ${err?.message || err}` }));
    } finally {
      setBusyId(null);
    }
  };

  const handleAddUrl = (category: any) => {
    const url = (urlDrafts[category.id] || '').trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setErrors((prev) => ({ ...prev, [category.id]: 'The link must start with http:// or https://' }));
      return;
    }
    setErrors((prev) => ({ ...prev, [category.id]: '' }));
    setImages(category.id, [...imagesOf(category), url]);
    setUrlDrafts((prev) => ({ ...prev, [category.id]: '' }));
  };

  const makeCover = (category: any, index: number) => {
    const list = imagesOf(category);
    const [picked] = list.splice(index, 1);
    setImages(category.id, [picked, ...list]);
  };

  const remove = (category: any, index: number) => {
    setImages(
      category.id,
      imagesOf(category).filter((_, i) => i !== index)
    );
  };

  if (!categories || categories.length === 0) return null;

  return (
    <section className="mt-10 border-t border-charcoal/10 pt-8" aria-labelledby="category-photos-heading">
      <h3 id="category-photos-heading" className="text-lg font-bold text-charcoal">
        Core service photos
      </h3>
      <p className="mt-1 max-w-2xl text-xs text-charcoal/65">
        These photos appear on the homepage service cards and at the top of each service page. The photo marked
        Cover is the one shown first. Press Save All Changes when you are done.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {categories.map((category) => {
          const images = imagesOf(category);
          const busy = busyId === category.id;
          return (
            <div key={category.id} className="rounded-2xl border border-charcoal/10 bg-cream/30 p-4 sm:p-5">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-lg text-ochre" aria-hidden="true">
                  {category.accent}
                </span>
                <h4 className="text-base font-bold text-charcoal">{category.title}</h4>
              </div>

              {images.length > 0 ? (
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((url, index) => (
                    <li key={`${url}-${index}`} className="overflow-hidden rounded-xl border border-charcoal/10 bg-white">
                      <div className="relative aspect-[4/3] bg-charcoal/5">
                        <img
                          src={url}
                          alt={`${category.title} photo ${index + 1}`}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                        {index === 0 && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-charcoal px-2 py-1 text-[11px] font-semibold text-white">
                            <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                            Cover
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1 p-1.5">
                        {index === 0 ? (
                          <span className="px-2 text-[11px] text-charcoal/60">Shown first</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => makeCover(category, index)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-charcoal hover:bg-charcoal/5"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            Make cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(category, index)}
                          aria-label={`Remove photo ${index + 1} from ${category.title}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-dashed border-charcoal/15 bg-white/60 p-5 text-xs text-charcoal/65">
                  <ImagePlus className="h-5 w-5 shrink-0 text-charcoal/40" aria-hidden="true" />
                  No photos yet. The card will show its number until you add one.
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-charcoal/10 bg-white px-3 text-xs font-bold text-charcoal hover:border-ochre hover:text-ochre ${
                    busy ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <Upload className="h-4 w-4 text-ochre" aria-hidden="true" />
                  <span>{busy ? 'Uploading…' : 'Upload a photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(category, file);
                      e.target.value = '';
                    }}
                  />
                </label>

                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Link2
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40"
                      aria-hidden="true"
                    />
                    <input
                      type="url"
                      aria-label={`Paste an image link for ${category.title}`}
                      placeholder="Paste image link"
                      value={urlDrafts[category.id] || ''}
                      onChange={(e) => setUrlDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddUrl(category);
                        }
                      }}
                      className="min-h-11 w-full rounded-xl border border-charcoal/10 bg-white py-2 pl-9 pr-3 text-xs focus:border-ochre focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddUrl(category)}
                    disabled={!(urlDrafts[category.id] || '').trim()}
                    className="min-h-11 shrink-0 rounded-xl bg-charcoal px-4 text-xs font-bold text-white hover:bg-charcoal/90 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              {errors[category.id] && (
                <p role="alert" className="mt-3 text-xs font-medium text-red-700">
                  {errors[category.id]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
