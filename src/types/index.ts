export const FORMAT_OPTIONS = [
  '4K Ultra HD Blu-ray',
  'Standard Blu-ray',
  'Digital',
  'VHS',
] as const

export const EDITION_OPTIONS = [
  'Standard',
  'Boutique',
  'DiabolikDVD',
  'Criterion',
  'Etsy',
] as const

export type Format = (typeof FORMAT_OPTIONS)[number]
export type Edition = (typeof EDITION_OPTIONS)[number]

export interface Movie {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

export interface CollectionItem extends Movie {
  format: Format | ''
  edition: Edition | ''
}
