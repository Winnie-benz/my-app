export const LENS_BRANDS = ['Essilor', 'Hoya', 'Nikon', 'Rodenstock', 'TOG', 'HITOP', 'Zeiss'] as const
export const LENS_INDEXES = ['1.50', '1.56', '1.60', '1.67', '1.74'] as const
export const LENS_PRODUCT_TYPES = ['Single vision', 'PAL', 'Bifocal'] as const
const LENS_BRAND_ALIASES: Record<string, string> = {
  essi: 'Essilor',
}

export function normalizeLensBrand(brand?: string) {
  const trimmed = brand?.trim() ?? ''
  if (!trimmed) return ''
  return LENS_BRAND_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

export function lensBrandOptions(currentBrand?: string) {
  const current = normalizeLensBrand(currentBrand)
  return Array.from(new Set([
    ...LENS_BRANDS,
    ...(current ? [current] : []),
  ]))
}

export function lensIndexOptions(currentIndex?: string) {
  const current = currentIndex?.trim()
  return Array.from(new Set([
    ...LENS_INDEXES,
    ...(current ? [current] : []),
  ]))
}

export function lensProductTypeOptions(currentType?: string) {
  const current = currentType?.trim()
  return Array.from(new Set([
    ...LENS_PRODUCT_TYPES,
    ...(current ? [current] : []),
  ]))
}
