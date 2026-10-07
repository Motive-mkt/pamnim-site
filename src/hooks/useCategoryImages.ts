import { useCMS } from './useCMS';
import { LUXURY_CATEGORIES } from '../components/Services';

/**
 * Photography for each service category, taken from the homepage CMS (which the owner can edit)
 * with the built-in defaults as a fallback, so every service page has a real image.
 */
export function useCategoryImages() {
  const { content } = useCMS();
  const source: any[] =
    content.luxuryCategories && content.luxuryCategories.length > 0 ? content.luxuryCategories : LUXURY_CATEGORIES;

  const imagesFor = (categoryId: string): string[] => {
    const match = source.find((c) => c.id === categoryId) || LUXURY_CATEGORIES.find((c) => c.id === categoryId);
    return (match?.images || []).filter(Boolean);
  };

  return { imagesFor, meta: (categoryId: string) => source.find((c) => c.id === categoryId) };
}
