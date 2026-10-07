import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount).replace('KES', 'KSh');
}

export function getOptimizedImageUrl(url?: string, width = 300): string {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  
  // Apply Cloudinary automatic format, compression, and width resizing
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    if (!url.includes('f_auto') && !url.includes('q_auto')) {
      return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
    }
  }
  return url;
}

const FREE_MAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
  'aol.com', 'proton.me', 'protonmail.com', 'mail.com', 'gmx.com'
];

/**
 * True for addresses on free consumer mail providers. Used on public pages so a premium brand
 * shows a branded address (name@yourdomain) once one is set in the admin Homepage Editor.
 */
export function isFreeMailAddress(email?: string): boolean {
  const domain = (email || '').trim().toLowerCase().split('@')[1];
  return !!domain && FREE_MAIL_DOMAINS.includes(domain);
}
