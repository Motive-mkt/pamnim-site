/**
 * Cloudinary Media Optimizing Utility Service.
 *
 * Designed specifically for Pamnim Interiors on Cloudinary Free Tier.
 * Optimizes deliverability, saves up to 70% storage and bandwidth footprints
 * while retaining pristine, pixel-perfect visual crispness.
 */

/**
 * Optimizes a Cloudinary image or video URL by injecting auto format and quality transformations.
 * If the URL is not a Cloudinary asset or already transformed, it returns the URL safely.
 */
export function optimizeCloudinaryUrl(url: string, type: 'image' | 'video' = 'image'): string {
  if (!url) return '';
  
  // Only apply transformations to standard Cloudinary assets
  if (!url.includes('cloudinary.com')) {
    return url;
  }

  // Check if transformations are already present to avoid rendering dual transformation paths
  if (url.includes('/q_auto') || url.includes('/f_auto')) {
    return url;
  }

  try {
    const assetSection = type === 'video' ? '/video/upload/' : '/image/upload/';
    if (url.includes(assetSection)) {
      // Inject high-definition visual compression flags without restricting image dimensions
      return url.replace(assetSection, `${assetSection}q_auto:best,f_auto/`);
    }
  } catch (error) {
    console.warn("Could not parse Cloudinary URL for premium transformation, using original:", error);
  }

  return url;
}

/**
 * Optimizes Cloudinary & Unsplash hero background images specifically for desktop displays (1920px+).
 * Removes small width constraints (w_600, w_800, w_1200) and applies high-definition w_2560,c_limit or f_auto,q_auto:best.
 */
export function optimizeHeroCloudinaryUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  
  // Upgrade Unsplash image widths to 2560px for desktop crispness
  if (url.includes('images.unsplash.com')) {
    let upgraded = url;
    upgraded = upgraded.replace(/w=\d+/, 'w=2560').replace(/q=\d+/, 'q=90');
    if (!upgraded.includes('w=')) upgraded += '&w=2560';
    if (!upgraded.includes('q=')) upgraded += '&q=90';
    return upgraded;
  }

  if (!url.includes('cloudinary.com')) return url;

  try {
    let heroUrl = url;
    // Replace any small width flags like w_600, w_800, w_1200 with w_2560
    heroUrl = heroUrl.replace(/w_\d+/g, 'w_2560');
    // Replace eco or low quality settings with q_auto:best
    heroUrl = heroUrl.replace(/q_auto(:[a-z]+)?/g, 'q_auto:best');

    if (!heroUrl.includes('/q_auto') && !heroUrl.includes('/f_auto')) {
      if (heroUrl.includes('/image/upload/')) {
        heroUrl = heroUrl.replace('/image/upload/', '/image/upload/q_auto:best,f_auto,w_2560,c_limit/');
      }
    }
    return heroUrl;
  } catch (err) {
    return url;
  }
}

/**
 * Generates a thumbnail image poster URL for a Cloudinary video asset.
 * Injects `so_0` (seek offset 0s) and changes the file extension to `.jpg`.
 * Returns an empty string if the URL is invalid or doesn't contain `/video/upload/`.
 */
export function getCloudinaryVideoPoster(url: string): string {
  if (!url || typeof url !== 'string' || !url.includes('/video/upload/')) {
    return '';
  }

  try {
    let posterUrl = url.replace('/video/upload/', '/video/upload/so_0/');

    // Replace file extension with .jpg or append .jpg
    if (/\.[a-zA-Z0-9]+(?=\?|$)/.test(posterUrl)) {
      posterUrl = posterUrl.replace(/\.[a-zA-Z0-9]+(?=\?|$)/, '.jpg');
    } else {
      const queryIndex = posterUrl.indexOf('?');
      if (queryIndex !== -1) {
        posterUrl = posterUrl.slice(0, queryIndex) + '.jpg' + posterUrl.slice(queryIndex);
      } else {
        posterUrl += '.jpg';
      }
    }

    return posterUrl;
  } catch (error) {
    console.warn("Could not generate Cloudinary video poster URL:", error);
    return '';
  }
}

/**
 * Applies low-bandwidth optimization transformations (q_auto:eco,w_600) specifically for
 * small gallery tile previews on the homepage.
 */
export function getCloudinaryGalleryPreview(url: string): string {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return url || '';
  }

  if (url.includes('q_auto:eco') || url.includes('w_600')) {
    return url;
  }

  try {
    if (url.includes('/video/upload/')) {
      return url.replace('/video/upload/', '/video/upload/q_auto:eco,w_600/');
    }
    if (url.includes('/image/upload/')) {
      return url.replace('/image/upload/', '/image/upload/q_auto:eco,w_600/');
    }
  } catch (error) {
    console.warn("Could not apply Cloudinary gallery preview transformation:", error);
  }

  return url;
}

/**
 * Handles uploading a media file (Base64 string or File object) to the application's secure Express API proxy.
 * Avoids client-side API secret leakage. Allows bulk pipeline uploads.
 */
export async function uploadMediaToProxy(
  fileData: string,
  type: 'image' | 'video' = 'image',
  uploadPreset?: string
): Promise<{ success: boolean; url: string; isSimulated: boolean; error?: string }> {
  try {
    let preset = uploadPreset || (import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET || 'pamnim_preset';

    const response = await fetch('/api/media/upload', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file: fileData,
        type: type,
        uploadPreset: preset
      })
    });

    if (!response.ok) {
      throw new Error(`Proxy upload failed with status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      success: true,
      url: optimizeCloudinaryUrl(data.url, type),
      isSimulated: !!data.isSimulated,
    };
  } catch (error: any) {
    console.error("Cloudinary service direct upload failure:", error);
    return {
      success: false,
      url: '',
      isSimulated: false,
      error: error.message || 'File upload pipeline interrupted',
    };
  }
}
