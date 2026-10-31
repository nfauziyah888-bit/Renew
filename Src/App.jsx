import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { DURATIONS, calcExpiry, daysLeft, todayStr, fmtDate, waLink, normPhone, reminderBadge } from './utils'

const STATUS = { belum_diingatkan: 'Belum diingatkan', sudah_diingatkan: 'Sudah diingatkan', sudah_renew: 'Sudah renew', tidak_renew: 'Tidak renew' }

function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr('Email atau password salah'); setBusy(false)
  }
  return (
    <div className="wrap narrow">
      <form className="card" onSubmit={submit}>
        <h1>🎀 Purple Store</h1><p className="muted">Renewal Reminder — login admin</p>
        <input type="email" placeholder="Email admin" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Masuk…' : 'Masuk'}</button>
      </form>
    </div>
  )
}

function Form({ mode, row, apps, onClose, onDone }) {
  const renew = mode === 'renew'
  const [phone, setPhone] = useState(renew ? row.customers.phone : '')
  const [app, setApp] = useState(renew ? row.app_name : '')
  const [start, setStart] = useState(renew ? (row.expires_on > todayStr() ? row.expires_on : todayStr()) : todayStr())
  const [dur, setDur] = useState('1m'), [custom, setCustom] = useState(30)
  const [exp, setExp] = useState(''), [note, setNote] = useState(renew ? row.note || '' : '')
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  useEffect(() => { setExp(calcExpiry(start, dur, custom)) }, [start, dur, custom])

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    const p = normPhone(phone)
    if (p.length < 10) return setErr('Nomor WhatsApp belum benar')
    if (!app.trim()) return setErr('Nama aplikasi wajib diisi')
    if (!exp || exp < start) return setErr('Tanggal expired harus setelah tanggal mulai')
    setBusy(true)
    let error
    if (renew) {
      ({ error } = await supabase.from('renewals').insert({ subscription_id: row.id, old_start: row.start_date, old_expires: row.expires_on, new_start: start, new_expires: exp }))
      if (!error) ({ error } = await supabase.from('subscriptions').update({ start_date: start, expires_on: exp, status: 'belum_diingatkan', note: note || null }).eq('id', row.id))
    } else {
      let { data: c } = await supabase.from('customers').select('id').eq('phone', p).maybeSingle()
      if (!c) { const r = await supabase.from('customers').insert({ phone: p }).select('id').single(); error = r.error; c = r.data }
      if (!error) ({ error } = await supabase.from('subscriptions').insert({ customer_id: c.id, app_name: app.trim(), start_date: start, expires_on: exp, note: note || null }))
    }
    setBusy(false)
    if (error) return setErr(error.message)
    onDone()
  }
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{renew ? `🔄 Renew ${row.app_name}` : '✨ Tambah langganan'}</h2>
        <label>Nomor WhatsApp *<input inputMode="tel" placeholder="0812xxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={renew} /></label>
        <label>Nama aplikasi *<input list="apps" placeholder="Ketik nama aplikasi" value={app} onChange={(e) => setApp(e.target.value)} disabled={renew} /></label>
        <datalist id="apps">{apps.map((a) => <option key={a} value={a} />)}</datalist>
        <label>Tanggal mulai<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>Durasi<select value={dur} onChange={(e) => setDur(e.target.value)}>{DURATIONS.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}</select></label>
        {dur === 'custom' && <label>Jumlah hari<input type="number" min="1" value={custom} onChange={(e) => setCustom(e.target.value)} /></label>}
        <label>Tanggal expired (otomatis, boleh diedit)<input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></label>
        <label>Catatan (opsional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {err && <p className="err">{err}</p>}
        <div className="row"><button type="button" className="btn ghost" onClick={onClose}>Batal</button><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
      </form>
    </div>
  )
}

function Dashboard() {
  const [rows, setRows] = useState(null), [ren, setRen] = useState([]), [err, setErr] = useState('')
  const [q, setQ] = useState(''), [fs, setFs] = useState('all'), [fm, setFm] = useState('')
  const [modal, setModal] = useState(null)

  const load = useCallback(async () => {
    const a = await supabase.from('subscriptions').select('*, customers(phone)').order('expires_on')
    const b = await supabase.from('renewals').select('id, created_at')
    if (a.error) setErr(a.error.message); else { setRows(a.data); setErr('') }
    if (b.data) setRen(b.data)
  }, [])
  useEffect(() => { load() }, [load])

  const live = (r) => r.status !== 'tidak_renew'
  const stats = useMemo(() => {
    const rs = rows || [], m = todayStr().slice(0, 7)
    return {
      aktif: rs.filter((r) => live(r) && daysLeft(r.expires_on) >= 0).length,
      segera: rs.filter((r) => live(r) && daysLeft(r.expires_on) >= 0 && daysLeft(r.expires_on) <= 3).length,
      expired: rs.filter((r) => live(r) && daysLeft(r.expires_on) < 0).length,
      renew: ren.filter((x) => x.created_at.slice(0, 7) === m).length,
    }
  }, [rows, ren])

  const shown = useMemo(() => (rows || []).filter((r) => {
    const d = daysLeft(r.expires_on), t = q.trim().toLowerCase(), digits = t.replace(/\D/g, '')
    if (t && !((digits && r.customers.phone.includes(digits)) || r.app_name.toLowerCase().includes(t))) return false
    if (fm && r.expires_on.slice(0, 7) !== fm) return false
    if (fs === 'aktif') return live(r) && d >= 0
    if (fs === 'segera') return live(r) && d >= 0 && d <= 3
    if (fs === 'expired') return live(r) && d < 0
    if (fs !== 'all') return r.status === fs
    return true
  }), [rows, q, fs, fm])

  const setStatus = async (r, status) => { await supabase.from('subscriptions').update({ status }).eq('id', r.id); load() }
  const apps = [...new Set((rows || []).map((r) => r.app_name))]

  return (
    <div className="wrap">
      <header><h1>🎀 Purple Store</h1><button className="btn ghost sm" onClick={() => supabase.auth.signOut()}>Keluar</button></header>
      <div className="stats">
        <div className="card s1"><b>{stats.aktif}</b><span>Customer aktif</span></div>
        <div className="card s2"><b>{stats.segera}</b><span>Segera expired</span></div>
        <div className="card s3"><b>{stats.expired}</b><span>Expired</span></div>
        <div className="card s4"><b>{stats.renew}</b><span>Renew bulan ini</span></div>
      </div>
      <div className="card filters">
        <input placeholder="🔍 Cari nomor HP atau aplikasi" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          <select value={fs} onChange={(e) => setFs(e.target.value)}>
            <option value="all">Semua status</option><option value="aktif">Aktif</option><option value="segera">Segera expired</option><option value="expired">Expired</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="month" value={fm} onChange={(e) => setFm(e.target.value)} title="Bulan expired" />
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {rows === null && !err && <p className="muted center">Memuat…</p>}
      {rows && shown.length === 0 && <p className="muted center">{rows.length ? 'Tidak ada hasil.' : 'Belum ada langganan. Tekan + untuk menambah ✨'}</p>}
      {shown.map((r) => {
        const d = daysLeft(r.expires_on), b = reminderBadge(d)
        return (
          <div className="card item" key={r.id}>
            <div className="top"><div><b>{r.app_name}</b><div className="muted">+{r.customers.phone}</div></div><span className={`badge ${b.c}`}>{b.t}</span></div>
            <div className="muted">Expired: {fmtDate(r.expires_on)}{r.note ? ` · ${r.note}` : ''}</div>
            <select value={r.status} onChange={(e) => setStatus(r, e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <div className="row">
              <a className="btn wa" target="_blank" rel="noreferrer" href={waLink(r.customers.phone, r.app_name, r.expires_on)} onClick={() => r.status === 'belum_diingatkan' && setStatus(r, 'sudah_diingatkan')}>💬 Remind via WhatsApp</a>
              <button className="btn ghost" onClick={() => setModal({ mode: 'renew', row: r })}>🔄 Renew</button>
            </div>
          </div>
        )
      })}
      <button className="fab" onClick={() => setModal({ mode: 'add' })} aria-label="Tambah">+</button>
      {modal && <Form {...modal} apps={apps} onClose={() => setModal(null)} onDone={() => { setModal(null); load() }} />}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <p className="muted center">Memuat…</p>
  return session ? <Dashboard /> : <Login />
}
