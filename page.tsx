'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Download,
  LayoutDashboard,
  Menu,
  Package,
  Printer,
  Receipt,
  Search,
  Settings2,
  SlidersHorizontal,
  TrendingUp,
  Users,
  WalletCards,
  X,
  Boxes,
  ClipboardList,
  FileText,
  HandCoins,
  House,
  Landmark,
  PanelLeftClose,
  PanelLeftOpen,
  Truck,
  CircleUserRound,
} from 'lucide-react'

type Role = 'Sales Assistant' | 'Inventory Manager' | 'Accountant' | 'Owner'

type Book = {
  title: string
  author: string
  category: string
  isbn: string
  usd: number
  available: number
  reserved: number
  onOrder: number
  shelves: { location: string; code: string; copies: number }[]
  status: 'OK' | 'Order soon' | 'Out of stock'
}

const SUPPLIER_LEAD_DAYS: Record<string, number> = { Sodis: 21, 'Gallimard Export': 14, 'Hachette Livre': 28, 'Actes Sud': 18, 'Éditions du Seuil': 16, 'Éditions Flammarion': 19, 'Albin Michel Export': 23, 'Éditions de Minuit': 25 }
function addBusinessDays(start: Date, days: number) { const date = new Date(start); let remaining = days; while (remaining > 0) { date.setDate(date.getDate() + 1); if (date.getDay() !== 0 && date.getDay() !== 6) remaining -= 1 } return date }
function formatDeliveryDate(date: Date) { return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
// ---- Shared pricing: every EGP book price in the app comes from this one function ----
const DEFAULT_RATE = 48.7
const PRICE_MARKUP = 1.08
function priceEGP(usd: number, rate: number) { return Math.round(usd * rate * PRICE_MARKUP) }
type RateChange = { rate: number; note: string; setBy: string; at: string; source: string }
const INITIAL_RATE_HISTORY: RateChange[] = [
  { rate: 48.7, note: 'Opening rate', setBy: 'Mme Hoda', at: '2026-11-02T09:42:00', source: 'manual' },
  { rate: 47.95, note: 'Invoice settlement', setBy: 'Salma Fathy', at: '2026-10-31T16:18:00', source: 'manual' },
  { rate: 47.6, note: 'Monthly review', setBy: 'Karim El-Sayed', at: '2026-10-15T10:04:00', source: 'manual' },
]
function formatRateTime(iso: string) { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  return url && key ? createClient(url, key) : null
}
function notify(message: string) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('desk-toast', { detail: message })) }
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  notify(`Exported ${rows.length - 1} rows to ${filename}`)
}
type Sale = { no: string; at: string; cashier: string; payment: string; lines: { title: string; isbn: string; qty: number; unit: number }[]; discountPct: number; total: number; rate: number }
type BookRequest = { no: string; title: string; requester: string; type: string; qty: number; status: string; customer: string; phone: string; channel: string; notes: string; deposit: string }
const INITIAL_SALES: Sale[] = [
  { no: 'R-1044', at: '2026-11-26T10:42:00', cashier: 'Nour Hassan', payment: 'Cash', lines: [{ title: 'Le Petit Prince', isbn: '9782070612758', qty: 2, unit: 447 }, { title: 'Candide', isbn: '9782070406540', qty: 1, unit: 342 }], discountPct: 0, total: 1236, rate: 48.7 },
  { no: 'R-1043', at: '2026-11-26T10:18:00', cashier: 'Nour Hassan', payment: 'Card', lines: [{ title: 'Les Misérables', isbn: '9782253004226', qty: 1, unit: 657 }], discountPct: 0, total: 657, rate: 48.7 },
  { no: 'R-1042', at: '2026-11-25T17:06:00', cashier: 'Karim El-Sayed', payment: 'Cash', lines: [{ title: 'L’Étranger', isbn: '9782070360024', qty: 1, unit: 363 }], discountPct: 0, total: 363, rate: 48.7 },
]
const INITIAL_REQUESTS: BookRequest[] = [
  { no: 'REQ-015', title: 'The Little Prince — English edition', requester: 'Nour Hassan', type: 'Customer', qty: 2, status: 'Waiting approval', customer: 'Mariam Adel', phone: '+20 10 5555 0182', channel: 'WhatsApp', notes: 'Contact when stock arrives. Customer prefers evening pickup.', deposit: 'EGP 380 · 50%' },
  { no: 'REQ-014', title: 'Grammaire progressive du français', requester: 'Karim El-Sayed', type: 'Internal', qty: 6, status: 'On purchase order', customer: '—', phone: '—', channel: '—', notes: 'French learning shelf replenishment.', deposit: '—' },
  { no: 'REQ-013', title: 'L’Amant · Marguerite Duras', requester: 'Nour Hassan', type: 'Customer', qty: 1, status: 'Arrived – reserved', customer: 'Omar Nabil', phone: '+20 10 5555 0144', channel: 'WhatsApp', notes: 'Customer notified when copy was received.', deposit: 'EGP 420 · Paid' },
]
function normalizeSearchText(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim() }
function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[right.length]
}
function rankBooksBySearch(search: string, limit: number) {
  const query = normalizeSearchText(search)
  if (!query) return []
  const tokens = query.split(/\s+/).filter(Boolean)
  const compactQuery = query.replace(/\s/g, '')
  return books.map((book) => {
    const fields = [book.title, book.author, book.category].map(normalizeSearchText)
    const words = fields.flatMap((field) => field.split(/\s+/))
    const isbn = book.isbn.replace(/\D/g, '')
    const tokenMatches = tokens.map((token) => fields.some((field) => field.includes(token) || field.split(/\s+/).some((word) => word.startsWith(token))) || (token.length >= 5 && words.some((word) => word.length >= 5 && editDistance(token, word) <= 1)))
    if (!tokenMatches.every(Boolean) && !(compactQuery.length >= 3 && isbn.includes(compactQuery))) return null
    let score = 20
    const title = fields[0]
    const category = fields[2]
    if (compactQuery === isbn) score = 0
    else if (title === query) score = 1
    else if (title.startsWith(query)) score = 2
    else if (title.includes(query)) score = 3
    else if (category === query) score = 4
    else if (category.startsWith(query)) score = 5
    else if (category.includes(query)) score = 6
    else if (fields.some((field) => field.includes(query))) score = 7
    else score = tokens.reduce((total, token) => total + Math.min(...words.map((word) => word.includes(token) ? 0 : token.length >= 5 ? editDistance(token, word) : 2)), 0) + 10
    return { book, score }
  }).filter((item): item is { book: Book; score: number } => item !== null).sort((a, b) => a.score - b.score || a.book.title.localeCompare(b.book.title)).slice(0, limit).map(({ book }) => book)
}

const books: Book[] = [
  { title: 'L’Étranger', author: 'Albert Camus', category: 'Littérature', isbn: '9782070360024', usd: 6.9, available: 6, reserved: 1, onOrder: 6, shelves: [{ location: 'Shop floor', code: 'SF-A1', copies: 0 }, { location: 'Basement store', code: 'BS-B3', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-R2', copies: 0 }], status: 'Order soon' },
  { title: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', category: 'Classiques', isbn: '9782070612758', usd: 8.5, available: 8, reserved: 0, onOrder: 0, shelves: [{ location: 'Shop floor', code: 'SF-A2', copies: 8 }, { location: 'Basement store', code: 'BS-B1', copies: 0 }, { location: 'Zamalek Depo', code: 'DP-R1', copies: 0 }], status: 'OK' },
  { title: 'Madame Bovary', author: 'Gustave Flaubert', category: 'Classiques', isbn: '9782070409334', usd: 7.2, available: 4, reserved: 0, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-A4', copies: 4 }, { location: 'Basement store', code: 'BS-B2', copies: 0 }, { location: 'Zamalek Depo', code: 'DP-R3', copies: 0 }], status: 'OK' },
  { title: 'Chanson douce', author: 'Leïla Slimani', category: 'Littérature', isbn: '9782072857207', usd: 9.8, available: 2, reserved: 0, onOrder: 0, shelves: [{ location: 'Shop floor', code: 'SF-C1', copies: 2 }, { location: 'Basement store', code: 'BS-C4', copies: 0 }, { location: 'Zamalek Depo', code: 'DP-R4', copies: 0 }], status: 'Order soon' },
  { title: 'Mendiants et orgueilleux', author: 'Albert Cossery', category: 'Littérature', isbn: '9782070369928', usd: 8.2, available: 0, reserved: 0, onOrder: 5, shelves: [{ location: 'Shop floor', code: 'SF-C3', copies: 0 }, { location: 'Basement store', code: 'BS-C7', copies: 3 }, { location: 'Zamalek Depo', code: 'DP-R8', copies: 0 }], status: 'Out of stock' },
  { title: 'Astérix le Gaulois', author: 'René Goscinny', category: 'Bande dessinée', isbn: '9782012100014', usd: 10.4, available: 9, reserved: 1, onOrder: 0, shelves: [{ location: 'Shop floor', code: 'SF-D1', copies: 10 }, { location: 'Basement store', code: 'BS-D2', copies: 0 }, { location: 'Zamalek Depo', code: 'DP-R9', copies: 0 }], status: 'OK' },
  { title: 'La Peste', author: 'Albert Camus', category: 'Littérature', isbn: '9782070360420', usd: 8.9, available: 12, reserved: 2, onOrder: 6, shelves: [{ location: 'Shop floor', code: 'SF-B1', copies: 8 }, { location: 'Basement store', code: 'BS-A2', copies: 3 }, { location: 'Zamalek Depo', code: 'DP-R5', copies: 1 }], status: 'OK' },
  { title: 'Germinal', author: 'Émile Zola', category: 'Classiques', isbn: '9782070413119', usd: 7.4, available: 5, reserved: 0, onOrder: 10, shelves: [{ location: 'Shop floor', code: 'SF-B2', copies: 5 }, { location: 'Basement store', code: 'BS-A4', copies: 0 }, { location: 'Zamalek Depo', code: 'DP-R6', copies: 0 }], status: 'Order soon' },
  { title: 'Les Misérables', author: 'Victor Hugo', category: 'Classiques', isbn: '9782253004226', usd: 12.5, available: 7, reserved: 1, onOrder: 4, shelves: [{ location: 'Shop floor', code: 'SF-B3', copies: 4 }, { location: 'Basement store', code: 'BS-A5', copies: 2 }, { location: 'Zamalek Depo', code: 'DP-R7', copies: 1 }], status: 'OK' },
  { title: 'Bonjour tristesse', author: 'Françoise Sagan', category: 'Littérature', isbn: '9782070368228', usd: 6.8, available: 3, reserved: 0, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-C2', copies: 3 }, { location: 'Basement store', code: 'BS-C5', copies: 0 }, { location: 'Zamalek Depo', code: 'DP-R10', copies: 0 }], status: 'Order soon' },
  { title: 'L’Écume des jours', author: 'Boris Vian', category: 'Littérature', isbn: '9782070368235', usd: 8.1, available: 4, reserved: 1, onOrder: 5, shelves: [{ location: 'Shop floor', code: 'SF-C4', copies: 2 }, { location: 'Basement store', code: 'BS-C6', copies: 1 }, { location: 'Zamalek Depo', code: 'DP-R11', copies: 1 }], status: 'OK' },
  { title: 'Le Comte de Monte-Cristo', author: 'Alexandre Dumas', category: 'Aventure', isbn: '9782253004110', usd: 14.2, available: 6, reserved: 0, onOrder: 3, shelves: [{ location: 'Shop floor', code: 'SF-E1', copies: 4 }, { location: 'Basement store', code: 'BS-E2', copies: 1 }, { location: 'Zamalek Depo', code: 'DP-R12', copies: 1 }], status: 'OK' },
  { title: 'En attendant Godot', author: 'Samuel Beckett', category: 'Théâtre', isbn: '9782070360536', usd: 7.9, available: 2, reserved: 0, onOrder: 6, shelves: [{ location: 'Shop floor', code: 'SF-E3', copies: 2 }, { location: 'Basement store', code: 'BS-E4', copies: 0 }, { location: 'Zamalek Depo', code: 'DP-R13', copies: 0 }], status: 'Order soon' },
  { title: 'Notre-Dame de Paris', author: 'Victor Hugo', category: 'Classiques', isbn: '9782253096346', usd: 11.5, available: 19, reserved: 1, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-F1', copies: 8 }, { location: 'Basement store', code: 'BS-F1', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-F1', copies: 5 }], status: 'OK' },
  { title: 'Le Rouge et le Noir', author: 'Stendhal', category: 'Classiques', isbn: '9782070374978', usd: 9.4, available: 14, reserved: 2, onOrder: 6, shelves: [{ location: 'Shop floor', code: 'SF-F2', copies: 6 }, { location: 'Basement store', code: 'BS-F2', copies: 6 }, { location: 'Zamalek Depo', code: 'DP-F2', copies: 4 }], status: 'OK' },
  { title: 'Candide', author: 'Voltaire', category: 'Classiques', isbn: '9782070406540', usd: 6.5, available: 23, reserved: 1, onOrder: 12, shelves: [{ location: 'Shop floor', code: 'SF-F3', copies: 10 }, { location: 'Basement store', code: 'BS-F3', copies: 8 }, { location: 'Zamalek Depo', code: 'DP-F3', copies: 6 }], status: 'OK' },
  { title: 'Le Père Goriot', author: 'Honoré de Balzac', category: 'Classiques', isbn: '9782070368785', usd: 8.2, available: 16, reserved: 2, onOrder: 5, shelves: [{ location: 'Shop floor', code: 'SF-F4', copies: 7 }, { location: 'Basement store', code: 'BS-F4', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-F4', copies: 4 }], status: 'OK' },
  { title: 'Bel-Ami', author: 'Guy de Maupassant', category: 'Littérature', isbn: '9782253004875', usd: 7.8, available: 20, reserved: 2, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-G1', copies: 9 }, { location: 'Basement store', code: 'BS-G1', copies: 8 }, { location: 'Zamalek Depo', code: 'DP-G1', copies: 5 }], status: 'OK' },
  { title: 'Le Horla', author: 'Guy de Maupassant', category: 'Littérature', isbn: '9782070369232', usd: 5.9, available: 17, reserved: 1, onOrder: 6, shelves: [{ location: 'Shop floor', code: 'SF-G2', copies: 8 }, { location: 'Basement store', code: 'BS-G2', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-G2', copies: 3 }], status: 'OK' },
  { title: 'Vingt mille lieues sous les mers', author: 'Jules Verne', category: 'Aventure', isbn: '9782070402566', usd: 10.2, available: 21, reserved: 1, onOrder: 10, shelves: [{ location: 'Shop floor', code: 'SF-G3', copies: 9 }, { location: 'Basement store', code: 'BS-G3', copies: 8 }, { location: 'Zamalek Depo', code: 'DP-G3', copies: 5 }], status: 'OK' },
  { title: 'Le Tour du monde en quatre-vingts jours', author: 'Jules Verne', category: 'Aventure', isbn: '9782070409891', usd: 9.7, available: 18, reserved: 2, onOrder: 7, shelves: [{ location: 'Shop floor', code: 'SF-G4', copies: 8 }, { location: 'Basement store', code: 'BS-G4', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-G4', copies: 5 }], status: 'OK' },
  { title: 'L’Avare', author: 'Molière', category: 'Théâtre', isbn: '9782070368051', usd: 6.2, available: 15, reserved: 1, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-H1', copies: 7 }, { location: 'Basement store', code: 'BS-H1', copies: 6 }, { location: 'Zamalek Depo', code: 'DP-H1', copies: 3 }], status: 'OK' },
  { title: 'Le Cid', author: 'Pierre Corneille', category: 'Théâtre', isbn: '9782070360598', usd: 6.4, available: 13, reserved: 1, onOrder: 5, shelves: [{ location: 'Shop floor', code: 'SF-H2', copies: 6 }, { location: 'Basement store', code: 'BS-H2', copies: 5 }, { location: 'Zamalek Depo', code: 'DP-H2', copies: 3 }], status: 'OK' },
  { title: 'Les Fleurs du mal', author: 'Charles Baudelaire', category: 'Poésie', isbn: '9782070401309', usd: 8.6, available: 22, reserved: 2, onOrder: 9, shelves: [{ location: 'Shop floor', code: 'SF-H3', copies: 10 }, { location: 'Basement store', code: 'BS-H3', copies: 9 }, { location: 'Zamalek Depo', code: 'DP-H3', copies: 5 }], status: 'OK' },
  { title: 'Le Dormeur du val', author: 'Arthur Rimbaud', category: 'Poésie', isbn: '9782070320784', usd: 5.5, available: 12, reserved: 1, onOrder: 5, shelves: [{ location: 'Shop floor', code: 'SF-H4', copies: 5 }, { location: 'Basement store', code: 'BS-H4', copies: 5 }, { location: 'Zamalek Depo', code: 'DP-H4', copies: 3 }], status: 'OK' },
  { title: 'Le Livre de ma mère', author: 'Albert Cohen', category: 'Littérature', isbn: '9782070369478', usd: 8.8, available: 16, reserved: 2, onOrder: 7, shelves: [{ location: 'Shop floor', code: 'SF-J1', copies: 7 }, { location: 'Basement store', code: 'BS-J1', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-J1', copies: 4 }], status: 'OK' },
  { title: 'La Gloire de mon père', author: 'Marcel Pagnol', category: 'Littérature', isbn: '9782070368952', usd: 8.1, available: 20, reserved: 1, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-J2', copies: 9 }, { location: 'Basement store', code: 'BS-J2', copies: 8 }, { location: 'Zamalek Depo', code: 'DP-J2', copies: 4 }], status: 'OK' },
  { title: 'Le Château de ma mère', author: 'Marcel Pagnol', category: 'Littérature', isbn: '9782070368969', usd: 8.1, available: 17, reserved: 2, onOrder: 6, shelves: [{ location: 'Shop floor', code: 'SF-J3', copies: 8 }, { location: 'Basement store', code: 'BS-J3', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-J3', copies: 4 }], status: 'OK' },
  { title: 'L’Amant', author: 'Marguerite Duras', category: 'Littérature', isbn: '9782070389330', usd: 9.1, available: 19, reserved: 1, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-J4', copies: 9 }, { location: 'Basement store', code: 'BS-J4', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-J4', copies: 4 }], status: 'OK' },
  { title: 'La Vie devant soi', author: 'Romain Gary', category: 'Littérature', isbn: '9782070373629', usd: 9.3, available: 14, reserved: 2, onOrder: 6, shelves: [{ location: 'Shop floor', code: 'SF-K1', copies: 6 }, { location: 'Basement store', code: 'BS-K1', copies: 6 }, { location: 'Zamalek Depo', code: 'DP-K1', copies: 4 }], status: 'OK' },
  { title: 'L’Élégance du hérisson', author: 'Muriel Barbery', category: 'Littérature', isbn: '9782070344292', usd: 10.5, available: 24, reserved: 2, onOrder: 10, shelves: [{ location: 'Shop floor', code: 'SF-K2', copies: 11 }, { location: 'Basement store', code: 'BS-K2', copies: 9 }, { location: 'Zamalek Depo', code: 'DP-K2', copies: 6 }], status: 'OK' },
  { title: 'La Délicatesse', author: 'David Foenkinos', category: 'Littérature', isbn: '9782070444405', usd: 9.8, available: 18, reserved: 2, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-K3', copies: 8 }, { location: 'Basement store', code: 'BS-K3', copies: 7 }, { location: 'Zamalek Depo', code: 'DP-K3', copies: 5 }], status: 'OK' },
  { title: 'Le Petit Nicolas', author: 'René Goscinny', category: 'Jeunesse', isbn: '9782070612765', usd: 7.6, available: 28, reserved: 2, onOrder: 12, shelves: [{ location: 'Shop floor', code: 'SF-K4', copies: 13 }, { location: 'Basement store', code: 'BS-K4', copies: 10 }, { location: 'Zamalek Depo', code: 'DP-K4', copies: 7 }], status: 'OK' },
  { title: 'Astérix chez les Bretons', author: 'René Goscinny', category: 'Bande dessinée', isbn: '9782012100106', usd: 10.4, available: 21, reserved: 3, onOrder: 8, shelves: [{ location: 'Shop floor', code: 'SF-L1', copies: 10 }, { location: 'Basement store', code: 'BS-L1', copies: 9 }, { location: 'Zamalek Depo', code: 'DP-L1', copies: 5 }], status: 'OK' },
  { title: 'Tintin au Tibet', author: 'Hergé', category: 'Bande dessinée', isbn: '9782203001127', usd: 11.2, available: 17, reserved: 1, onOrder: 7, shelves: [{ location: 'Shop floor', code: 'SF-L2', copies: 8 }, { location: 'Basement store', code: 'BS-L2', copies: 6 }, { location: 'Zamalek Depo', code: 'DP-L2', copies: 4 }], status: 'OK' },
]

const roles: { role: Role; person: string; initials: string; tone: string }[] = [
  { role: 'Sales Assistant', person: 'Nour Hassan', initials: 'NH', tone: 'blue' },
  { role: 'Inventory Manager', person: 'Karim El-Sayed', initials: 'KE', tone: 'green' },
  { role: 'Accountant', person: 'Salma Fathy', initials: 'SF', tone: 'orange' },
  { role: 'Owner', person: 'Mme Hoda', initials: 'MH', tone: 'purple' },
]

function Logo() { return <div className="brand-lockup"><img className="brand-logo" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ldf-logo-1CzgDamk5DERnClf5cHW8iWgyaujbF.png" alt="Les Livres de France official seal" /><span className="brand-sub">Inventory workspace</span></div> }

function SalesWorkspace({ view, role, cashier, exchangeRate = DEFAULT_RATE, sales, onSale }: { view: 'sell' | 'receipts' | 'dashboard'; role: Role; cashier: string; exchangeRate?: number; sales: Sale[]; onSale: (sale: Sale) => void }) {
  // Cart lines keep the USD reference price; the EGP price is recalculated from the live rate on every render.
  const [cart, setCart] = useState<{ title: string; isbn: string; qty: number; usd: number }[]>([{ title: 'Le Petit Prince', isbn: '9782070612758', qty: 1, usd: 8.5 }, { title: 'L’Étranger', isbn: '9782070360024', qty: 2, usd: 6.9 }])
  const [payment, setPayment] = useState('Cash')
  const [discountPct, setDiscountPct] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [search, setSearch] = useState('')
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [autoMoveRequest, setAutoMoveRequest] = useState<{ title: string; from: string; quantity: number } | null>(null)
  const [receiptSearch, setReceiptSearch] = useState('')
  const [receiptPayment, setReceiptPayment] = useState('All payments')
  const [receiptDate, setReceiptDate] = useState('All dates')
  const [openReceipt, setOpenReceipt] = useState<Sale | null>(null)
  const lines = cart.map((line) => ({ ...line, price: priceEGP(line.usd, exchangeRate) }))
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  const discount = Math.round(subtotal * discountPct / 100)
  const total = subtotal - discount
  const availableFor = (isbn: string) => books.find((book) => book.isbn === isbn)?.available ?? 0
  const addToCart = (book: Book) => {
    const existing = cart.find((line) => line.isbn === book.isbn)
    if ((existing?.qty || 0) >= book.available) { notify(`Only ${book.available} available copies of ${book.title}`); return }
    setCart(existing ? cart.map((line) => line.isbn === book.isbn ? { ...line, qty: line.qty + 1 } : line) : [...cart, { title: book.title, isbn: book.isbn, qty: 1, usd: book.usd }])
  }
  const onSearch = (value: string) => {
    const digits = value.replace(/\D/g, '')
    const exact = digits.length === 13 ? books.find((book) => book.isbn === digits) : undefined
    if (exact) { addToCart(exact); setSearch(''); return }
    setSearch(value)
  }
  const completeSale = () => {
    if (!cart.length || (discountPct > 0 && !discountReason.trim())) return
    const moveCandidate = cart.map((line) => ({ line, book: books.find((book) => book.isbn === line.isbn) })).find(({ line, book }) => book && (book.shelves.find((shelf) => shelf.location === 'Shop floor')?.copies || 0) <= line.qty && book.shelves.some((shelf) => shelf.location !== 'Shop floor' && shelf.copies > 0))
    if (moveCandidate?.book) { const source = moveCandidate.book.shelves.find((shelf) => shelf.location !== 'Shop floor' && shelf.copies > 0); setAutoMoveRequest({ title: moveCandidate.book.title, from: source?.location || 'Basement store', quantity: Math.min(moveCandidate.line.qty, source?.copies || 1) }); notify(`Automatic stock move request created for ${moveCandidate.book.title}`) } else setAutoMoveRequest(null)
    const lastNo = Math.max(1044, ...sales.map((sale) => Number(sale.no.replace(/\D/g, '')) || 0))
    const sale: Sale = { no: `R-${lastNo + 1}`, at: new Date().toISOString(), cashier, payment, lines: lines.map((line) => ({ title: line.title, isbn: line.isbn, qty: line.qty, unit: line.price })), discountPct, total, rate: exchangeRate }
    onSale(sale)
    setCompletedSale(sale)
  }
  const receiptView = (sale: Sale, actions: React.ReactNode, notice?: React.ReactNode) => { const gross = sale.lines.reduce((sum, line) => sum + line.unit * line.qty, 0); return <section className="receipt-screen"><div className="receipt-screen-top"><div><p className="eyebrow">{notice ? 'Sale completed' : 'Receipt'}</p><h1>Receipt {sale.no}</h1><p className="subheading">{notice ? 'The sale was recorded successfully.' : 'Reprint or save this receipt as a PDF.'}</p>{notice}</div><button className="outline-button" onClick={() => window.print()}><Printer /> Print receipt</button></div><div className="receipt-paper"><div className="receipt-brand">Les Livres de France<span>BOOKSHOP RECEIPT</span></div><div className="receipt-meta"><span>{sale.no}</span><span>{new Date(sale.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span><span>Cashier: {sale.cashier}</span></div><div className="receipt-lines">{sale.lines.map((line) => <div className="receipt-line" key={line.isbn}><span>{line.qty} × {line.title}<small>ISBN {line.isbn} · {line.unit} EGP each</small></span><strong>{(line.unit * line.qty).toLocaleString()} EGP</strong></div>)}{sale.discountPct > 0 && <div className="receipt-line"><span>Discount {sale.discountPct}%</span><strong>-{(gross - sale.total).toLocaleString()} EGP</strong></div>}</div><div className="receipt-total"><span>Total</span><strong>{sale.total.toLocaleString()} EGP</strong></div><div className="receipt-payment"><span>Payment method <b>{sale.payment}</b></span><span>Rate used {sale.rate.toFixed(2)} EGP/USD</span><span>Thank you for your purchase.</span></div></div><div className="receipt-screen-actions">{actions}</div></section> }
  if (completedSale) return receiptView(completedSale, <><button className="primary-button" onClick={() => { setCompletedSale(null); setCart([]); setDiscountPct(0); setDiscountReason(''); setAutoMoveRequest(null) }}>Start new sale</button><button className="text-button" onClick={() => window.print()}>Print / save PDF</button></>, autoMoveRequest ? <div className="auto-move-notice"><strong>Stock move request sent</strong><span>{autoMoveRequest.title} sold out on Shop floor. Request {autoMoveRequest.quantity} copy from {autoMoveRequest.from}.</span></div> : <span />)
  if (view === 'receipts' && openReceipt) return receiptView(openReceipt, <button className="primary-button" onClick={() => setOpenReceipt(null)}>← Back to receipts</button>)
  if (view === 'receipts') {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const q = receiptSearch.trim().toLowerCase()
    const shown = sales.filter((sale) => (receiptPayment === 'All payments' || sale.payment === receiptPayment) && (receiptDate === 'All dates' || (receiptDate === 'Today' ? new Date(sale.at).toDateString() === today : new Date(sale.at).toDateString() === yesterday)) && (!q || `${sale.no} ${sale.cashier} ${sale.lines.map((line) => line.title).join(' ')}`.toLowerCase().includes(q)))
    const todaySales = sales.filter((sale) => new Date(sale.at).toDateString() === today)
    const sumBy = (pay: string) => todaySales.filter((sale) => sale.payment === pay).reduce((sum, sale) => sum + sale.total, 0)
    const cycle = (options: string[], current: string) => options[(options.indexOf(current) + 1) % options.length]
    return <section className="sales-page"><div className="sales-heading"><div><p className="eyebrow">Receipts</p><h1>Sales history</h1><p className="subheading">Find, open, and reprint any receipt.</p></div><button className="outline-button" onClick={() => downloadCsv('llf-receipts.csv', [['Receipt', 'Date', 'Cashier', 'Payment', 'Items', 'Discount %', 'Total EGP', 'Rate EGP/USD'], ...shown.map((sale) => [sale.no, new Date(sale.at).toLocaleString('en-GB'), sale.cashier, sale.payment, sale.lines.map((line) => `${line.qty}x ${line.title}`).join('; '), sale.discountPct, sale.total, sale.rate])])}><Download /> Export CSV</button></div><div className="receipt-toolbar"><label className="search-box"><Search /><input value={receiptSearch} onChange={(event) => setReceiptSearch(event.target.value)} placeholder="Search receipt, cashier or book" /></label><button className="date-picker" onClick={() => setReceiptDate(cycle(['All dates', 'Today', 'Yesterday'], receiptDate))}><CalendarDays /> {receiptDate} <ChevronDown /></button><button className="filter-button" onClick={() => setReceiptPayment(cycle(['All payments', 'Cash', 'Card', 'Division'], receiptPayment))}><SlidersHorizontal /> {receiptPayment}</button></div><div className="closing-card"><div><span className="eyebrow">Daily closing summary</span><strong>Today, {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div><div><span>Receipts <b>{todaySales.length}</b></span><span>Cash <b>EGP {sumBy('Cash').toLocaleString()}</b></span><span>Card <b>EGP {sumBy('Card').toLocaleString()}</b></span><span>Discounts <b>EGP {todaySales.reduce((sum, sale) => sum + sale.lines.reduce((s, line) => s + line.unit * line.qty, 0) - sale.total, 0).toLocaleString()}</b></span></div></div><div className="receipt-list">{shown.length ? shown.map((sale) => <button className="receipt-row" key={sale.no} onClick={() => setOpenReceipt(sale)}><span className="receipt-icon"><Receipt /></span><span><strong>{sale.no}</strong><small>{new Date(sale.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {sale.cashier} · {sale.payment} · {sale.total.toLocaleString()} EGP</small></span><span className="receipt-actions"><Printer /> Open & reprint <ChevronRight /></span></button>) : <p className="transfer-no-results">No receipts match these filters.</p>}</div></section>
  }
  const results = books.filter((book) => !search.trim() || normalizeSearchText(`${book.title} ${book.author}`).includes(normalizeSearchText(search)) || book.isbn.includes(search.replace(/\D/g, '') || '§')).slice(0, 8)
  return <section className="sales-page"><div className="sales-heading"><div><p className="eyebrow">Sales desk · {role}</p><h1>Make a sale</h1><p className="subheading">Scan a barcode or search the catalogue. Reserved copies stay protected.</p></div><div className="sale-status"><span className="status-dot" />Till open · {exchangeRate.toFixed(2)} EGP/USD</div></div><div className="sell-layout"><div className="sell-catalog"><label className="search-box sell-search"><Search /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Scan ISBN or search by title" /><kbd>⌘ K</kbd></label><div className="scan-note"><BookOpen /> Exact ISBN adds the book directly to the cart</div><div className="sell-results">{results.map(book => <button key={book.isbn} className="sell-result" disabled={book.available === 0} onClick={() => addToCart(book)}><span className="book-cover"><BookOpen /></span><span><strong>{book.title}</strong><small>{book.author} · {book.available ? `${book.available} available` : 'No available copies'}</small></span><b>{priceEGP(book.usd, exchangeRate)} EGP</b><span className="add-circle">+</span></button>)}</div></div><div className="cart-panel"><div className="cart-header"><div><span className="eyebrow">Current sale</span><h2>Cart <small>{cart.length} lines</small></h2></div><button className="text-button" disabled={!cart.length} onClick={() => setCart([])}>Clear</button></div><div className="cart-lines">{lines.length ? lines.map((line, index) => <div className="cart-line" key={line.isbn}><div><strong>{line.title}</strong><small>{line.price} EGP · SF shelf first · <button className="link-button" onClick={() => setCart(cart.filter((_, i) => i !== index))}>Remove</button></small></div><div className="qty"><button aria-label={`Decrease ${line.title}`} onClick={() => line.qty > 1 ? setCart(cart.map((x, i) => i === index ? { ...x, qty: x.qty - 1 } : x)) : setCart(cart.filter((_, i) => i !== index))}>−</button><b>{line.qty}</b><button aria-label={`Increase ${line.title}`} disabled={line.qty >= availableFor(line.isbn)} onClick={() => setCart(cart.map((x, i) => i === index ? { ...x, qty: x.qty + 1 } : x))}>+</button></div><strong>{(line.price * line.qty).toLocaleString()} EGP</strong></div>) : <p className="transfer-no-results">Cart is empty. Search or scan a book to add it.</p>}</div><div className="discount-row"><span>Discount</span><select aria-label="Discount" className="discount-select" value={discountPct} onChange={(event) => setDiscountPct(Number(event.target.value))}>{[0, 5, 10, 15, 20].map((pct) => <option key={pct} value={pct}>{pct}%</option>)}</select>{discountPct > 0 ? <input className="discount-reason" value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Reason (required)" /> : <small>Reason required above 0%</small>}</div><div className="totals"><span>Subtotal <b>{subtotal.toLocaleString()} EGP</b></span><span>Discounts <b>-{discount.toLocaleString()} EGP</b></span><div>To pay <strong>{total.toLocaleString()} <small>EGP</small></strong></div><p>Prices include VAT 14% · rate {exchangeRate.toFixed(2)} EGP/USD</p></div><div className="payment-toggle"><button className={payment === 'Cash' ? 'selected' : ''} onClick={() => setPayment('Cash')}><WalletCards /> Cash</button><button className={payment === 'Card' ? 'selected' : ''} onClick={() => setPayment('Card')}><CreditCard /> Card</button><button className={payment === 'Division' ? 'selected' : ''} onClick={() => setPayment('Division')}><Users /> Division</button></div><button className="complete-sale" disabled={!cart.length || (discountPct > 0 && !discountReason.trim())} onClick={completeSale}><Receipt /> Complete sale</button></div></div></section>
}

function PurchaseOrdersWorkspace({ role, person, requests, setRequests }: { role: Role; person: string; requests: BookRequest[]; setRequests: (requests: BookRequest[]) => void }) {
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [poError, setPoError] = useState('')
  const [fromRequests, setFromRequests] = useState<string[]>([])
  const nowLabel = () => new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const [orders, setOrders] = useState([
    { no: 'PO-209', lines: '8 titles · 42 copies', supplier: 'Sodis', stage: 'Waiting for approval', amount: 412.8, egp: 21640, paid: 0, due: '9 Nov 2026', dueLabel: 'due in 7 days', payment: 'Waiting for payment', placed: 'Karim · 2 Nov 2026, 14:05', createdBy: 'Inventory Manager', approved: '' },
    { no: 'PO-208', lines: '4 titles · 18 copies', supplier: 'Gallimard Export', stage: 'Sent', amount: 144.2, egp: 7560, paid: 144.2, due: '30 Oct 2026', dueLabel: 'Paid on 30 Oct', payment: 'Paid', placed: 'Karim · 28 Oct 2026, 09:18', createdBy: 'Inventory Manager', approved: 'Salma · 28 Oct 2026, 10:02' },
    { no: 'PO-207', lines: '6 titles · 30 copies', supplier: 'Hachette Livre', stage: 'Received', amount: 318.4, egp: 16720, paid: 120, due: '5 Nov 2026', dueLabel: 'due in 5 days', payment: 'Partly paid', placed: 'Karim · 20 Oct 2026, 12:12', createdBy: 'Inventory Manager', approved: 'Mme Hoda · 20 Oct 2026, 13:01' },
    { no: 'PO-206', lines: '3 titles · 12 copies', supplier: 'Actes Sud', stage: 'Received', amount: 210, egp: 10920, paid: 0, due: '23 Oct 2026', dueLabel: 'overdue by 10 days', payment: 'Overdue', placed: 'Karim · 1 Oct 2026, 11:06', createdBy: 'Inventory Manager', approved: 'Salma · 1 Oct 2026, 11:30' },
  ])
  const [paymentOrder, setPaymentOrder] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [poFormOpen, setPoFormOpen] = useState(false)
  const [poForm, setPoForm] = useState({ supplier: 'Sodis', contact: 'orders@sodis.fr', title: '', isbn: '', qty: '1', unitPrice: '', requestedDate: '', notes: '' })
  const updatePoForm = (key: keyof typeof poForm, value: string) => setPoForm({ ...poForm, [key]: value })
  const minDeliveryDate = addBusinessDays(new Date(), SUPPLIER_LEAD_DAYS[poForm.supplier] || 21).toISOString().slice(0, 10)
  const createPurchaseOrder = () => {
    if (!poForm.supplier || !poForm.title || !poForm.qty || !poForm.unitPrice) { setPoError('Supplier, book, quantity and unit price are required.'); return }
    if (Number(poForm.qty) < 1 || Number(poForm.unitPrice) <= 0) { setPoError('Quantity and unit price must be greater than zero.'); return }
    if (poForm.requestedDate && poForm.requestedDate < minDeliveryDate) { setPoError('The requested date is earlier than the supplier lead time allows.'); return }
    setPoError('')
    const amount = Number(poForm.qty) * Number(poForm.unitPrice)
    const leadDays = SUPPLIER_LEAD_DAYS[poForm.supplier] || 21
  const expectedDelivery = formatDeliveryDate(addBusinessDays(new Date(), leadDays))
  const next = { lines: `1 title · ${Number(poForm.qty)} ${Number(poForm.qty) === 1 ? 'copy' : 'copies'}`, no: `PO-${Math.max(...orders.map((o) => Number(o.no.replace(/\D/g, '')) || 0)) + 1}`, supplier: poForm.supplier, stage: 'Waiting for approval', amount, egp: Math.round(amount * 52.4), paid: 0, due: poForm.requestedDate ? formatDeliveryDate(new Date(`${poForm.requestedDate}T00:00:00`)) : expectedDelivery, dueLabel: poForm.requestedDate ? 'requested date after lead time' : `${leadDays} business days`, payment: 'Waiting for payment', placed: `${person} · ${nowLabel()}`, createdBy: role, approved: '' }
    setOrders([next, ...orders])
    if (fromRequests.length) { setRequests(requests.map((r) => fromRequests.includes(r.no) ? { ...r, status: 'On purchase order' } : r)); setFromRequests([]) }
    notify(`${next.no} created and sent for Owner approval`)
    setPoFormOpen(false)
    setPoForm({ supplier: 'Sodis', contact: 'orders@sodis.fr', title: '', isbn: '', qty: '1', unitPrice: '', requestedDate: '', notes: '' })
  }
  const canEdit = role !== 'Sales Assistant'
  const canApprove = role === 'Owner'
  const canPay = canApprove
  const selected = orders.find((order) => order.no === paymentOrder)
  const markPaid = async () => {
    if (!selected || !paymentAmount || !paymentProof) return
    setPaymentSaving(true)
    setPaymentError('')
    if (!(Number(paymentAmount) > 0)) { setPaymentError('Enter an amount greater than zero.'); setPaymentSaving(false); return }
    const supabase = getSupabase()
    if (!supabase) { setPaymentError('File storage is not connected (Supabase env vars missing), so the proof could not be uploaded.'); setPaymentSaving(false); return }
    try {
      const path = `${selected.no}/${Date.now()}-${paymentProof.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const upload = await supabase.storage.from('payment-proofs').upload(path, paymentProof, { contentType: paymentProof.type, upsert: false })
      if (upload.error) { setPaymentError(upload.error.message); setPaymentSaving(false); return }
      const metadata = await supabase.from('payment_proofs').insert({ purchase_order_no: selected.no, file_path: path, file_name: paymentProof.name, content_type: paymentProof.type, file_size: paymentProof.size })
      if (metadata.error) { setPaymentError(metadata.error.message); setPaymentSaving(false); return }
    } catch (err) { setPaymentError(`Upload failed: ${err instanceof Error ? err.message : 'network error'}`); setPaymentSaving(false); return }
    notify(`Payment recorded for ${selected.no}`)
    const amount = Math.min(Number(paymentAmount), selected.amount - selected.paid)
    setOrders(orders.map((order) => order.no === selected.no ? { ...order, paid: order.paid + amount, payment: order.paid + amount >= order.amount ? 'Paid' : 'Partly paid' } : order))
    setPaymentOrder(null)
    setPaymentAmount('')
    setPaymentNote('')
    setPaymentProof(null)
    setPaymentSaving(false)
  }
  const approve = (no: string) => { setOrders(orders.map((order) => order.no === no && !(role === 'Accountant' && order.createdBy === 'Accountant') ? { ...order, stage: 'Sent', payment: 'Waiting for payment', approved: `${person} · ${nowLabel()}` } : order)); notify(`${no} approved and sent to the supplier`) }
  const reject = (no: string) => { setOrders(orders.map((order) => order.no === no ? { ...order, stage: 'Rejected', payment: 'Cancelled', approved: `Rejected by ${person} · ${nowLabel()}` } : order)); notify(`${no} rejected`) }
  const openApprovedRequests = () => {
    const approved = requests.filter((r) => r.status === 'Approved')
    if (!approved.length) { notify('No approved book requests are waiting for a purchase order'); return }
    setFromRequests(approved.map((r) => r.no))
    setPoForm({ ...poForm, title: approved.map((r) => r.title).join(' + '), qty: String(approved.reduce((sum, r) => sum + r.qty, 0)), notes: `From approved requests ${approved.map((r) => r.no).join(', ')}` })
    setPoError(''); setPoFormOpen(true)
  }
  const shownOrders = orders.filter((order) => !stageFilter || order.payment === stageFilter || order.stage === stageFilter)
  return <section className="procurement-page"><div className="page-heading"><div><p className="eyebrow">Procurement · {role}</p><h1>Purchase orders</h1><p className="subheading">Approval, supplier communication, receiving, and payment in one audit trail.</p></div>{canEdit && <div className="heading-actions"><button className="outline-button" onClick={openApprovedRequests}><Package /> Add approved requests{requests.some((r) => r.status === 'Approved') ? ` (${requests.filter((r) => r.status === 'Approved').length})` : ''}</button><button className="primary-button" onClick={() => { setFromRequests([]); setPoError(''); setPoFormOpen(true) }}><Package /> New purchase order</button></div>}</div><div className="payment-stats"><div><span>Total owed</span><strong>EGP 42,280</strong><small>Across 3 open invoices</small></div><div><span>Due this week</span><strong>EGP 32,560</strong><small>2 purchase orders</small></div><div className="payment-alert"><span>Overdue</span><strong>EGP 10,920</strong><small>Action required</small></div><div><span>Paid this month</span><strong>EGP 24,280</strong><small>4 payment events</small></div></div><div className="po-stage-row">{['Waiting for approval', 'Waiting for payment', 'Partly paid', 'Paid', 'Overdue'].map((stage) => <button key={stage} className={`stage-filter ${stageFilter === stage ? 'selected' : ''}`} aria-pressed={stageFilter === stage} onClick={() => setStageFilter(stageFilter === stage ? null : stage)}>{stage}<b>{orders.filter((order) => order.payment === stage || order.stage === stage).length}</b></button>)}</div><div className="table-card procurement-table"><div className="procurement-table-head"><span>Purchase order</span><span>Supplier / approval</span><span>Stage</span><span>Payment</span><span>Due</span><span>Actions</span></div>{shownOrders.map((order) => <div className="procurement-row po-payment-row clickable-row" key={order.no} role="button" tabIndex={0} onClick={() => setSelectedOrder(order.no)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedOrder(order.no) }}><span><strong>{order.no}</strong><small>{order.lines}</small></span><span><strong>{order.supplier}</strong><small>{order.placed} · {order.approved || 'Awaiting approval'}</small></span><span><b className={`status-pill ${order.stage === 'Waiting for approval' ? 'neutral' : 'good'}`}>{order.stage}</b></span><span><b className={`status-pill ${order.payment === 'Paid' ? 'good' : order.payment === 'Overdue' ? 'danger-pill' : order.payment === 'Partly paid' ? 'warning' : 'neutral'}`}>{order.payment}</b><small>{order.payment === 'Cancelled' ? 'No payment due' : `EGP ${Math.max(0, order.egp - Math.round(order.paid * 52.4)).toLocaleString()} left`}</small></span><span><strong>{order.due}</strong><small>{order.dueLabel}</small></span><span className="po-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{order.stage === 'Waiting for approval' && canApprove && <><button className="primary-button compact-button" onClick={() => approve(order.no)}>Approve and send</button><button className="text-button" onClick={() => reject(order.no)}>Reject</button></>}{canPay && order.payment !== 'Paid' && order.payment !== 'Cancelled' && order.stage !== 'Waiting for approval' && <button className="outline-button compact-button" onClick={() => { setPaymentError(''); setPaymentProof(null); setPaymentOrder(order.no); setPaymentAmount(String((order.amount - order.paid).toFixed(2))) }}>Mark as paid</button>}{!canApprove && !canEdit && <span className="muted-note">View only</span>}{canEdit && !canPay && order.stage !== 'Waiting for approval' && <span className="muted-note">Payment managed by finance</span>}{order.stage === 'Waiting for approval' && !canApprove && <span className="muted-note">Waiting for Owner</span>}</span></div>)}{!shownOrders.length && <p className="transfer-no-results">No purchase orders in “{stageFilter}”.</p>}</div><div className="message-preview"><div><span className="eyebrow">Approval trail · PO-209</span><h2>Placed by Karim · 2 Nov 2026, 14:05</h2><p>Waiting for Owner approval. Once approved, the AI agent sends the order by WhatsApp and email.</p></div><div className="message-log"><span><i className="status-dot" />WhatsApp · Queued</span><span><i className="status-dot" />Email · Queued</span></div></div>{paymentOrder && selected && <div className="payment-modal-backdrop"><div className="payment-modal"><button className="modal-close" onClick={() => setPaymentOrder(null)}><X /></button><span className="eyebrow">Payment · {selected.no}</span><h2>Mark as paid</h2><p>{selected.supplier} · Balance {selected.amount - selected.paid > 0 ? `${(selected.amount - selected.paid).toFixed(2)} EUR` : '0.00 EUR'}</p><label>Amount<input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label><label>Payment date<input type="date" defaultValue="2026-11-02" /></label><label>Method<select defaultValue="Bank transfer"><option>Bank transfer</option><option>Cash</option><option>Card</option></select></label><label>Reference<input placeholder="e.g. 4471" /></label><label>Proof of payment *<input type="file" accept="image/*,.pdf" onChange={(event) => setPaymentProof(event.target.files?.[0] || null)} /></label>{paymentProof && <p className="file-selected">Attached: {paymentProof.name}</p>}{paymentError && <p className="payment-error">{paymentError}</p>}<label>Note<textarea value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional note" /></label><button className="primary-button full-button" disabled={!paymentProof || paymentSaving} onClick={markPaid}>{paymentSaving ? 'Uploading proof…' : 'Save payment with proof'}</button></div></div>}{poFormOpen && <div className="payment-modal-backdrop"><div className="payment-modal po-modal"><button className="modal-close" onClick={() => setPoFormOpen(false)}><X /></button><span className="eyebrow">New purchase order · {role}</span><h2>Send an order to a supplier</h2><p>Capture the supplier, titles, quantities, price, and requested delivery date. The order enters approval before it is sent.</p><div className="po-form-grid"><label>Supplier *<select value={poForm.supplier} onChange={(event) => updatePoForm('supplier', event.target.value)}><option value="Sodis">Sodis · 21 days</option><option value="Gallimard Export">Gallimard Export · 14 days</option><option value="Hachette Livre">Hachette Livre · 28 days</option><option value="Actes Sud">Actes Sud · 18 days</option><option value="Éditions du Seuil">Éditions du Seuil · 16 days</option><option value="Éditions Flammarion">Éditions Flammarion · 19 days</option><option value="Albin Michel Export">Albin Michel Export · 23 days</option><option value="Éditions de Minuit">Éditions de Minuit · 25 days</option></select></label><label>Supplier contact<input value={poForm.contact} onChange={(event) => updatePoForm('contact', event.target.value)} placeholder="email or WhatsApp" /></label><label>Book title / ISBN *<input value={poForm.title} onChange={(event) => updatePoForm('title', event.target.value)} placeholder="Title or ISBN" /></label><label>ISBN / edition<input value={poForm.isbn} onChange={(event) => updatePoForm('isbn', event.target.value)} placeholder="978..." /></label><label>Quantity *<input type="number" min="1" value={poForm.qty} onChange={(event) => updatePoForm('qty', event.target.value)} /></label><label>Unit price EUR *<input type="number" min="0" step="0.01" value={poForm.unitPrice} onChange={(event) => updatePoForm('unitPrice', event.target.value)} placeholder="0.00" /></label><label>Requested delivery date<input type="date" min={minDeliveryDate} value={poForm.requestedDate} onChange={(event) => updatePoForm('requestedDate', event.target.value)} /><small className="field-hint">Earliest: {formatDeliveryDate(new Date(`${minDeliveryDate}T00:00:00`))}. Earlier business days are unavailable.</small></label><label>Order notes<textarea value={poForm.notes} onChange={(event) => updatePoForm('notes', event.target.value)} placeholder="Language, format, packing, or supplier instructions" /></label></div>{fromRequests.length > 0 && <p className="file-selected">Linked requests: {fromRequests.join(', ')}</p>}{poError && <p className="payment-error" role="alert">{poError}</p>}<button className="primary-button full-button" onClick={createPurchaseOrder}>Create order for approval</button></div></div>}{selectedOrder && (() => { const order = orders.find((item) => item.no === selectedOrder); if (!order) return null; return <div className="payment-modal-backdrop"><div className="payment-modal po-modal"><button className="modal-close" onClick={() => setSelectedOrder(null)}><X /></button><span className="eyebrow">Purchase order detail</span><h2>{order.no} · {order.supplier}</h2><p>{order.placed} · Created by {order.createdBy}</p><div className="order-form-banner"><span>Purchase order form</span><b>Supplier lead time: {SUPPLIER_LEAD_DAYS[order.supplier] || 21} business days</b></div><div className="order-detail-grid"><span>Stage<strong>{order.stage}</strong></span><span>Payment<strong>{order.payment}</strong></span><span>Total<strong>{order.amount.toFixed(2)} EUR</strong></span><span>EGP estimate<strong>{order.egp.toLocaleString()} EGP</strong></span><span>Due<strong>{order.due}</strong></span><span>Supplier contact<strong>{order.supplier === 'Sodis' ? 'orders@sodis.fr' : 'Supplier contact on file'}</strong></span></div><div className="consent-note"><strong>Order contents</strong><br />{order.lines}<br />Approval: {order.approved || 'Waiting for Owner approval'}</div><div className="order-form-fields"><label>Supplier contact<strong>{order.supplier === 'Sodis' ? 'orders@sodis.fr' : 'Supplier contact on file'}</strong></label><label>Requested delivery<strong>{order.due}</strong></label><label>Payment terms<strong>{order.payment === 'Paid' ? 'Paid in full' : 'Pay on receipt'}</strong></label><label>Notes<strong>Confirm editions, quantities, and packing before dispatch.</strong></label></div><div className="detail-actions"><button className="outline-button" onClick={() => setSelectedOrder(null)}>Close</button>{canPay && order.payment !== 'Paid' && order.payment !== 'Cancelled' && order.stage !== 'Waiting for approval' && <button className="primary-button" onClick={() => { setSelectedOrder(null); setPaymentError(''); setPaymentProof(null); setPaymentOrder(order.no); setPaymentAmount(String((order.amount - order.paid).toFixed(2))) }}>Mark as paid</button>}</div></div></div> })()}</section>
}

function OrderRequestsWorkspace({ role, person, requests, setRequests }: { role: Role; person: string; requests: BookRequest[]; setRequests: (requests: BookRequest[]) => void }) {
  const [requestSearch, setRequestSearch] = useState('')
  const [selected, setSelected] = useState('REQ-015')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [formOpen, setFormOpen] = useState(false)
  const [moveFormOpen, setMoveFormOpen] = useState(false)
  const [moveSearch, setMoveSearch] = useState('')
  const [moveRequestSent, setMoveRequestSent] = useState(false)
  const [moveForm, setMoveForm] = useState({ book: 'Mendiants et orgueilleux', quantity: '1', from: 'Basement store', to: 'Shop floor', note: '' })
  const [form, setForm] = useState({ title: '', author: '', customer: '', phone: '', channel: 'WhatsApp', qty: '1', notes: '', deposit: '' })
  const [formError, setFormError] = useState('')
  const current = requests.find((item) => item.no === selected) || requests[0]
  const setStatus = (no: string, status: string) => setRequests(requests.map((item) => item.no === no ? { ...item, status } : item))
  const rq = requestSearch.trim().toLowerCase()
  const shownRequests = requests.filter((request) => (statusFilter === 'All statuses' || request.status === statusFilter) && (!rq || `${request.no} ${request.title} ${request.customer} ${request.requester}`.toLowerCase().includes(rq)))
  const moveBook = books.find((book) => book.title === moveForm.book)
  const moveSourceShelves = moveBook?.shelves.filter((shelf) => shelf.copies > 0) || []
  const moveDestinationShelves = moveBook?.shelves.filter((shelf) => shelf.location !== moveForm.from) || []
  const moveBookResults = rankBooksBySearch(moveSearch, 8)
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value })
  const createRequest = () => { if (!form.title || !form.customer || !form.phone) { setFormError('Book title, customer name and phone number are required.'); return }; setFormError(''); const next = { no: `REQ-${String(Math.max(...requests.map((r) => Number(r.no.replace(/\D/g, '')) || 0)) + 1).padStart(3, '0')}`, title: `${form.title}${form.author ? ` · ${form.author}` : ''}`, requester: person, type: 'Customer', qty: Number(form.qty) || 1, status: 'Waiting approval', customer: form.customer, phone: form.phone, channel: form.channel, notes: form.notes || 'Contact customer when the book arrives.', deposit: form.deposit || 'Not recorded' }; setRequests([next, ...requests]); setSelected(next.no); setFormOpen(false); notify(`${next.no} saved for ${next.customer}`); setForm({ title: '', author: '', customer: '', phone: '', channel: 'WhatsApp', qty: '1', notes: '', deposit: '' }) }
  return <section className="procurement-page"><div className="page-heading"><div><p className="eyebrow">Requests · {role}</p><h1>Book requests</h1><p className="subheading">Customer requests, contact details, deposits, and arrival follow-up.</p></div>{role === 'Sales Assistant' && <div className="heading-actions"><button className="outline-button" onClick={() => { setMoveRequestSent(false); setMoveSearch(''); setMoveFormOpen(true) }}><Package /> Request stock move</button><button className="primary-button" onClick={() => setFormOpen(true)}><Package /> New book request</button></div>}</div>{moveRequestSent && <p className="success-note" role="status">Stock move request sent to the Inventory Manager for {moveForm.book}: {moveForm.quantity} copy from {moveForm.from} to {moveForm.to}.</p>}<div className="procurement-toolbar"><label className="search-box"><Search /><input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder="Search request, title or customer" /></label><label className="filter-button"><SlidersHorizontal /><select aria-label="Filter requests by status" className="status-filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{Array.from(new Set(requests.map((request) => request.status))).map((status) => <option key={status}>{status}</option>)}</select><ChevronDown /></label><button className="outline-button" onClick={() => downloadCsv('llf-book-requests.csv', [['Request', 'Title', 'Type', 'Requester', 'Customer', 'Phone', 'Channel', 'Qty', 'Status', 'Deposit', 'Notes'], ...shownRequests.map((r) => [r.no, r.title, r.type, r.requester, r.customer, r.phone, r.channel, r.qty, r.status, r.deposit, r.notes])])}><Download /> Export CSV</button></div><div className="procurement-layout"><div className="table-card procurement-table"><div className="procurement-table-head"><span>Request</span><span>Customer / requester</span><span>Qty</span><span>Status</span></div>{shownRequests.length ? shownRequests.map((request) => <button className={`procurement-row ${selected === request.no ? 'selected-row' : ''}`} key={request.no} onClick={() => setSelected(request.no)}><span><strong>{request.no}</strong><small>{request.title}</small></span><span><strong>{request.customer}</strong><small>{request.type} · {request.requester}</small></span><span>{request.qty}</span><span><b className={`status-pill ${request.status.includes('Waiting') ? 'neutral' : request.status === 'Rejected' ? 'danger-pill' : 'good'}`}>{request.status}</b></span></button>) : <p className="transfer-no-results">No requests match.</p>}</div><aside className="procurement-detail"><span className="eyebrow">Request detail · {current.no}</span><h2>{current.title}</h2><div className="detail-facts"><span>Requested by <b>{current.requester}</b></span><span>Customer <b>{current.customer}</b></span><span>{current.channel} <b>{current.phone}</b></span><span>Quantity <b>{current.qty}</b></span><span>Deposit <b>{current.deposit}</b></span></div><div className="consent-note"><strong>Arrival follow-up</strong><br />{current.notes}</div><div className="detail-actions">{role === 'Owner' && current.status === 'Waiting approval' && <><button className="primary-button" onClick={() => { setStatus(current.no, 'Approved'); notify(`${current.no} approved`) }}>Approve request</button><button className="outline-button" onClick={() => { setStatus(current.no, 'Rejected'); notify(`${current.no} rejected`) }}>Reject</button></>}{current.status === 'Arrived – reserved' && current.phone !== '—' && <button className="primary-button" onClick={() => { setStatus(current.no, 'Customer notified'); notify(`${current.channel} message queued to ${current.customer} (${current.phone})`) }}>Notify customer</button>}{role !== 'Sales Assistant' && (current.status === 'Approved' ? <button className="outline-button" onClick={() => { setStatus(current.no, 'On purchase order'); notify(`${current.no} added to the next purchase order`) }}>Add to purchase order</button> : current.status === 'Waiting approval' ? <span className="waiting-note">Needs Owner approval before it can go on a purchase order</span> : null)}</div><div className="message-preview"><span className="eyebrow">Contact plan</span><p>When received, send {current.customer} a {current.channel} message at {current.phone}. Keep the reservation open until pickup.</p></div></aside></div>{moveFormOpen && <div className="payment-modal-backdrop"><div className="payment-modal request-modal"><button className="modal-close" onClick={() => setMoveFormOpen(false)}><X /></button><span className="eyebrow">Inventory move request</span><h2>Request stock movement</h2><p>This request is sent to the Inventory Manager for review and approval.</p><label>Find book by title, category, author, or ISBN<input type="search" value={moveSearch} onChange={(event) => setMoveSearch(event.target.value)} placeholder="Search title, category, or enter ISBN" autoComplete="off" /></label>{moveSearch.trim() && <div className="transfer-book-results" role="listbox" aria-label="Matching catalogue books">{moveBookResults.length ? moveBookResults.map((book) => { const availableCopies = book.shelves.reduce((sum, shelf) => sum + shelf.copies, 0); return <button type="button" role="option" aria-selected={moveForm.book === book.title} className="transfer-book-result" key={book.isbn} disabled={availableCopies === 0} onClick={() => { const source = book.shelves.find((shelf) => shelf.copies > 0); const destination = book.shelves.find((shelf) => shelf.location !== source?.location); setMoveForm({ ...moveForm, book: book.title, quantity: '1', from: source?.location || '', to: destination?.location || '' }); setMoveSearch('') }}><span><strong>{book.title}</strong><small>{book.category} · {book.author} · ISBN {book.isbn} · {availableCopies} copies in stock</small></span><b>{availableCopies ? 'Select book' : 'No available stock'}</b></button> }) : <p className="transfer-no-results">No close matches found. Try a title, category, author, or ISBN.</p>}</div>}{moveBook && <div className="transfer-book-summary"><strong>{moveBook.title}</strong><span>ISBN {moveBook.isbn}</span><span>{moveBook.shelves.map((shelf) => `${shelf.location}: ${shelf.copies}`).join(' · ')}</span></div>}<label>Quantity<input type="number" min="1" max={moveBook?.shelves.find((shelf) => shelf.location === moveForm.from)?.copies || 0} value={moveForm.quantity} onChange={(event) => setMoveForm({ ...moveForm, quantity: event.target.value })} /></label><div className="po-form-grid"><label>From<select value={moveForm.from} onChange={(event) => { const nextFrom = event.target.value; setMoveForm({ ...moveForm, from: nextFrom, to: moveDestinationShelves.find((shelf) => shelf.location !== nextFrom)?.location || '' }) }}>{moveSourceShelves.map((shelf) => <option key={shelf.location} value={shelf.location}>{shelf.location} · {shelf.copies} available</option>)}</select></label><label>To<select value={moveForm.to} onChange={(event) => setMoveForm({ ...moveForm, to: event.target.value })}>{moveDestinationShelves.map((shelf) => <option key={shelf.location} value={shelf.location}>{shelf.location}</option>)}</select></label></div><label>Reason / note<textarea value={moveForm.note} onChange={(event) => setMoveForm({ ...moveForm, note: event.target.value })} placeholder="Why is this move needed?" /></label><button className="primary-button full-button" disabled={!moveBook || !moveSourceShelves.some((shelf) => shelf.location === moveForm.from) || !Number.isInteger(Number(moveForm.quantity)) || Number(moveForm.quantity) < 1 || Number(moveForm.quantity) > (moveBook?.shelves.find((shelf) => shelf.location === moveForm.from)?.copies || 0) || !moveForm.to || moveForm.from === moveForm.to} onClick={() => { setMoveRequestSent(true); setMoveFormOpen(false); notify('Stock move request sent to the Inventory Manager') }}>Send to Inventory Manager</button></div></div>}{formOpen && <div className="payment-modal-backdrop"><div className="payment-modal request-modal"><button className="modal-close" onClick={() => setFormOpen(false)}><X /></button><span className="eyebrow">New customer request</span><h2>Capture the crucial details</h2><p>These details let the team contact the customer as soon as the book arrives.</p><label>Book title *<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. The Stranger" /></label><label>Author / edition<input value={form.author} onChange={(event) => update('author', event.target.value)} placeholder="Author, language, format" /></label><label>Customer name *<input value={form.customer} onChange={(event) => update('customer', event.target.value)} placeholder="Full name" /></label><label>Phone number *<input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+20..." /></label><label>Preferred contact channel<select value={form.channel} onChange={(event) => update('channel', event.target.value)}><option>WhatsApp</option><option>Phone</option><option>Email</option></select></label><label>Quantity<input type="number" min="1" value={form.qty} onChange={(event) => update('qty', event.target.value)} /></label><label>Customer note<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Pickup preference, language, urgency" /></label><label>Deposit / reservation reference<input value={form.deposit} onChange={(event) => update('deposit', event.target.value)} placeholder="Optional" /></label>{formError && <p className="payment-error" role="alert">{formError}</p>}<button className="primary-button full-button" onClick={createRequest}>Save request</button></div></div>}</section>
}

function ProcurementWorkspace({ view, role }: { view: 'requests' | 'purchase-orders' | 'suppliers' | 'payments'; role: Role }) {
  const [selectedRequest, setSelectedRequest] = useState('REQ-015')
  const [requestStatusFilter, setRequestStatusFilter] = useState('All statuses')
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [paymentUpdating, setPaymentUpdating] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [invoiceMessage, setInvoiceMessage] = useState('')
  const [invoiceError, setInvoiceError] = useState('')
  const [invoiceForm, setInvoiceForm] = useState({ invoice: '', supplier: 'Hachette Livre', purchaseOrder: 'PO-209', due: '', amount: '' })
  const [invoiceRows, setInvoiceRows] = useState([
    { invoice: 'INV-HL-881', supplier: 'Hachette Livre', due: '30 Nov 2026', status: 'Unpaid', balance: 'EGP 74,920', purchaseOrder: 'PO-209' },
    { invoice: 'INV-GE-442', supplier: 'Gallimard Export', due: '15 Dec 2026', status: 'Unpaid', balance: 'EGP 19,220', purchaseOrder: 'PO-208' },
    { invoice: 'INV-AS-201', supplier: 'Éditions Actes Sud', due: '22 Oct 2026', status: 'Overdue', balance: 'EGP 12,420', purchaseOrder: 'PO-207' },
  ])
  const [requestStatus, setRequestStatus] = useState('Waiting approval')
  const requests = [
    { no: 'REQ-015', title: 'The Little Prince — English edition', requester: 'Nour Hassan', type: 'Customer', qty: 2, status: requestStatus, customer: 'Mariam Adel · WhatsApp' },
    { no: 'REQ-014', title: 'Grammaire progressive du français', requester: 'Karim El-Sayed', type: 'Internal', qty: 6, status: 'On purchase order', customer: '—' },
    { no: 'REQ-013', title: 'L’Amant · Marguerite Duras', requester: 'Nour Hassan', type: 'Customer', qty: 1, status: 'Arrived – reserved', customer: 'Omar Nabil · WhatsApp' },
  ]
  const [suppliers, setSuppliers] = useState([
    { name: 'Hachette Livre', country: 'France', lead: '7 days', terms: '30 days', open: 'PO-209', balance: 'EGP 74,920' },
    { name: 'Gallimard Export', country: 'France', lead: '10 days', terms: '45 days', open: 'PO-208', balance: 'EGP 31,640' },
    { name: 'Éditions Actes Sud', country: 'France', lead: '12 days', terms: '30 days', open: 'None', balance: 'EGP 0' },
  ])
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', country: 'France', lead: '14', terms: '30', contact: '' })
  const [supplierError, setSupplierError] = useState('')
  const addSupplier = () => {
    const name = supplierForm.name.trim()
    if (!name) { setSupplierError('Enter the supplier name.'); return }
    if (suppliers.some((supplier) => supplier.name.toLowerCase() === name.toLowerCase())) { setSupplierError('This supplier already exists.'); return }
    setSuppliers([...suppliers, { name, country: supplierForm.country || '—', lead: `${Number(supplierForm.lead) || 14} days`, terms: `${Number(supplierForm.terms) || 30} days`, open: 'None', balance: 'EGP 0' }])
    setSupplierForm({ name: '', country: 'France', lead: '14', terms: '30', contact: '' }); setSupplierError(''); setSupplierFormOpen(false)
    notify(`${name} added to suppliers`)
  }
  const statusTone = (status: string) => status.toLowerCase().includes('draft') || status.toLowerCase().includes('waiting') ? 'neutral' : status.toLowerCase().includes('partly') ? 'warning' : 'good'
  const selectedInvoice = invoiceRows.find((invoice) => invoice.invoice === selectedPayment)
  const saveInvoice = () => {
    const amount = Number(invoiceForm.amount)
    const invoiceNumber = invoiceForm.invoice.trim()
    if (!invoiceNumber || !invoiceForm.supplier || !invoiceForm.purchaseOrder || !invoiceForm.due || !invoiceForm.amount) {
      setInvoiceError('Complete the invoice number, purchase order, amount, and due date before saving.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setInvoiceError('Enter an invoice amount greater than zero.')
      return
    }
    if (invoiceRows.some((invoice) => invoice.invoice.toLowerCase() === invoiceNumber.toLowerCase())) {
      setInvoiceError('That invoice number has already been recorded. Enter a unique invoice number.')
      return
    }
    const due = new Date(`${invoiceForm.due}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    setInvoiceRows([{ invoice: invoiceNumber, supplier: invoiceForm.supplier, due, status: 'Unpaid', balance: `EGP ${amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`, purchaseOrder: invoiceForm.purchaseOrder }, ...invoiceRows])
    setInvoiceMessage(`Invoice ${invoiceNumber} recorded for ${invoiceForm.supplier}.`); notify(`Invoice ${invoiceNumber} recorded`)
    setInvoiceError('')
    setInvoiceForm({ invoice: '', supplier: 'Hachette Livre', purchaseOrder: 'PO-209', due: '', amount: '' })
    setInvoiceFormOpen(false)
  }
  if (view === 'suppliers') return <section className="procurement-page"><div className="page-heading"><div><p className="eyebrow">Procurement · {role}</p><h1>Suppliers</h1><p className="subheading">Partners, terms, open orders, and performance in one place.</p></div><button className="primary-button" onClick={() => { setSupplierError(''); setSupplierFormOpen(true) }}><Users /> Add supplier</button></div><div className="supplier-grid">{suppliers.map((supplier) => <article className="supplier-card" key={supplier.name}><div className="supplier-card-top"><span className="supplier-mark">{supplier.name.slice(0, 1)}</span><div><h2>{supplier.name}</h2><p>{supplier.country} · Books & export</p></div><ChevronRight /></div><div className="supplier-facts"><span>Lead time <b>{supplier.lead}</b></span><span>Terms <b>{supplier.terms}</b></span><span>Open order <b>{supplier.open}</b></span><span>Balance owed <b>{supplier.balance}</b></span></div><div className="supplier-performance"><span>On-time delivery <b>92%</b></span><span>Last order <b>{supplier.open === 'None' ? '—' : '29 Oct 2026'}</b></span></div></article>)}</div>{supplierFormOpen && <div className="payment-modal-backdrop"><div className="payment-modal request-modal" role="dialog" aria-modal="true"><button className="modal-close" aria-label="Close supplier form" onClick={() => setSupplierFormOpen(false)}><X /></button><span className="eyebrow">New supplier · {role}</span><h2>Add a supplier</h2><label>Supplier name *<input autoFocus value={supplierForm.name} onChange={(event) => { setSupplierForm({ ...supplierForm, name: event.target.value }); setSupplierError('') }} placeholder="e.g. Éditions du Seuil" /></label><label>Country<input value={supplierForm.country} onChange={(event) => setSupplierForm({ ...supplierForm, country: event.target.value })} /></label><div className="po-form-grid"><label>Lead time (days)<input type="number" min="1" value={supplierForm.lead} onChange={(event) => setSupplierForm({ ...supplierForm, lead: event.target.value })} /></label><label>Payment terms (days)<input type="number" min="0" value={supplierForm.terms} onChange={(event) => setSupplierForm({ ...supplierForm, terms: event.target.value })} /></label></div><label>Contact (email / WhatsApp)<input value={supplierForm.contact} onChange={(event) => setSupplierForm({ ...supplierForm, contact: event.target.value })} /></label>{supplierError && <p className="payment-error" role="alert">{supplierError}</p>}<button className="primary-button full-button" onClick={addSupplier}>Save supplier</button></div></div>}</section>
  if (view === 'payments' && selectedPayment) return <section className="procurement-page"><button className="text-button" onClick={() => { setSelectedPayment(null); setPaymentProof(null); setPaymentMessage('') }}>← Back to payments</button><div className="payment-detail-card"><div className="page-heading"><div><p className="eyebrow">Payment detail · {role}</p><h1>{selectedPayment}</h1><p className="subheading">Update this supplier payment and attach proof before marking it paid.</p></div><b className={`status-pill ${selectedInvoice?.status === 'Overdue' ? 'danger-pill' : selectedInvoice?.status === 'Paid' ? 'good' : 'warning'}`}>{selectedInvoice?.status ?? 'Unpaid'}</b></div><div className="payment-detail-facts"><span>Supplier<strong>{selectedInvoice?.supplier ?? '—'}</strong></span><span>Purchase order<strong>{selectedInvoice?.purchaseOrder ?? '—'}</strong></span><span>Amount due<strong>{selectedInvoice?.balance ?? '—'}</strong></span><span>Due date<strong>{selectedInvoice?.due ?? '—'}</strong></span></div><label className="proof-upload">Payment proof<input type="file" accept="image/*,.pdf" onChange={(event) => setPaymentProof(event.target.files?.[0] || null)} /><small>{paymentProof ? `Attached: ${paymentProof.name}` : 'Required: bank transfer receipt, invoice, or payment confirmation.'}</small></label>{paymentMessage && <p className="success-note">{paymentMessage}</p>}{selectedInvoice?.status === 'Paid' ? <p className="success-note">This invoice is paid.</p> : <button className="primary-button" disabled={!paymentProof || paymentUpdating} onClick={async () => { if (!paymentProof || !selectedInvoice) return; setPaymentUpdating(true); setPaymentMessage(''); const supabase = getSupabase(); if (!supabase) { setPaymentMessage('File storage is not connected (Supabase env vars missing), so the proof could not be uploaded.'); setPaymentUpdating(false); return } try { const path = `payments/${selectedPayment}/${Date.now()}-${paymentProof.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`; const upload = await supabase.storage.from('payment-proofs').upload(path, paymentProof, { contentType: paymentProof.type, upsert: false }); if (upload.error) { setPaymentMessage(upload.error.message); setPaymentUpdating(false); return } const metadata = await supabase.from('payment_proofs').insert({ purchase_order_no: selectedInvoice.purchaseOrder, file_path: path, file_name: paymentProof.name, content_type: paymentProof.type, file_size: paymentProof.size }); if (metadata.error) { setPaymentMessage(metadata.error.message); setPaymentUpdating(false); return } } catch (err) { setPaymentMessage(`Upload failed: ${err instanceof Error ? err.message : 'network error'}`); setPaymentUpdating(false); return } setInvoiceRows(invoiceRows.map((invoice) => invoice.invoice === selectedInvoice.invoice ? { ...invoice, status: 'Paid', balance: 'EGP 0' } : invoice)); setPaymentMessage('Payment marked as paid and proof uploaded.'); notify(`${selectedInvoice.invoice} marked as paid`); setPaymentUpdating(false) }}>{paymentUpdating ? 'Uploading proof…' : 'Mark paid and upload proof'}</button>}</div></section>
  return <section className="procurement-page"><div className="page-heading"><div><p className="eyebrow">Procurement · {role}</p><h1>Purchase order payments</h1><p className="subheading">Record invoices and keep supplier balances current with clear paid or unpaid status.</p></div><div className="heading-actions"><button className="outline-button" onClick={() => downloadCsv('llf-supplier-invoices.csv', [['Invoice', 'Supplier', 'Purchase order', 'Due', 'Status', 'Balance'], ...invoiceRows.map((invoice) => [invoice.invoice, invoice.supplier, invoice.purchaseOrder, invoice.due, invoice.status, invoice.balance])])}><Download /> Export CSV</button><button className="primary-button" onClick={() => { setInvoiceMessage(''); setInvoiceError(''); setInvoiceFormOpen(true) }}><Receipt /> Record invoice</button></div></div><div className="payment-stats"><div><span>Total owed</span><strong>EGP 106,560</strong><small>Across 4 suppliers</small></div><div><span>Due in 7 days</span><strong>EGP 31,640</strong><small>2 invoices</small></div><div className="payment-alert"><span>Overdue</span><strong>EGP 12,420</strong><small>Action required</small></div></div><div className="table-card procurement-table"><div className="procurement-table-head"><span>Invoice</span><span>Supplier</span><span>Due date</span><span>Status</span><span>Balance</span></div>{invoiceRows.map((invoice) => <div className="procurement-row payment-row-clickable" key={invoice.invoice} onClick={() => { setPaymentProof(null); setPaymentMessage(''); setSelectedPayment(invoice.invoice) }}><span><strong>{invoice.invoice}</strong><small>{invoice.purchaseOrder} · 2 Nov 2026 · Bank transfer</small></span><span>{invoice.supplier}</span><span>{invoice.due}<small className="due-countdown">{invoice.status === 'Overdue' ? 'Payment overdue' : invoice.status === 'Paid' ? 'Paid' : invoice.invoice === 'INV-HL-881' ? '28 days left' : '43 days left'}</small></span><span><b className={`status-pill ${invoice.status === 'Overdue' ? 'danger-pill' : invoice.status === 'Paid' ? 'good' : 'warning'}`}>{invoice.status}</b></span><span><strong>{invoice.balance}</strong>{invoice.status !== 'Paid' && <button className="text-button" onClick={(event) => { event.stopPropagation(); setPaymentProof(null); setPaymentMessage(''); setSelectedPayment(invoice.invoice) }}>Record payment</button>}</span></div>)}</div><div className="payment-history"><span className="eyebrow">Payment history</span><h2>Recent supplier payments</h2><p>2 Nov · Gallimard Export · EGP 12,420 · Bank transfer · Recorded by Salma Fathy</p><p>31 Oct · Hachette Livre · EGP 18,000 · Card · Approved by Mme Hoda</p></div>{invoiceMessage && <p className="success-note" role="status">{invoiceMessage}</p>}{invoiceFormOpen && <div className="payment-modal-backdrop"><div className="payment-modal request-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-dialog-title"><button className="modal-close" aria-label="Close invoice form" onClick={() => setInvoiceFormOpen(false)}><X /></button><span className="eyebrow">Accounts payable · {role}</span><h2 id="invoice-dialog-title">Record supplier invoice</h2><p>Add a supplier invoice and link it to a purchase order. It will appear in the unpaid invoice list.</p><label>Invoice number *<input autoFocus required value={invoiceForm.invoice} onChange={(event) => { setInvoiceForm({ ...invoiceForm, invoice: event.target.value }); setInvoiceError('') }} placeholder="e.g. INV-HL-882" /></label><label>Supplier *<select value={invoiceForm.supplier} onChange={(event) => { setInvoiceForm({ ...invoiceForm, supplier: event.target.value }); setInvoiceError('') }}><option>Hachette Livre</option><option>Gallimard Export</option><option>Éditions Actes Sud</option><option>Sodis</option></select></label><label>Purchase order *<select value={invoiceForm.purchaseOrder} onChange={(event) => { setInvoiceForm({ ...invoiceForm, purchaseOrder: event.target.value }); setInvoiceError('') }}><option>PO-209</option><option>PO-208</option><option>PO-207</option><option>PO-206</option></select></label><div className="po-form-grid"><label>Amount (EGP) *<input type="number" min="0.01" step="0.01" required value={invoiceForm.amount} onChange={(event) => { setInvoiceForm({ ...invoiceForm, amount: event.target.value }); setInvoiceError('') }} placeholder="0.00" /></label><label>Due date *<input type="date" required value={invoiceForm.due} onChange={(event) => { setInvoiceForm({ ...invoiceForm, due: event.target.value }); setInvoiceError('') }} /></label></div>{invoiceError && <p className="payment-error" role="alert">{invoiceError}</p>}{invoiceForm.invoice.trim() && invoiceRows.some((invoice) => invoice.invoice.toLowerCase() === invoiceForm.invoice.trim().toLowerCase()) && <p className="payment-error" role="alert">That invoice number has already been recorded.</p>}<button type="button" className="primary-button full-button" onClick={saveInvoice}>Save invoice</button></div></div>}</section>
}

function StockWorkspace({ view, role, person, exchangeRate, rateHistory, staff, setStaff, onNavigate }: { view: 'stock-control' | 'alerts' | 'settings'; role: Role; person: string; exchangeRate: number; rateHistory: RateChange[]; staff: Record<Role, string>; setStaff: (staff: Record<Role, string>) => void; onNavigate?: (view: string) => void }) {
  const [doneAlerts, setDoneAlerts] = useState<string[]>([])
  const [alertTab, setAlertTab] = useState<'open' | 'done'>('open')
  const [actionNote, setActionNote] = useState('')
  const [tasks, setTasks] = useState([
    { id: 't1', route: 'DP-R2 → SF-A1', detail: 'L’Étranger · 3 copies · created from Order soon alert', done: false },
    { id: 't2', route: 'BS-C7 → SF-C3', detail: 'Mendiants et orgueilleux · 3 copies · shop floor empty', done: false },
  ])
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [countResult, setCountResult] = useState('')
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [editName, setEditName] = useState('')
  const lastRate = rateHistory[0]
  const [tab, setTab] = useState(view === 'alerts' ? 'alerts' : view === 'settings' ? 'settings' : 'transfers')
  useEffect(() => { setTab(view === 'alerts' ? 'alerts' : view === 'settings' ? 'settings' : 'transfers') }, [view])
  const [countPosted, setCountPosted] = useState(false)
  const [shelfAdded, setShelfAdded] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [transferFormOpen, setTransferFormOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({ book: 'Mendiants et orgueilleux', quantity: '3', from: 'Basement store', to: 'Shop floor', note: '' })
  const [transferCreated, setTransferCreated] = useState(false)
  const [transferSearch, setTransferSearch] = useState('')
  const selectedTransferBook = books.find((book) => book.title === transferForm.book)
  const transferSourceLocations = selectedTransferBook?.shelves.filter((shelf) => shelf.copies > 0) || []
  const transferDestinationLocations = selectedTransferBook?.shelves.filter((shelf) => shelf.location !== transferForm.from) || []
  const transferSearchResults = rankBooksBySearch(transferSearch, 6)
  const alerts = [
    { type: 'Order soon', title: 'Le Petit Prince', message: '3 left, sells ~1/day, Sodis takes 18 days. Order 25 now.', action: 'Reorder' },
    { type: 'Bring to shop', title: 'Mendiants et orgueilleux', message: 'Shop floor is empty while 3 copies are waiting in basement store.', action: 'Bring to shop' },
    { type: 'Invoice overdue', title: 'INV-AS-201 · Actes Sud', message: 'EGP 12,420 overdue since 22 Oct 2026.', action: 'Open invoice' },
  ]
  const roleAlerts = role === 'Owner' ? [
    { type: 'Purchase order approval', title: 'PO-209 · Sodis', message: 'A new purchase order is waiting for your approval.', action: 'Review purchase order' },
    { type: 'New sale', title: 'Sale R-1045', message: 'A new sale was completed by the Sales Assistant.', action: 'Open sale' },
    { type: 'Accountant update', title: 'Payment recorded', message: 'Salma recorded a payment against PO-207.', action: 'Open payment' },
    { type: 'Payment due', title: 'PO-206 · Actes Sud', message: 'EGP 10,920 is overdue and needs attention.', action: 'Open payment' },
    { type: 'Exchange rate update', title: 'Pricing updated', message: lastRate ? `Rate set to ${lastRate.rate.toFixed(2)} EGP/USD by ${lastRate.setBy} (${formatRateTime(lastRate.at)}). Every catalogue price now uses it.` : 'The exchange rate changed.', action: 'Find a book' },
  ] : role === 'Accountant' ? [
    { type: 'Exchange rate update', title: 'Pricing updated', message: lastRate ? `Rate set to ${lastRate.rate.toFixed(2)} EGP/USD by ${lastRate.setBy} (${formatRateTime(lastRate.at)}). Review the updated catalogue pricing.` : 'The exchange rate changed.', action: 'Find a book' },
  ] : role === 'Inventory Manager' ? [
    { type: 'Stock move request', title: 'New request from Sales Assistant', message: 'A stock move is waiting for your review between locations.', action: 'Review stock move' },
    { type: 'Receiving', title: 'PO-209 · Sodis', message: 'A supplier order is due to arrive soon.', action: 'Open purchase order' },
  ] : alerts
  const openAlerts = roleAlerts.filter((alert) => !doneAlerts.includes(alert.title))
  const closedAlerts = roleAlerts.filter((alert) => doneAlerts.includes(alert.title))
  const markDone = (title: string) => { setDoneAlerts((prev) => prev.includes(title) ? prev : [...prev, title]); setActionNote(`Action on “${title}” recorded by ${person} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`) }
  const runAlert = (alert: { action: string; title: string }) => {
    const routes: Record<string, string> = { 'Review purchase order': 'purchase-orders', 'Open payment': 'payments', 'Open invoice': 'payments', 'Open sale': 'receipts', 'Review stock move': 'stock-control', 'Open purchase order': role === 'Inventory Manager' ? 'receive-stock' : 'purchase-orders', 'Find a book': 'catalog', Reorder: role === 'Sales Assistant' ? 'requests' : 'purchase-orders' }
    if (alert.action === 'Bring to shop') { setTab('transfers'); setTasks(tasks.map((task) => task.id === 't2' ? { ...task, done: false } : task)); return }
    if (routes[alert.action]) onNavigate?.(routes[alert.action])
  }
  if (tab === 'alerts') return <section className="stock-page"><div className="page-heading"><div><p className="eyebrow">Notifications</p><h1>Alerts that need action</h1><p className="subheading">Open alerts stay visible until someone records the action taken.</p></div><button className="outline-button" disabled={!openAlerts.length} onClick={() => { setDoneAlerts(roleAlerts.map((alert) => alert.title)); setActionNote(`All alerts marked done by ${person}.`) }}><Bell /> Mark all done</button></div><div className="alert-tabs"><button className={alertTab === 'open' ? 'active' : ''} onClick={() => setAlertTab('open')}>Open <b>{openAlerts.length}</b></button><button className={alertTab === 'done' ? 'active' : ''} onClick={() => setAlertTab('done')}>Done <b>{closedAlerts.length}</b></button></div><div className="alert-list">{(alertTab === 'open' ? openAlerts : closedAlerts).map((alert) => <article className="alert-card" key={alert.title}><div className="alert-icon"><CircleAlert /></div><div className="alert-copy"><span className="eyebrow">{alert.type}</span><h2>{alert.title}</h2><p>{alert.message}</p><small>{alertTab === 'done' ? 'Action recorded' : `Assigned to ${role}`}</small></div><div className="alert-actions"><button className="primary-button" onClick={() => runAlert(alert)}>{alert.action}</button>{alertTab === 'open' ? <button className="text-button" onClick={() => markDone(alert.title)}>Mark action taken</button> : <button className="text-button" onClick={() => setDoneAlerts(doneAlerts.filter((title) => title !== alert.title))}>Reopen</button>}</div></article>)}{!(alertTab === 'open' ? openAlerts : closedAlerts).length && <p className="transfer-no-results">{alertTab === 'open' ? 'All caught up — no open alerts.' : 'No completed alerts yet.'}</p>}</div>{actionNote && <div className="success-note">{actionNote}</div>}</section>
  if (tab === 'settings') return <section className="stock-page"><div className="page-heading"><div><p className="eyebrow">Owner settings</p><h1>Workspace controls</h1><p className="subheading">Manage roles, imports, and the demo environment.</p></div><button className="outline-button" onClick={() => { setSettingsSaved(true); notify('Workspace settings saved') }}><Settings2 /> {settingsSaved ? 'Saved' : 'Save changes'}</button></div><div className="settings-grid"><article className="settings-card"><span className="eyebrow">Users and roles</span><h2>Who can do what</h2>{roles.map((member) => <div className="role-setting" key={member.role}><span className={`avatar ${member.tone}`}>{staff[member.role].split(/\s+/).filter((part) => part && part !== 'Mme').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>{editingRole === member.role ? <><div><input className="inline-edit" aria-label={`Name for ${member.role}`} autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && editName.trim()) { setStaff({ ...staff, [member.role]: editName.trim() }); setEditingRole(null); notify(`${member.role} renamed to ${editName.trim()}`) } if (event.key === 'Escape') setEditingRole(null) }} /><small>{member.role}</small></div><button className="primary-button" disabled={!editName.trim()} onClick={() => { setStaff({ ...staff, [member.role]: editName.trim() }); setEditingRole(null); notify(`${member.role} renamed to ${editName.trim()}`) }}>Save</button><button className="text-button" onClick={() => setEditingRole(null)}>Cancel</button></> : <><div><strong>{staff[member.role]}</strong><small>{member.role}</small></div><button className="outline-button" onClick={() => { setEditingRole(member.role); setEditName(staff[member.role]) }}>Edit</button></>}</div>)}</article><article className="settings-card"><span className="eyebrow">System pricing</span><h2>Automatic repricing</h2><div className="settings-note">Prices are calculated from the Electre reference price and the current USD→EGP exchange rate (now {exchangeRate.toFixed(2)}). Every checkout stores the rate used.</div><button className="outline-button" onClick={() => onNavigate?.('exchange-rate')}>Open exchange rate</button><p className="settings-note">Demo mode: Electre, WhatsApp, email, and the online exchange rate are simulated.</p></article></div></section>
  return <section className="stock-page"><div className="page-heading"><div><p className="eyebrow">Stock control · {role}</p><h1>Move, count, and value stock</h1><p className="subheading">Every change writes a movement. Reserved copies can never be sold.</p></div><div className="heading-actions"><button className="outline-button" onClick={() => setTab('alerts')}><Bell /> {alerts.length} alerts</button><button className="primary-button" onClick={() => { setTransferFormOpen(true); setTransferCreated(false); setTab('transfers') }}><Package /> New transfer</button></div></div><div className="stock-tabs"><button className={tab === 'transfers' ? 'active' : ''} onClick={() => setTab('transfers')}>Transfers</button><button className={tab === 'counts' ? 'active' : ''} onClick={() => setTab('counts')}>Stock counts</button><button className={tab === 'shelves' ? 'active' : ''} onClick={() => setTab('shelves')}>Shelves</button><button className={tab === 'valuation' ? 'active' : ''} onClick={() => setTab('valuation')}>Valuation</button></div>{tab === 'transfers' && <div className="stock-grid"><article className="movement-card"><div className="card-title"><div><span className="eyebrow">Transfer tasks</span><h2>Bring books to the shop</h2></div><span className={`status-pill ${tasks.some((task) => !task.done) ? 'warning' : 'good'}`}>{tasks.filter((task) => !task.done).length} open</span></div>{tasks.map((task) => <div className="movement-row" key={task.id}><span className="movement-arrow">{task.done ? '✓' : '→'}</span><div><strong>{task.route}</strong><small>{task.detail}</small></div>{task.done ? <span className="status-pill good">Done</span> : <button className="primary-button" onClick={() => { setTasks(tasks.map((item) => item.id === task.id ? { ...item, done: true } : item)); notify(`Transfer ${task.route} completed by ${person}`) }}>Done, it&apos;s on the shelf</button>}</div>)}</article><article className="movement-card"><span className="eyebrow">Recent movement log</span><h2>Nothing happens silently</h2><div className="movement-log"><span><b>+3</b> L’Étranger · Depot DP-R2 <small>Karim · 2 Nov, 13:42</small></span><span><b>-1</b> Le Petit Prince · Sale R-1044 <small>Nour · 2 Nov, 10:42</small></span><span><b>+5</b> Mendiants · PO-208 received <small>Karim · 1 Nov, 16:08</small></span></div></article></div>}{tab === 'counts' && <div className="stock-grid"><article className="movement-card"><span className="eyebrow">Count a shelf</span><h2>Shop floor · SF-A1</h2><p className="subheading">Enter the physical count. Differences over 2 copies require Owner approval.</p><div className="count-list">{books.slice(0, 4).map((book) => <label key={book.isbn}><span><strong>{book.title}</strong><small>System says {book.shelves[0].copies}</small></span><input type="number" min="0" placeholder="Counted" value={counts[book.isbn] ?? ''} onChange={(e) => { setCounts({ ...counts, [book.isbn]: e.target.value }); setCountPosted(false); setCountResult('') }} /></label>)}</div><button className="primary-button" disabled={countPosted || !Object.values(counts).some((value) => value !== '')} onClick={() => { const entered = books.slice(0, 4).filter((book) => (counts[book.isbn] ?? '') !== ''); const diffs = entered.map((book) => ({ book, diff: Number(counts[book.isbn]) - book.shelves[0].copies })).filter((item) => item.diff !== 0); const big = diffs.filter((item) => Math.abs(item.diff) > 2); setCountPosted(true); setCountResult(!diffs.length ? `${entered.length} title(s) counted, all match the system.` : `${diffs.map((item) => `${item.book.title} ${item.diff > 0 ? '+' : ''}${item.diff}`).join(', ')}.${big.length ? ` ${big.length} correction(s) over 2 copies are waiting for Owner approval.` : ' Corrections posted.'}`); notify('Shelf count posted') }}>{countPosted ? 'Count posted' : 'Post count'}</button>{countResult && <p className="success-note">{countResult}</p>}</article><article className="movement-card"><span className="eyebrow">Correction policy</span><h2>Safe stock corrections</h2><p className="subheading">The system posts correction movements with a reason and keeps the original count visible to the Owner.</p><div className="policy-callout">Corrections over 2 copies are locked until Mme Hoda approves them.</div></article></div>}{tab === 'shelves' && <div className="stock-grid"><article className="movement-card"><span className="eyebrow">Shelves by location</span><h2>Print an 80mm label</h2>{['Shop floor · SF-A1', 'Shop floor · SF-A2', 'Basement store · BS-B1', 'Depot · DP-R2'].map((shelf) => <div className="shelf-row" key={shelf}><span><strong>{shelf.split(' · ')[1]}</strong><small>{shelf.split(' · ')[0]} · count due 8 Dec</small></span><button className="outline-button" onClick={() => window.print()}><Printer /> Print</button></div>)}</article><article className="movement-card"><span className="eyebrow">Add shelf</span><h2>New shelf code</h2><p className="subheading">Codes are generated from the location and next available slot.</p><button className="primary-button" disabled={shelfAdded} onClick={() => { setShelfAdded(true); notify('Shelf SF-E1 added') }}>{shelfAdded ? 'Shelf added · SF-E1' : 'Add shelf · SF-E1'}</button></article></div>}{tab === 'valuation' && <div className="movement-card"><span className="eyebrow">Stock valuation</span><h2>Value at cost</h2><div className="valuation-grid">{[['Shop floor', 1284], ['Basement store', 2946], ['Depot', 1108], ['Total · all categories', 5338]].map(([label, usd]) => <div key={label}><span>{label}</span><strong>USD {Number(usd).toLocaleString()}</strong><small>EGP {Math.round(Number(usd) * exchangeRate).toLocaleString()} at {exchangeRate.toFixed(2)}</small></div>)}</div></div>}{transferFormOpen && <div className="payment-modal-backdrop"><div className="payment-modal po-modal"><button className="modal-close" onClick={() => setTransferFormOpen(false)}><X /></button><span className="eyebrow">Inventory movement · {role}</span><h2>New stock transfer</h2><p>Move available copies between Shop floor, Basement store, and Zamalek Depo.</p><label>Find book by title, category, or ISBN<input value={transferSearch} onChange={(event) => setTransferSearch(event.target.value)} placeholder="Search title, category, or scan an ISBN" /></label>{transferSearch.trim() && <div className="transfer-book-results" role="listbox" aria-label="Matching books">{transferSearchResults.length ? transferSearchResults.map((book) => { const totalCopies = book.shelves.reduce((sum, shelf) => sum + shelf.copies, 0); return <button type="button" className="transfer-book-result" key={book.isbn} disabled={totalCopies === 0} onClick={() => { const source = book.shelves.find((shelf) => shelf.copies > 0); const destination = book.shelves.find((shelf) => shelf.location !== source?.location); setTransferForm({ ...transferForm, book: book.title, quantity: '1', from: source?.location || '', to: destination?.location || '' }); setTransferSearch('') }}><span><strong>{book.title}</strong><small>{book.category} · ISBN {book.isbn} · {totalCopies} copies across locations</small></span><b>{totalCopies > 0 ? 'Select book' : 'No available stock'}</b></button> }) : <p className="transfer-no-results">No close matches found. Try a title, category, or ISBN.</p>}</div>}{selectedTransferBook && <div className="transfer-book-summary"><strong>{selectedTransferBook.title}</strong><span>ISBN {selectedTransferBook.isbn}</span><span>{selectedTransferBook.shelves.map((shelf) => `${shelf.location}: ${shelf.copies}`).join(' · ')}</span></div>}<label>Quantity<input type="number" min="1" max={selectedTransferBook?.shelves.find((shelf) => shelf.location === transferForm.from)?.copies || 0} value={transferForm.quantity} onChange={(event) => setTransferForm({ ...transferForm, quantity: event.target.value })} /></label><div className="po-form-grid"><label>From<select value={transferForm.from} onChange={(event) => { const nextFrom = event.target.value; setTransferForm({ ...transferForm, from: nextFrom, to: transferDestinationLocations.find((shelf) => shelf.location !== nextFrom)?.location || '' }) }}>{transferSourceLocations.map((shelf) => <option key={shelf.location} value={shelf.location}>{shelf.location} · {shelf.copies} available</option>)}</select></label><label>To<select value={transferForm.to} onChange={(event) => setTransferForm({ ...transferForm, to: event.target.value })}>{transferDestinationLocations.map((shelf) => <option key={shelf.location} value={shelf.location}>{shelf.location}</option>)}</select></label></div><label>Movement note<textarea value={transferForm.note} onChange={(event) => setTransferForm({ ...transferForm, note: event.target.value })} placeholder="Reason or handling note" /></label><button className="primary-button full-button" disabled={!selectedTransferBook || !transferSourceLocations.some((shelf) => shelf.location === transferForm.from) || Number(transferForm.quantity) < 1 || Number(transferForm.quantity) > (selectedTransferBook?.shelves.find((shelf) => shelf.location === transferForm.from)?.copies || 0) || transferForm.from === transferForm.to} onClick={() => { const code = (location: string) => selectedTransferBook?.shelves.find((shelf) => shelf.location === location)?.code || location; setTasks([...tasks, { id: `t${Date.now()}`, route: `${code(transferForm.from)} → ${code(transferForm.to)}`, detail: `${transferForm.book} · ${transferForm.quantity} ${Number(transferForm.quantity) === 1 ? 'copy' : 'copies'} · created by ${person}${transferForm.note ? ` · ${transferForm.note}` : ''}`, done: false }]); setTransferCreated(true); setTransferFormOpen(false); notify(`Transfer created: ${transferForm.quantity} × ${transferForm.book}`) }}>Create transfer</button>{transferCreated && <p className="success-note">Transfer created for {selectedTransferBook?.title}: {transferForm.quantity} copies from {transferForm.from} to {transferForm.to}.</p>}</div></div>}</section>
}

function ReceiveStockWorkspace({ role }: { role: Role }) {
  const [receiptStatus, setReceiptStatus] = useState<'Expected' | 'Check requested' | 'Received'>('Expected')
  const isInventoryManager = role === 'Inventory Manager'
  return <section className="procurement-page"><div className="page-heading"><div><p className="eyebrow">Receiving · {role}</p><h1>Receive stock</h1><p className="subheading">Check incoming supplier deliveries and keep the team informed.</p></div><span className={`status-pill ${receiptStatus === 'Received' ? 'good' : receiptStatus === 'Check requested' ? 'warning' : 'neutral'}`}>{receiptStatus}</span></div><article className="movement-card receive-stock-card"><span className="eyebrow">Expected delivery · PO-209</span><h2>Hachette Livre</h2><div className="payment-detail-facts"><span>Purchase order<strong>PO-209</strong></span><span>Expected<strong>8 Nov 2026</strong></span><span>Items<strong>8 titles · 42 copies</strong></span><span>Destination<strong>Basement store</strong></span></div>{receiptStatus === 'Received' ? <p className="success-note">Receipt confirmed by Inventory Manager.</p> : isInventoryManager ? <button className="primary-button" onClick={() => { setReceiptStatus('Received'); notify('PO-209 received into Basement store') }}>Confirm stock received</button> : <><p className="subheading">Sales Assistants can notify the Inventory Manager to verify and receive this delivery. Stock counts are only updated after manager confirmation.</p><button className="primary-button" disabled={receiptStatus === 'Check requested'} onClick={() => { setReceiptStatus('Check requested'); notify('Receipt check requested from the Inventory Manager') }}>{receiptStatus === 'Check requested' ? 'Request sent to Inventory Manager' : 'Request receipt check'}</button></>}</article></section>
}

function ReadyPickupWorkspace({ onCheckout }: { onCheckout: () => void }) {
  return <section className="procurement-page"><div className="page-heading"><div><p className="eyebrow">Customer requests · Sales Assistant</p><h1>Ready for pickup</h1><p className="subheading">Arrived copies reserved for customers with deposits already recorded.</p></div></div><div className="table-card pickup-list"><div className="procurement-table-head"><span>Book</span><span>Customer</span><span>Copies</span><span>Deposit</span><span>Action</span></div><div className="procurement-row"><span><strong>Persepolis</strong><small>REQ-011 · Arrived – reserved</small></span><span><strong>Yasmine Hosny</strong><small>+20 100 555 0111</small></span><span><strong>1 copy</strong></span><span><strong>305 EGP</strong><small>Paid on request</small></span><span><button className="primary-button compact-button" onClick={onCheckout}>Check out for customer</button></span></div><div className="procurement-row"><span><strong>L&apos;Étranger</strong><small>REQ-014 · Arrived – reserved</small></span><span><strong>Omar Khaled</strong><small>+20 101 555 0144</small></span><span><strong>1 of 2</strong><small>1 still on order</small></span><span><strong>420 EGP</strong><small>Paid on request</small></span><span><button className="outline-button compact-button" onClick={onCheckout}>Check out available</button></span></div></div></section>
}

function ExchangeRateWorkspace({ role, person, onRateChange, currentRate, history, syncStatus }: { role: Role; person: string; onRateChange: (change: RateChange) => Promise<string | null>; currentRate: number; history: RateChange[]; syncStatus: string }) {
  const [rate, setRate] = useState(currentRate.toFixed(2))
  const [note, setNote] = useState('')
  const [source, setSource] = useState('manual')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const rateInput = useRef<HTMLInputElement>(null)
  useEffect(() => setRate(currentRate.toFixed(2)), [currentRate])
  const canEdit = role === 'Owner' || role === 'Accountant'
  const nextRate = Number(rate)
  const validRate = Number.isFinite(nextRate) && nextRate > 0
  const changed = books.filter((book) => validRate && priceEGP(book.usd, nextRate) !== priceEGP(book.usd, currentRate))
  const avgChange = validRate && currentRate ? ((nextRate - currentRate) / currentRate) * 100 : 0
  const example = books[0]
  const last = history[0]
  const saveRate = async () => {
    setMessage('')
    if (!validRate) { setError('Enter a valid rate greater than zero, e.g. 49.50.'); return }
    if (Math.abs(nextRate - currentRate) < 0.0001) { setError('This is already the current rate. Change the number before saving.'); return }
    if (!note.trim()) { setError('Add a short note explaining why the rate is changing.'); return }
    if (Math.abs(avgChange) > 20 && !window.confirm(`This changes every price by ${avgChange.toFixed(1)}%. Save anyway?`)) return
    setBusy(true); setError('')
    const problem = await onRateChange({ rate: Math.round(nextRate * 10000) / 10000, note: note.trim(), setBy: person, at: new Date().toISOString(), source })
    setBusy(false)
    setNote(''); setSource('manual')
    setMessage(`Saved by ${person}. Every book now uses ${nextRate.toFixed(2)} EGP/USD — ${changed.length} prices updated.${problem ? ` ${problem}` : ''}`)
  }
  const fetchOnline = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD')
      const data = await response.json()
      const egp = Number(data?.rates?.EGP)
      if (!egp) throw new Error('missing EGP')
      setRate(egp.toFixed(2)); setSource('online'); setNote(`Online market rate (open.er-api.com, ${new Date().toLocaleDateString('en-GB')})`)
      setMessage(`Today's online rate is ${egp.toFixed(2)} EGP/USD. Review the impact, then press Save rate.`)
    } catch { setError('Could not reach the online rate service. Enter the rate manually instead.') }
    setBusy(false)
  }
  return <section className="procurement-page"><div className="page-heading"><div><p className="eyebrow">Pricing controls · {role}</p><h1>Exchange rate</h1><p className="subheading">One rate for every book, with a complete audit trail.</p></div>{canEdit && <button className="primary-button" disabled={busy} onClick={saveRate}>{busy ? 'Saving…' : 'Save rate'}</button>}</div><div className="exchange-layout"><article className="settings-card exchange-card"><span className="eyebrow">USD → EGP</span><h2>Current rate</h2><div className="rate-input"><input ref={rateInput} inputMode="decimal" aria-label="USD to EGP rate" value={rate} onChange={(event) => { setRate(event.target.value); setSource('manual'); setError('') }} disabled={!canEdit} /><span>EGP</span></div><p className="settings-note">{last ? `In use: ${last.rate.toFixed(2)} · set ${formatRateTime(last.at)} by ${last.setBy} · ${last.source}` : 'No rate history yet'}<br /><small>{syncStatus}</small></p>{canEdit ? <><div className="exchange-actions"><button className="outline-button" disabled={busy} onClick={fetchOnline}>Fetch today&apos;s rate online</button><button className="text-button" onClick={() => { setSource('manual'); rateInput.current?.focus(); rateInput.current?.select() }}>Set rate manually</button></div><label className="rate-note">Required note<input value={note} onChange={(event) => { setNote(event.target.value); setError('') }} placeholder="Why is this rate changing?" /></label></> : <p className="settings-note">Only the Accountant or Owner can change the rate.</p>}{error && <p className="payment-error" role="alert">{error}</p>}{message && <p className="success-note" role="status">{message}</p>}</article><article className="settings-card"><span className="eyebrow">Impact preview</span><h2>{validRate && nextRate !== currentRate ? `${changed.length} of ${books.length} books will be repriced` : 'No price changes yet'}</h2><div className="impact-number">{validRate && nextRate !== currentRate ? `average ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(1)}%` : '—'}</div><p className="settings-note">Example: {example.title} <strong>{priceEGP(example.usd, currentRate)} → {validRate ? priceEGP(example.usd, nextRate) : '?'} EGP</strong></p><div className="rate-history">{history.slice(0, 6).map((item) => <span key={item.at + item.rate}>{item.rate.toFixed(2)} <small>set by {item.setBy} · {formatRateTime(item.at)} · {item.note}</small></span>)}</div></article></div></section>
}

function TodayTasks({ role, onNavigate }: { role: Role; onNavigate: (view: string) => void }) {
  const tasks = role === 'Owner' ? [
    { title: 'Approve purchase order', detail: 'PO-209 · Sodis · 42 copies', action: 'purchase-orders', label: 'Review order' },
    { title: 'Review payment due', detail: 'PO-206 · EGP 10,920 overdue', action: 'payments', label: 'Open payment' },
    { title: 'Review stock move', detail: 'Sales Assistant request between locations', action: 'stock-control', label: 'Review move' },
  ] : role === 'Inventory Manager' ? [
    { title: 'Approve stock move', detail: 'New request from Sales Assistant', action: 'stock-control', label: 'Review move' },
    { title: 'Receive purchase order', detail: 'PO-209 · delivery due soon', action: 'receive-stock', label: 'Open delivery' },
  ] : role === 'Accountant' ? [
    { title: 'Record payment', detail: 'PO-206 · Actes Sud · EGP 10,920', action: 'payments', label: 'Open payments' },
    { title: 'Update exchange rate', detail: 'Keep catalogue prices current', action: 'exchange-rate', label: 'Open rate' },
  ] : [
    { title: 'Make today’s sales', detail: 'Serve customers and issue receipts', action: 'sell', label: 'Open sales desk' },
    { title: 'Request stock move', detail: 'Move copies between store locations', action: 'requests', label: 'Open requests' },
  ]
  return <section className="tasks-page"><div className="page-heading"><div><p className="eyebrow">Daily workflow · {role}</p><h1>Today&apos;s tasks</h1><p className="subheading">Your actionable work, collected from notifications and operational priorities.</p></div><div className="task-count">{tasks.length} open</div></div><div className="tasks-list">{tasks.map((task) => <article className="task-card" key={task.title}><div className="task-status" /><div className="task-copy"><span className="eyebrow">Today</span><h2>{task.title}</h2><p>{task.detail}</p></div><button className="primary-button" onClick={() => onNavigate(task.action)}>{task.label}</button></article>)}</div></section>
}

function InventoryDashboard({ exchangeRate, role, sales, requests, onNavigate }: { exchangeRate: number; role: Role; sales: Sale[]; requests: BookRequest[]; onNavigate: (view: string) => void }) {
  const todaySales = sales.filter((sale) => new Date(sale.at).toDateString() === new Date().toDateString())
  const todayTotal = `EGP ${todaySales.reduce((sum, sale) => sum + sale.total, 0).toLocaleString()}`
  const locations = ['Shop floor', 'Basement store', 'Zamalek Depo']
  const totals = locations.map((location) => ({ location, count: books.reduce((sum, book) => sum + (book.shelves.find((shelf) => shelf.location === location)?.copies || 0), 0) }))
  const totalBooks = totals.reduce((sum, item) => sum + item.count, 0)
  const lowStock = books.filter((book) => book.status === 'Order soon').length
  const metrics = role === 'Sales Assistant' ? [
    ['Today’s Sales', todayTotal, `From ${todaySales.length} receipts today`], ['Receipts Issued Today', String(todaySales.length), 'Sales recorded today'], ['Book Requests Logged', String(requests.length), 'Requests in the work queue'], ['Exchange Rate', `${exchangeRate.toFixed(2)} EGP`, 'USD / EGP today'],
  ] : role === 'Inventory Manager' ? [
    ['Books in Stock', String(totalBooks), 'Across all locations'], ['Low-Stock Alerts', String(lowStock), 'Books below reorder level'], ['Pending Purchase Orders', '2', 'Due this week'], ['Incoming Deliveries', '1', 'Expected delivery'],
  ] : role === 'Accountant' ? [
    ['Today’s Revenue', todayTotal, `From ${todaySales.length} receipts today`], ['Unpaid POs', '3', 'Open invoices'], ['Payments Due This Week', 'EGP 32,560', 'Across 2 purchase orders'], ['Current Exchange Rate', `${exchangeRate.toFixed(2)} EGP`, 'USD / EGP today'],
  ] : [
    ['Total Sales', 'EGP 286,420', '+12.8% vs last month'], ['Books in Stock', String(totalBooks), 'Across all locations'], ['Pending Orders', '3', 'Open purchase invoices'], ['Low-Stock Alerts', String(lowStock), 'Books below reorder level'],
  ]
  return <section className="dashboard-page"><div className="page-heading"><div><p className="eyebrow">Operations overview · {role}</p><h1>Dashboard</h1><p className="subheading">Inventory, sales performance, and the actions that need attention.</p></div><div className="heading-actions">{role === 'Sales Assistant' && <button className="primary-button dashboard-primary-action" onClick={() => onNavigate('sell')}><HandCoins /> New Sale</button>}<div className="date-picker"><CalendarDays /> This month <ChevronDown /></div></div></div><div className="dashboard-metrics">{metrics.map(([label, value, note]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div><div className="dashboard-grid"><article className="dashboard-card"><div className="card-heading"><div><span className="eyebrow">Inventory by location</span><h2>Books in hand</h2></div><Package /></div><div className="location-bars">{totals.map((item) => <div className="location-bar" key={item.location}><div><span>{item.location}</span><strong>{item.count} copies</strong></div><div className="bar-track"><i style={{ width: `${Math.max(8, (item.count / Math.max(totalBooks, 1)) * 100)}%` }} /></div></div>)}</div><p className="dashboard-note">All three locations are included in the live stock view.</p></article><article className="dashboard-card"><div className="card-heading"><div><span className="eyebrow">Sales analytics</span><h2>Revenue trend</h2></div><TrendingUp /></div><div className="revenue-chart"><span style={{ height: '42%' }} /><span style={{ height: '58%' }} /><span style={{ height: '48%' }} /><span style={{ height: '71%' }} /><span style={{ height: '66%' }} /><span style={{ height: '88%' }} /><span style={{ height: '100%' }} /></div><div className="chart-labels"><span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span><span>W6</span><span>Now</span></div><p className="dashboard-note">Average basket <strong>EGP 742</strong> · Exchange rate <strong>{exchangeRate.toFixed(2)} EGP/USD</strong></p></article><article className="dashboard-card attention-card"><div className="card-heading"><div><span className="eyebrow">Important to note</span><h2>Action queue</h2></div><CircleAlert /></div><ul className="action-queue"><li><b>PO-209</b><span>Waiting for Owner approval</span><em>Today</em></li><li><b>PO-206</b><span>EGP 10,920 overdue</span><em>10 days</em></li><li><b>REQ-015</b><span>Customer waiting for arrival</span><em>Open</em></li><li><b>Stock move</b><span>Sales Assistant request to review</span><em>New</em></li></ul></article></div></section>
}

export default function Page() {
  const [role, setRole] = useState<Role>('Inventory Manager')
  const [staff, setStaff] = useState<Record<Role, string>>(() => Object.fromEntries(roles.map((item) => [item.role, item.person])) as Record<Role, string>)
  const person = staff[role]
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_RATE)
  const [rateHistory, setRateHistory] = useState<RateChange[]>(INITIAL_RATE_HISTORY)
  const [syncStatus, setSyncStatus] = useState('Saved in this browser. Connect Supabase to sync every device.')
  const [sales, setSales] = useState<Sale[]>(INITIAL_SALES)
  const [requests, setRequests] = useState<BookRequest[]>(INITIAL_REQUESTS)
  const [selected, setSelected] = useState<Book>(books[0])
  const [detailOpen, setDetailOpen] = useState(true)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All books')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [stockFilter, setStockFilter] = useState('Any stock')
  const [sortBy, setSortBy] = useState('Recently viewed')
  const [mobileNav, setMobileNav] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [activeView, setActiveView] = useState<'catalog' | 'sell' | 'receipts' | 'dashboard' | 'today-tasks' | 'requests' | 'purchase-orders' | 'suppliers' | 'payments' | 'stock-control' | 'alerts' | 'settings' | 'exchange-rate' | 'receive-stock'>('catalog')
  const [deskToast, setDeskToast] = useState('')
  const rateRef = useRef(DEFAULT_RATE)

  // Toasts: any part of the app calls notify('...') to confirm a real action.
  useEffect(() => {
    let timer = 0
    const show = (event: Event) => { setDeskToast((event as CustomEvent<string>).detail); window.clearTimeout(timer); timer = window.setTimeout(() => setDeskToast(''), 3600) }
    window.addEventListener('desk-toast', show)
    return () => { window.removeEventListener('desk-toast', show); window.clearTimeout(timer) }
  }, [])

  // ---- Exchange rate: one source of truth, persisted and pushed live to every open screen ----
  const applyRate = (change: RateChange, fromElsewhere: boolean) => {
    setRateHistory((prev) => {
      if (prev.some((item) => item.at === change.at && item.rate === change.rate)) return prev
      const next = [change, ...prev].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30)
      try { localStorage.setItem('llf-exchange-rate', JSON.stringify(next)) } catch {}
      return next
    })
    if (rateRef.current !== change.rate) {
      rateRef.current = change.rate
      setExchangeRate(change.rate)
      if (fromElsewhere) notify(`Exchange rate changed to ${change.rate.toFixed(2)} by ${change.setBy}. All prices updated.`)
    }
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('llf-exchange-rate') || 'null') as RateChange[] | null
      if (saved?.length) { setRateHistory(saved); rateRef.current = saved[0].rate; setExchangeRate(saved[0].rate) }
    } catch {}
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'llf-exchange-rate' || !event.newValue) return
      try { const list = JSON.parse(event.newValue) as RateChange[]; if (list[0]) applyRate(list[0], true) } catch {}
    }
    window.addEventListener('storage', onStorage)
    const supabase = getSupabase()
    if (!supabase) return () => window.removeEventListener('storage', onStorage)
    const fromRow = (row: { rate: number; note: string; set_by: string; created_at: string; source?: string }): RateChange => ({ rate: Number(row.rate), note: row.note, setBy: row.set_by, at: row.created_at, source: row.source || 'manual' })
    supabase.from('exchange_rates').select('rate, note, set_by, created_at, source').order('created_at', { ascending: false }).limit(20).then(({ data, error }) => {
      if (error) { setSyncStatus('Saved in this browser only. Run supabase/exchange_rates.sql to sync every device.'); return }
      setSyncStatus('Live sync on: every open screen updates instantly.')
      if (data?.length) { const list = data.map(fromRow); setRateHistory(list); rateRef.current = list[0].rate; setExchangeRate(list[0].rate); try { localStorage.setItem('llf-exchange-rate', JSON.stringify(list)) } catch {} }
    })
    const channel = supabase.channel('exchange-rates').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'exchange_rates' }, (payload) => applyRate(fromRow(payload.new as never), true)).subscribe()
    return () => { window.removeEventListener('storage', onStorage); supabase.removeChannel(channel) }
  }, [])
  const saveRate = async (change: RateChange) => {
    applyRate(change, false)
    const supabase = getSupabase()
    if (!supabase) return 'It will sync to other devices once Supabase is connected.'
    const { error } = await supabase.from('exchange_rates').insert({ rate: change.rate, note: change.note, set_by: change.setBy, source: change.source, created_at: change.at })
    if (error) { setSyncStatus('Saved in this browser only. Run supabase/exchange_rates.sql to sync every device.'); return `Not synced to other devices yet (${error.message}).` }
    setSyncStatus('Live sync on: every open screen updates instantly.')
    return null
  }

  const categories = ['All books', ...Array.from(new Set(books.map((book) => book.category)))]
  const filtered = useMemo(() => {
    const q = normalizeSearchText(query)
    const list = books.filter((book) => (!q || normalizeSearchText(`${book.title} ${book.author}`).includes(q) || book.isbn.includes(query.replace(/\D/g, '') || '§'))
      && (category === 'All books' || book.category === category)
      && (stockFilter === 'Any stock' || (stockFilter === 'In stock' ? book.available > 0 : stockFilter === 'Low stock' ? book.available > 0 && book.available < 5 : book.available === 0)))
    if (sortBy === 'Title A–Z') return [...list].sort((a, b) => a.title.localeCompare(b.title))
    if (sortBy === 'Price low–high') return [...list].sort((a, b) => a.usd - b.usd)
    if (sortBy === 'Price high–low') return [...list].sort((a, b) => b.usd - a.usd)
    return list
  }, [query, category, stockFilter, sortBy])
  const sortOptions = ['Recently viewed', 'Title A–Z', 'Price low–high', 'Price high–low']
  const exportCatalogue = () => downloadCsv('llf-catalogue.csv', [['Title', 'Author', 'Category', 'ISBN', 'USD', `EGP (rate ${exchangeRate.toFixed(2)})`, 'Available', 'Reserved', 'On order', 'Status'], ...filtered.map((book) => [book.title, book.author, book.category, book.isbn, book.usd.toFixed(2), priceEGP(book.usd, exchangeRate), book.available, book.reserved, book.onOrder, book.status])])

  const nav = role === 'Sales Assistant' ? ['Today tasks', 'Overview', 'Find a book', 'Make a sale', 'Receipts', 'My requests'] : role === 'Accountant' ? ['Today tasks', 'Overview', 'Find a book', 'Receipts', 'Requests', 'Purchase orders', 'Suppliers', 'Payments', 'Exchange rate', 'Notifications'] : role === 'Owner' ? ['Today tasks', 'Overview', 'Find a book', 'Inventory', 'Requests', 'Purchase orders', 'Suppliers', 'Payments', 'Exchange rate', 'Notifications', 'Settings'] : ['Today tasks', 'Overview', 'Find a book', 'Inventory', 'Requests', 'Notifications']
  const groups = [
    { title: 'Workspace', items: ['Today tasks', 'Overview'] },
    { title: 'Sales', items: ['Find a book', 'Make a sale', 'Receipts'] },
    { title: 'Inventory', items: ['Inventory'] },
    { title: 'Procurement', items: ['Requests', 'My requests', 'Purchase orders', 'Suppliers'] },
    { title: 'Finance', items: ['Payments', 'Exchange rate'] },
    { title: 'Account', items: ['Notifications', 'Settings'] },
  ].map((group) => ({ ...group, items: group.items.filter((item) => nav.includes(item)) })).filter((group) => group.items.length)
  const routeForNav = (item: string) => {
    if (item === 'Today tasks') return 'today-tasks'
    if (item === 'Overview') return 'dashboard'
    if (item === 'Find a book') return 'catalog'
    if (item === 'Make a sale') return 'sell'
    if (item === 'Receipts') return 'receipts'
    if (item === 'Requests' || item === 'My requests') return 'requests'
    if (item === 'Purchase orders') return 'purchase-orders'
    if (item === 'Suppliers') return 'suppliers'
    if (item === 'Payments') return 'payments'
    if (item === 'Inventory') return 'stock-control'
    if (item === 'Notifications') return 'alerts'
    if (item === 'Settings') return 'settings'
    return 'exchange-rate'
  }
  const navIcon = (item: string) => item === 'Today tasks' || item === 'Overview' ? <LayoutDashboard /> : item === 'Find a book' ? <BookOpen /> : item === 'Make a sale' ? <HandCoins /> : item === 'Receipts' ? <Receipt /> : item.includes('request') || item === 'Requests' ? <ClipboardList /> : item === 'Purchase orders' ? <Boxes /> : item === 'Suppliers' ? <Truck /> : item === 'Payments' || item === 'Exchange rate' ? <Landmark /> : item === 'Inventory' ? <Package /> : item === 'Notifications' ? <Bell /> : <Settings2 />
  const go = (view: string) => { setActiveView(view as typeof activeView); setMobileNav(false) }
  const initials = (name: string) => name.split(/\s+/).filter((part) => part && part !== 'Mme').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
  const helpText: Record<Role, string[]> = {
    'Sales Assistant': ['Make a sale: scan or type an exact ISBN to add a book instantly.', 'Receipts: open any receipt to reprint it.', 'My requests: log customer requests and ask for stock moves.'],
    'Inventory Manager': ['Inventory: create transfers, post shelf counts, print labels.', 'Receive stock: confirm supplier deliveries.', 'Notifications: mark alerts done once handled.'],
    Accountant: ['Exchange rate: change the USD→EGP rate. Every book price updates immediately on every screen.', 'Payments: record invoices and upload payment proof.', 'Purchase orders: track what is owed.'],
    Owner: ['Purchase orders and requests wait for your approval.', 'Exchange rate: you can change the rate too.', 'Settings: rename staff accounts.'],
  }

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand"><Logo /><button className="collapse-sidebar" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button></div>
      <div className="sidebar-scroll"><button className="sidebar-search" onClick={() => go('catalog')}><Search /><span>Search catalogue</span></button>
        {groups.map((group) => <section className="sidebar-group" key={group.title}><h2>{group.title}</h2>{group.items.map((item) => { const target = routeForNav(item); const active = activeView === target; return <button key={item} className={`sidebar-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} title={sidebarCollapsed ? item : undefined} onClick={() => go(target)}>{navIcon(item)}<span>{item}</span></button> })}</section>)}
      </div>
      <div className="sidebar-footer"><CircleUserRound /><span><b>{person}</b><small>{role}</small></span></div>
    </aside>
    {mobileNav && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <div className="app-main"><header className="topbar"><div className="topbar-inner"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Open navigation"><Menu /></button><div className="breadcrumb"><span>Workspace</span><ChevronRight /><strong>{activeView === 'catalog' ? 'Find a book' : activeView.replaceAll('-', ' ')}</strong></div><div className="top-actions"><button className="top-search" aria-label="Open catalogue search" onClick={() => go('catalog')}><Search /></button><button className="rate-chip" title={rateHistory[0] ? `Set by ${rateHistory[0].setBy} · ${formatRateTime(rateHistory[0].at)}` : undefined} onClick={() => go('exchange-rate')}><span>USD / EGP</span><b>{exchangeRate.toFixed(2)}</b></button><button className="icon-button notification" aria-label="Notifications" onClick={() => go('alerts')}><Bell /><span>{role === 'Owner' ? 5 : role === 'Accountant' ? 1 : role === 'Inventory Manager' ? 2 : 3}</span></button><button className="profile" onClick={() => setShowLogin(true)}><span className="avatar">{initials(person)}</span><span className="profile-copy"><b>{person}</b><small>{role}</small></span><ChevronDown /></button></div></div></header>
    <main className="page">{activeView === 'receive-stock' ? <ReceiveStockWorkspace role={role} /> : activeView === 'today-tasks' ? <TodayTasks role={role} onNavigate={go} /> : activeView === 'exchange-rate' ? <ExchangeRateWorkspace role={role} person={person} currentRate={exchangeRate} history={rateHistory} syncStatus={syncStatus} onRateChange={saveRate} /> : activeView === 'requests' ? <OrderRequestsWorkspace role={role} person={person} requests={requests} setRequests={setRequests} /> : ['stock-control', 'alerts', 'settings'].includes(activeView) ? <StockWorkspace view={activeView as 'stock-control' | 'alerts' | 'settings'} role={role} person={person} exchangeRate={exchangeRate} rateHistory={rateHistory} staff={staff} setStaff={setStaff} onNavigate={go} /> : activeView === 'purchase-orders' ? <PurchaseOrdersWorkspace role={role} person={person} requests={requests} setRequests={setRequests} /> : ['suppliers', 'payments'].includes(activeView) ? <ProcurementWorkspace view={activeView as 'suppliers' | 'payments'} role={role} /> : activeView === 'dashboard' ? <InventoryDashboard exchangeRate={exchangeRate} role={role} sales={sales} requests={requests} onNavigate={go} /> : activeView !== 'catalog' ? <SalesWorkspace view={activeView === 'receipts' ? 'receipts' : 'sell'} role={role} cashier={person} exchangeRate={exchangeRate} sales={sales} onSale={(sale) => setSales([sale, ...sales])} /> : <><div className="page-heading"><div><p className="eyebrow">{role === 'Sales Assistant' ? 'Sales desk' : 'Stock workspace'}</p><h1>{role === 'Accountant' || role === 'Owner' ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${person.split(' ')[0] === 'Mme' ? person : person.split(' ')[0]}` : 'Find a book'}</h1><p className="subheading">Search the catalogue, check availability, and keep every copy accounted for.</p></div><div className="heading-actions"><button className="outline-button" onClick={exportCatalogue}><Download /> Export</button><button className="primary-button" onClick={() => go('receive-stock')}><Package /> Receive stock</button></div></div>
      <section className="stats"><div><span className="stat-label">Books in catalogue</span><strong>1,248</strong><span className="stat-note up"><TrendingUp /> 2.4% this month</span></div><div><span className="stat-label">Available copies</span><strong>8,642</strong><span className="stat-note">Across 3 locations</span></div><div><span className="stat-label">Reorder alerts</span><strong className="alert-number">12</strong><span className="stat-note warning"><CircleAlert /> Needs attention</span></div><div><span className="stat-label">Exchange rate</span><strong>{exchangeRate.toFixed(2)} <em>EGP</em></strong><span className="stat-note">1 USD · {rateHistory[0] ? `set ${formatRateTime(rateHistory[0].at)}` : 'updated today'}</span></div></section>
      <div className={`workspace ${detailOpen ? '' : 'detail-closed'}`}><section className="catalog-panel"><div className="search-row"><label className="search-box"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, author or ISBN" /><kbd>⌘ K</kbd></label><button className={`filter-button ${filtersOpen ? 'selected' : ''}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal /> Filters{stockFilter !== 'Any stock' ? ' · 1' : ''}</button></div>{filtersOpen && <div className="category-row filter-panel"><span className="filter-label">Stock</span>{['Any stock', 'In stock', 'Low stock', 'Out of stock'].map((item) => <button key={item} className={stockFilter === item ? 'chip selected' : 'chip'} onClick={() => setStockFilter(item)}>{item}</button>)}</div>}<div className="category-row">{categories.map((item) => <button key={item} className={category === item ? 'chip selected' : 'chip'} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="list-heading"><div><h2>Catalogue</h2><span>{filtered.length} of {books.length} books</span></div><button className="sort-button" onClick={() => setSortBy(sortOptions[(sortOptions.indexOf(sortBy) + 1) % sortOptions.length])}>{sortBy} <ChevronDown /></button></div><div className="book-list">{filtered.length ? filtered.map((book) => <button key={book.isbn} onClick={() => { setSelected(book); setDetailOpen(true); setHistoryExpanded(false) }} className={`book-row ${detailOpen && selected.isbn === book.isbn ? 'selected-row' : ''}`}><div className="book-cover"><BookOpen /></div><div className="book-info"><strong>{book.title}</strong><span>{book.author}</span><small>{book.category} · {book.isbn}</small></div><div className="book-price"><strong>{priceEGP(book.usd, exchangeRate)} <small>EGP</small></strong><span className={book.available === 0 ? 'danger' : book.available < 3 ? 'warning-text' : 'available'}>{book.available} available</span></div><ChevronRight className="row-chevron" /></button>) : <p className="transfer-no-results">No books match. Try clearing the filters.</p>}</div></section>
        {detailOpen && <aside className="detail-panel"><div className="detail-header"><div><span className="eyebrow">Book details</span><h2>{selected.title}</h2><p>{selected.author}</p></div><button className="close-detail" aria-label="Close details" onClick={() => setDetailOpen(false)}><X /></button></div><div className="price-card"><div><span>System price</span><strong>{priceEGP(selected.usd, exchangeRate)} <small>EGP</small></strong><p>{selected.usd.toFixed(2)} USD · rate {exchangeRate.toFixed(2)}</p></div><span className="source-tag">Electre</span></div><div className="price-meta"><span>Price checked 31 Oct 2026</span><span>System price always charged</span></div><div className="detail-section"><div className="section-title"><h3>Where it is</h3><span>{selected.available + selected.reserved} on hand</span></div><div className="location-grid">{selected.shelves.map((shelf) => <div className="location-card" key={shelf.code}><span>{shelf.location}</span><strong>{shelf.copies}</strong><small>copies · {shelf.code}</small></div>)}</div></div><div className="stock-line"><span>On hand <b>{selected.available + selected.reserved}</b></span><span>Reserved <b>{selected.reserved}</b></span><span>Available <b>{selected.available}</b></span><span>On order <b>{selected.onOrder}</b></span></div><div className="detail-section history"><div className="section-title"><h3>Recent stock history</h3><button onClick={() => setHistoryExpanded(!historyExpanded)}>{historyExpanded ? 'Show less' : 'View all'} <ChevronRight /></button></div><div className="movement"><span className="movement-dot receipt"></span><div><strong>Received into basement</strong><small>{selected.shelves[1].code} · 4 copies · 31 Oct 2026</small></div><b>+4</b></div><div className="movement"><span className="movement-dot sale"></span><div><strong>Sale</strong><small>Shop floor · 1 copy · 28 Oct 2026</small></div><b>-1</b></div>{historyExpanded && <><div className="movement"><span className="movement-dot receipt"></span><div><strong>Moved to shop floor</strong><small>{selected.shelves[0].code} · 2 copies · 20 Oct 2026</small></div><b>+2</b></div><div className="movement"><span className="movement-dot sale"></span><div><strong>Sale</strong><small>Shop floor · 1 copy · 14 Oct 2026</small></div><b>-1</b></div><div className="movement"><span className="movement-dot receipt"></span><div><strong>Opening stock count</strong><small>All locations · 1 Oct 2026</small></div><b>✓</b></div></>}</div></aside>}</div>
    </>}
    </main>
    {deskToast && <div className="desk-toast" role="status"><span className="toast-check">✓</span>{deskToast}</div>}<button className="help-button" onClick={() => setShowHelp(true)}><span>?</span> Need help?</button>
    {showHelp && <div className="payment-modal-backdrop" onClick={() => setShowHelp(false)}><div className="payment-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}><button className="modal-close" aria-label="Close help" onClick={() => setShowHelp(false)}><X /></button><span className="eyebrow">Quick guide · {role}</span><h2>What you can do here</h2>{helpText[role].map((line) => <p key={line}>• {line}</p>)}<button className="outline-button" onClick={() => { setShowHelp(false); setShowLogin(true) }}>Switch role</button></div></div>}
    {showLogin && <div className="modal-backdrop" onClick={() => setShowLogin(false)}><div className="login-modal" onClick={(e) => e.stopPropagation()}><button className="close-detail" aria-label="Close" onClick={() => setShowLogin(false)}><X /></button><Logo /><h2>Who is working today?</h2><p>Choose a role to preview the LLF workspace.</p><div className="role-list">{roles.map((item) => <button key={item.role} onClick={() => { setRole(item.role); setShowLogin(false); if (item.role === 'Sales Assistant' && ['purchase-orders', 'suppliers', 'payments', 'exchange-rate', 'settings', 'stock-control', 'alerts'].includes(activeView)) setActiveView('catalog'); if (item.role !== 'Owner' && activeView === 'settings') setActiveView('catalog') }} className={role === item.role ? 'role-card chosen' : 'role-card'}><span className={`avatar ${item.tone}`}>{initials(staff[item.role])}</span><span><b>{staff[item.role]}</b><small>{item.role}</small></span><ChevronRight /></button>)}</div></div></div>}
    </div>
  </div>
}
