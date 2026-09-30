import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Normalizes a filename or media URL to its clean base filename for reliable comparison.
 * Examples:
 * - "Kitchen_Design_Final.JPG" -> "kitchen_design_final.jpg"
 * - "https://res.cloudinary.com/.../v1720000000/kitchen_design_final.jpg" -> "kitchen_design_final.jpg"
 * - "https://.../v1720000000/kitchen_design_final.jpg?q=80" -> "kitchen_design_final.jpg"
 */
export function normalizeFilename(rawNameOrUrl: string): string {
  if (!rawNameOrUrl) return '';

  try {
    // 1. Remove query params and hashes
    let cleaned = rawNameOrUrl.split('?')[0].split('#')[0].trim();

    // 2. Decode URL encoding if any
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {
      // ignore malformed URI
    }

    // 3. Extract the last path segment (filename)
    const segments = cleaned.split(/[/\\]/);
    let filename = segments[segments.length - 1] || cleaned;

    // 4. If Cloudinary version prefix exists (e.g. "v1729381928_photo.jpg" or "v1234/photo.jpg"), strip it
    filename = filename.replace(/^v\d+[-_]?/, '');

    // 5. Lowercase and trim
    return filename.toLowerCase().trim();
  } catch {
    return rawNameOrUrl.toLowerCase().trim();
  }
}

export interface ExistingPortfolioRecord {
  id: string;
  fileName?: string;
  originalFilename?: string;
  filename?: string;
  image?: string;
  title?: string;
  source?: 'portfolio_assets' | 'gallery';
}

/**
 * Fetches all filenames currently stored in Portfolio media collections (portfolio_assets and gallery).
 */
export async function getExistingPortfolioFilenames(): Promise<{
  filenames: Set<string>;
  records: ExistingPortfolioRecord[];
}> {
  const filenames = new Set<string>();
  const records: ExistingPortfolioRecord[] = [];

  try {
    // 1. Portfolio Assets collection
    const portSnap = await getDocs(collection(db, 'portfolio_assets'));
    portSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const rec: ExistingPortfolioRecord = {
        id: docSnap.id,
        fileName: data.fileName,
        originalFilename: data.originalFilename,
        filename: data.filename,
        image: data.image,
        title: data.title,
        source: 'portfolio_assets'
      };
      records.push(rec);

      if (data.fileName) filenames.add(normalizeFilename(data.fileName));
      if (data.originalFilename) filenames.add(normalizeFilename(data.originalFilename));
      if (data.filename) filenames.add(normalizeFilename(data.filename));
      if (data.image) filenames.add(normalizeFilename(data.image));
    });

    // 2. Gallery collection (shown in portfolio)
    const galSnap = await getDocs(collection(db, 'gallery'));
    galSnap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const rec: ExistingPortfolioRecord = {
        id: docSnap.id,
        fileName: data.fileName,
        originalFilename: data.originalFilename,
        filename: data.filename,
        image: data.image,
        title: data.title,
        source: 'gallery'
      };
      records.push(rec);

      if (data.fileName) filenames.add(normalizeFilename(data.fileName));
      if (data.originalFilename) filenames.add(normalizeFilename(data.originalFilename));
      if (data.filename) filenames.add(normalizeFilename(data.filename));
      if (data.image) filenames.add(normalizeFilename(data.image));
    });
  } catch (err) {
    console.error('Error fetching existing portfolio media for duplicate check:', err);
  }

  return { filenames, records };
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  duplicateFiles: string[];
  message: string | null;
}

/**
 * Checks a list of Files or filenames against existing Portfolio items.
 * Returns duplicate details and a clear user message.
 */
export async function checkPortfolioDuplicates(
  filesToCheck: (File | string)[]
): Promise<DuplicateCheckResult> {
  const { filenames } = await getExistingPortfolioFilenames();
  const duplicates: string[] = [];

  // Also track names within the current batch to prevent uploading duplicates in the same batch
  const batchSeen = new Set<string>();

  for (const item of filesToCheck) {
    const rawName = typeof item === 'string' ? item : item.name;
    const normalized = normalizeFilename(rawName);

    if (!normalized) continue;

    if (filenames.has(normalized) || batchSeen.has(normalized)) {
      duplicates.push(rawName);
    } else {
      batchSeen.add(normalized);
    }
  }

  if (duplicates.length === 0) {
    return {
      hasDuplicate: false,
      duplicateFiles: [],
      message: null
    };
  }

  const message = duplicates.length === 1
    ? `The file "${duplicates[0]}" has already been uploaded to the Portfolio.`
    : `The following files have already been uploaded to the Portfolio: ${duplicates.map(d => `"${d}"`).join(', ')}.`;

  return {
    hasDuplicate: true,
    duplicateFiles: duplicates,
    message
  };
}
