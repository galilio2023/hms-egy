/**
 * HMS Egypt - Hospital & Tenant Utilities
 */

/**
 * Resolves the hospital slug from the hostname.
 * In production: hospital-slug.hms-egypt.com -> hospital-slug
 * In development: localhost:3000/slug -> handled via path or header
 */
export function getHospitalSlug(hostname: string): string | null {
  const parts = hostname.split(".");
  
  // Production: [slug].hms-egypt.com
  if (parts.length >= 3) {
    return parts[0];
  }

  // Development or unknown
  return null;
}

/**
 * Generates a clean URL slug from a hospital name.
 */
export function generateHospitalSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Remove consecutive hyphens
    .trim();
}
