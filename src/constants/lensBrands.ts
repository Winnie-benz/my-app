export const LENS_BRANDS = ['Essilor', 'Hoya', 'Nikon', 'Rodenstock', 'TOG', 'HITOP', 'Zeiss'] as const
export const LENS_INDEXES = ['1.50', '1.56', '1.60', '1.67', '1.74'] as const
export const LENS_PRODUCT_TYPES = ['Single vision', 'PAL', 'Bifocal'] as const

export function lensBrandOptions(currentBrand?: string) {
  const current = currentBrand?.trim()
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
