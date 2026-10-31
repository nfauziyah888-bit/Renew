// Semua tanggal berupa teks "YYYY-MM-DD", dihitung di zona WIB.
export const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
const fmt = (d) => d.toISOString().slice(0, 10)

export const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d) }
// Perhitungan kalender: 31 Jan + 1 bulan = 28/29 Feb (tidak melompat ke Maret)
export const addMonths = (s, n) => {
  const d = parse(s), day = d.getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last)); return fmt(d)
}

export const DURATIONS = [
  { k: '1d', label: '1 hari', d: 1 }, { k: '3d', label: '3 hari', d: 3 },
  { k: '7d', label: '7 hari', d: 7 }, { k: '14d', label: '14 hari', d: 14 },
  { k: '1m', label: '1 bulan', m: 1 }, { k: '2m', label: '2 bulan', m: 2 },
  { k: '3m', label: '3 bulan', m: 3 }, { k: '6m', label: '6 bulan', m: 6 },
  { k: '12m', label: '12 bulan', m: 12 }, { k: 'custom', label: 'Custom (hari)' },
]
export const calcExpiry = (start, key, customDays) => {
  if (!start) return ''
  const o = DURATIONS.find((x) => x.k === key)
  if (key === 'custom') return addDays(start, Math.max(1, Number(customDays) || 1))
  return o.m ? addMonths(start, o.m) : addDays(start, o.d)
}

export const daysLeft = (exp) => Math.round((parse(exp) - parse(todayStr())) / 864e5)
export const fmtDate = (s) => parse(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// 0812-3456-7890 / +62 812... / 62812... -> 628123456789
export const normPhone = (raw) => {
  let p = String(raw).replace(/\D/g, '')
  if (p.startsWith('0')) p = '62' + p.slice(1)
  else if (p.startsWith('8')) p = '62' + p
  return p
}
export const waLink = (phone, app, exp) => {
  const msg = `Haii kak! ♡ Mau infoin kalau masa aktif ${app} kakak akan berakhir tanggal ${fmtDate(exp)}. Kalau mau lanjut renew, boleh langsung kabarin aku yaa. Thank you! 🎀`
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}

// Badge reminder: H-3, H-1, Hari H, Expired
export const reminderBadge = (days) => {
  if (days < 0) return { t: `Expired ${-days} hari lalu`, c: 'b-exp' }
  if (days === 0) return { t: 'Hari H expired!', c: 'b-h0' }
  if (days === 1) return { t: 'H-1', c: 'b-h1' }
  if (days <= 3) return { t: `H-${days}`, c: 'b-h3' }
  return { t: `${days} hari lagi`, c: 'b-ok' }
}
