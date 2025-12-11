/*
SISTEMA DE INVITADOS - Single-file React app (App.jsx)

Fixes applied in this version:
- Avoids top-level import/initialization of Supabase which caused runtime errors like "Cannot read properties of null (reading 'AuthClient')" in some environments.
  Instead, Supabase is imported dynamically at runtime only if environment variables are provided. This prevents bundlers or environments that initialize Supabase too early from throwing.
- All uses of Supabase are guarded behind a runtime availability check.
- Improved defensive checks around camera/QR reader usage and session checks.
- Kept the original structure (Login, Dashboard, Scanner, Tarjetas) and the admin credentials provided by the user.

NOTES / INSTRUCTIONS:
- Install dependencies as before if you want Supabase and QR scanning to work:
  npm install react-router-dom react-qr-code react-qr-reader html2canvas jspdf qrcode
- If you want Supabase, create a .env with:
  REACT_APP_SUPABASE_URL=your_supabase_url
  REACT_APP_SUPABASE_ANON_KEY=your_anon_key

This file will run without Supabase configured (it falls back to localStorage). If Supabase is configured it will attempt to load it dynamically.
*/

import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { QrReader } from 'react-qr-reader';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ---------- CONFIG (env-safe) ----------
const SUPABASE_URL = typeof process !== 'undefined' ? process.env.REACT_APP_SUPABASE_URL || '' : '';
const SUPABASE_KEY = typeof process !== 'undefined' ? process.env.REACT_APP_SUPABASE_ANON_KEY || '' : '';
let supabaseClient = null; // will be initialized dynamically

const ADMIN_USER = 'jesusandia124';
const ADMIN_PASS = 'andia124';

const COLORS = {
  primary: 'bg-[#0A0A0A]',
  gold: 'text-[#D4AF37]',
  bg: 'bg-[#F8FAFC]',
  accents: 'text-[#64748B]'
};

const uid = () => 'id_' + Math.random().toString(36).slice(2, 9);

// Local storage fallback
const LOCAL_KEY = 'invitados_sistema_v1';
const loadLocal = () => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (e) { return []; }
};
const saveLocal = (arr) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(arr)); } catch (e) { console.error(e); } };

// Seed example
if (typeof window !== 'undefined' && loadLocal().length === 0) {
  const sample = [
    { id: uid(), nombre_completo: 'Jesús Andres Andía Zambrano', tipo_invitado: 'PROMOCIONADO', qr_code: '', ingresado: false, fecha_ingreso: null, dni: '00000001' },
    { id: uid(), nombre_completo: 'Andres Sanchez Valentin', tipo_invitado: 'INVITADO', qr_code: '', ingresado: false, fecha_ingreso: null, dni: '00000002' }
  ];
  saveLocal(sample);
}

// ---------- Helper to know if Supabase available ----------
function isSupabaseConfigured() {
  return SUPABASE_URL && SUPABASE_KEY && supabaseClient;
}

async function initSupabaseIfNeeded() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (supabaseClient) return supabaseClient;
  try {
    // dynamic import to avoid top-level initialization issues
    const mod = await import('@supabase/supabase-js');
    if (mod && mod.createClient) {
      supabaseClient = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
      return supabaseClient;
    }
  } catch (e) {
    console.warn('Supabase dynamic import failed or not installed. Falling back to localStorage. Details:', e);
    supabaseClient = null;
    return null;
  }
  return null;
}

// ---------- Main App ----------
function App() {
  const [supReady, setSupReady] = useState(false);

  useEffect(() => {
    // attempt to init supabase in background; harmless if fails
    initSupabaseIfNeeded().then(client => {
      setSupReady(!!client);
    });
  }, []);

  return (
    <Router>
      <div className={`${COLORS.bg} min-h-screen font-inter`}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/scanner" element={<Protected><Scanner /></Protected>} />
          <Route path="/tarjetas" element={<Protected><Tarjetas /></Protected>} />
        </Routes>
      </div>
    </Router>
  );
}

// ---------- Auth Utilities ----------
function useAuth() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('admin_user') || 'null'); } catch { return null; }
  });
  const login = (u, p) => {
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      const admin = { username: u };
      try { sessionStorage.setItem('admin_user', JSON.stringify(admin)); } catch (e) {}
      setUser(admin);
      return true;
    }
    return false;
  };
  const logout = () => {
    try { sessionStorage.removeItem('admin_user'); } catch (e) {}
    setUser(null);
  };
  return { user, login, logout };
}

function Protected({ children }) {
  const navigate = useNavigate();
  useEffect(() => {
    const sessionUser = (() => { try { return JSON.parse(sessionStorage.getItem('admin_user') || 'null'); } catch { return null; } })();
    if (!sessionUser) navigate('/');
  }, [navigate]);
  return children;
}

// ---------- Pages ----------
function Login() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const sessionUser = (() => { try { return JSON.parse(sessionStorage.getItem('admin_user') || 'null'); } catch { return null; } })();
    if (sessionUser) navigate('/dashboard');
  }, [navigate]);

  const handle = (e) => {
    e.preventDefault();
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      try { sessionStorage.setItem('admin_user', JSON.stringify({ username: u })); } catch (e) {}
      navigate('/dashboard');
    } else {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-full max-w-md p-8 rounded-2xl shadow-lg bg-white">
        <h1 className="text-2xl font-semibold mb-4">SISTEMA DE INVITADOS</h1>
        <p className="mb-6 text-sm text-gray-600">Ingresa con tu cuenta de administrador</p>
        <form onSubmit={handle}>
          <label className="block text-sm mb-1">Usuario</label>
          <input className="w-full p-2 border rounded mb-4" value={u} onChange={e => setU(e.target.value)} />
          <label className="block text-sm mb-1">Contraseña</label>
          <input type="password" className="w-full p-2 border rounded mb-4" value={p} onChange={e => setP(e.target.value)} />
          {error && <div className="text-red-500 mb-2">{error}</div>}
          <button className="w-full py-2 rounded bg-black text-white">Entrar</button>
        </form>
        <div className="mt-4 text-xs text-gray-500">Admin inicial: <strong>{ADMIN_USER}</strong></div>
      </div>
    </div>
  );
}

function Topbar({ title }) {
  const navigate = useNavigate();
  const logout = () => { try { sessionStorage.removeItem('admin_user'); } catch (e) {} ; navigate('/'); };
  return (
    <div className="flex items-center justify-between p-4 border-b bg-white">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-white font-bold">SI</div>
        <div>
          <div className="text-sm text-gray-500">SISTEMA DE INVITADOS</div>
          <div className="text-lg font-semibold">{title}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="text-sm">Dashboard</Link>
        <Link to="/scanner" className="text-sm">Scanner</Link>
        <Link to="/tarjetas" className="text-sm">Tarjetas</Link>
        <button className="text-sm text-red-600" onClick={logout}>Cerrar sesión</button>
      </div>
    </div>
  );
}

// ---------- Dashboard (lista invitados) ----------
function Dashboard() {
  const [invitados, setInvitados] = useState([]);
  const [q, setQ] = useState('');
  const [dniQ, setDniQ] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newTipo, setNewTipo] = useState('INVITADO');

  useEffect(() => { fetchInvitados(); }, []);

  async function fetchInvitados() {
    // prefer Supabase when available
    if (SUPABASE_URL && SUPABASE_KEY && supabaseClient) {
      try {
        const { data, error } = await supabaseClient.from('invitados').select('*').order('nombre_completo');
        if (error) {
          console.error(error);
          setInvitados(loadLocal());
        } else {
          setInvitados(data || []);
        }
      } catch (e) {
        console.warn('Supabase fetch failed, falling back to local:', e);
        setInvitados(loadLocal());
      }
    } else {
      setInvitados(loadLocal());
    }
  }

  const generarQR = async (inv) => {
    const qrPayload = JSON.stringify({ id: inv.id });
    if (SUPABASE_URL && SUPABASE_KEY && supabaseClient) {
      try { await supabaseClient.from('invitados').update({ qr_code: qrPayload }).eq('id', inv.id); await fetchInvitados(); } catch(e){ console.warn(e); }
    } else {
      const arr = loadLocal().map(item => item.id === inv.id ? { ...item, qr_code: qrPayload } : item);
      saveLocal(arr); fetchInvitados();
    }
  };

  const marcarIngreso = async (inv) => {
    const now = new Date().toISOString();
    if (SUPABASE_URL && SUPABASE_KEY && supabaseClient) {
      try { await supabaseClient.from('invitados').update({ ingresado: true, fecha_ingreso: now }).eq('id', inv.id); await fetchInvitados(); } catch(e){ console.warn(e); }
    } else {
      const arr = loadLocal().map(item => item.id === inv.id ? { ...item, ingresado: true, fecha_ingreso: now } : item);
      saveLocal(arr); fetchInvitados();
    }
  };

  const addInvitado = async () => {
    if (!newNombre.trim()) return;
    const item = { id: uid(), nombre_completo: newNombre.trim(), tipo_invitado: newTipo, qr_code: '', ingresado: false, fecha_ingreso: null, dni: dniQ || '' };
    if (SUPABASE_URL && SUPABASE_KEY && supabaseClient) {
      try { await supabaseClient.from('invitados').insert(item); await fetchInvitados(); } catch(e){ console.warn(e); }
    } else {
      const arr = loadLocal(); arr.push(item); saveLocal(arr); fetchInvitados();
    }
    setNewNombre(''); setDniQ('');
  };

  const search = invitados.filter(inv => {
    const term = q.toLowerCase();
    const matchName = inv.nombre_completo && inv.nombre_completo.toLowerCase().includes(term);
    const matchDni = inv.dni && inv.dni.includes(q);
    const byDni = dniQ ? inv.dni === dniQ : true;
    return (matchName || matchDni) && byDni;
  });

  return (
    <div>
      <Topbar title="Dashboard" />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2 bg-white p-4 rounded shadow">
            <div className="flex items-center gap-3 mb-4">
              <input placeholder="Buscar por nombre o DNI" className="flex-1 p-2 border rounded" value={q} onChange={e=>setQ(e.target.value)} />
              <input placeholder="Filtrar DNI" className="w-40 p-2 border rounded" value={dniQ} onChange={e=>setDniQ(e.target.value)} />
            </div>
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-left">
                <thead className="text-sm text-gray-500">
                  <tr><th>Nombre</th><th>Tipo</th><th>DNI</th><th>QR</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {search.map(inv => (
                    <tr key={inv.id} className="border-t">
                      <td className="py-2">{inv.nombre_completo}</td>
                      <td className="py-2">{inv.tipo_invitado}</td>
                      <td className="py-2">{inv.dni || '-'}</td>
                      <td className="py-2">{inv.qr_code ? 'Generado' : '—'}</td>
                      <td className="py-2">{inv.ingresado ? 'INGRESÓ' : 'PENDIENTE'}</td>
                      <td className="py-2">
                        <button className="mr-2 text-sm" onClick={()=>generarQR(inv)}>Generar QR</button>
                        <button className="mr-2 text-sm" onClick={()=>marcarIngreso(inv)}>Marcar ingreso</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Agregar invitado</h3>
            <input placeholder="Nombre completo" className="w-full p-2 border rounded mb-2" value={newNombre} onChange={e=>setNewNombre(e.target.value)} />
            <input placeholder="DNI (opcional)" className="w-full p-2 border rounded mb-2" value={dniQ} onChange={e=>setDniQ(e.target.value)} />
            <select className="w-full p-2 border rounded mb-2" value={newTipo} onChange={e=>setNewTipo(e.target.value)}>
              <option>INVITADO</option>
              <option>PROMOCIONADO</option>
            </select>
            <button className="w-full py-2 rounded bg-black text-white" onClick={addInvitado}>Añadir</button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ---------- Scanner page (wachiman) ----------
function Scanner() {
  const [result, setResult] = useState(null);
  const [invData, setInvData] = useState(null);
  const [message, setMessage] = useState('');
  const [invitados, setInvitados] = useState([]);

  useEffect(() => {
    (async () => {
      // ensure supabase dynamic import has been attempted
      await initSupabaseIfNeeded();
      if (SUPABASE_URL && SUPABASE_KEY && supabaseClient) {
        try { const { data } = await supabaseClient.from('invitados').select('*'); setInvitados(data || []); } catch(e){ console.warn(e); setInvitados(loadLocal()); }
      } else {
        setInvitados(loadLocal());
      }
    })();
  }, []);

  const handleScan = (data) => {
    if (!data) return;
    const raw = typeof data === 'string' ? data : (data?.text ? data.text : JSON.stringify(data));
    setResult(raw);
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && parsed.id) findInvitado(parsed.id);
      else setMessage('QR inválido');
    } catch (e) {
      setMessage('QR inválido');
    }
  };

  const findInvitado = (id) => {
    const inv = invitados.find(i => i.id === id);
    if (!inv) { setInvData(null); setMessage('Invitado no registrado'); return; }
    setInvData(inv);
    setMessage('');
  };

  const marcar = async () => {
    if (!invData) return;
    const now = new Date().toISOString();
    if (SUPABASE_URL && SUPABASE_KEY && supabaseClient) {
      try {
        await supabaseClient.from('invitados').update({ ingresado: true, fecha_ingreso: now }).eq('id', invData.id);
        setMessage('Ingreso registrado');
      } catch(e){ console.warn(e); setMessage('Error registrando ingreso'); }
    } else {
      const arr = loadLocal().map(item => item.id === invData.id ? { ...item, ingresado: true, fecha_ingreso: now } : item);
      saveLocal(arr); setInvitados(arr); setMessage('Ingreso registrado'); setInvData({...invData, ingresado:true, fecha_ingreso: now});
    }
  };

  return (
    <div>
      <Topbar title="Scanner - Modo Wachiman" />
      <div className="p-6 flex flex-col md:flex-row gap-6">
        <div className="flex-1 bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-2">Cámara (apunta al QR)</h3>
          <div className="w-full h-80 bg-gray-100 rounded overflow-hidden">
            {/* QrReader may not work in all environments (desktop without camera permission). We guard errors. */}
            <QrReader
              onResult={(result, error) => {
                if (!!result) handleScan(result?.text || result);
                if (!!error) { /* ignore transient scan errors */ }
              }}
              constraints={{ facingMode: 'environment' }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div className="mt-3 text-sm text-gray-600">Resultado raw: {result}</div>
        </div>

        <div className="w-full md:w-96 bg-white p-4 rounded shadow">
          <h3 className="font-semibold">Datos del invitado</h3>
          {message && <div className="text-red-600 my-2">{message}</div>}
          {invData ? (
            <div className="mt-2">
              <div className="text-sm text-gray-500">Tipo</div>
              <div className={`text-lg font-bold ${invData.tipo_invitado === 'PROMOCIONADO' ? 'text-yellow-600' : 'text-gray-700'}`}>{invData.tipo_invitado}</div>
              <div className="mt-2 text-xl">{invData.nombre_completo}</div>
              <div className="mt-2">Estado: {invData.ingresado ? 'Ya ingresó' : 'No ingresó'}</div>
              {!invData.ingresado && <button className="mt-4 w-full py-2 rounded bg-black text-white" onClick={marcar}>Marcar como ingresado</button>}
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-500">Escanea un QR válido para ver datos</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Tarjetas page ----------
function Tarjetas() {
  const [invitados, setInvitados] = useState([]);

  useEffect(()=>{
    (async ()=>{
      await initSupabaseIfNeeded();
      if (SUPABASE_URL && SUPABASE_KEY && supabaseClient) {
        try { const { data } = await supabaseClient.from('invitados').select('*'); setInvitados(data || []); } catch(e){ console.warn(e); setInvitados(loadLocal()); }
      } else setInvitados(loadLocal());
    })();
  }, []);

  const downloadCard = async (inv) => {
    const el = document.getElementById('card-' + inv.id);
    if (!el) return;
    try {
      const canvas = await html2canvas(el);
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a'); link.download = `${inv.nombre_completo.replace(/\s+/g,'_')}.png`; link.href = imgData; link.click();
    } catch (e) { console.error('Error generating PNG:', e); }
  };

  const downloadPDF = async (inv) => {
    const el = document.getElementById('card-' + inv.id);
    if (!el) return;
    try {
      const canvas = await html2canvas(el);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait' });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${inv.nombre_completo.replace(/\s+/g,'_')}.pdf`);
    } catch (e) { console.error('Error generating PDF:', e); }
  };

  return (
    <div>
      <Topbar title="Tarjetas" />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {invitados.map(inv => (
            <div key={inv.id} className="bg-white p-4 rounded shadow flex flex-col items-center">
              <div id={`card-${inv.id}`} className="w-64 h-96 p-4 rounded-2xl shadow-md flex flex-col justify-between items-center" style={{ background: inv.tipo_invitado === 'PROMOCIONADO' ? 'linear-gradient(180deg,#0A0A0A,#111827)' : '#0f172a', color: 'white', borderRadius: 20 }}>
                <div className="text-sm tracking-widest">{inv.tipo_invitado}</div>
                <div className="text-center text-xl font-bold mt-4">{inv.nombre_completo}</div>
                <div className="mb-2">
                  <QRCode value={inv.qr_code || JSON.stringify({ id: inv.id })} size={120} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="py-2 px-3 border rounded text-sm" onClick={()=>downloadCard(inv)}>Descargar PNG</button>
                <button className="py-2 px-3 border rounded text-sm" onClick={()=>downloadPDF(inv)}>Descargar PDF</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Render ----------
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
