import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

export function formatArea(acres: number): string {
  if (acres >= 1000) return `${(acres / 1000).toFixed(2)} k-ac`
  return `${acres.toFixed(2)} ac`
}
