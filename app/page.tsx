"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, X, Construction, Calculator, FileSpreadsheet, LayoutDashboard, Users, Lock, LogOut, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_SIFRE = "1954"; 

export default function PuantajYonetim() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginSifre, setLoginSifre] = useState('');
  const [error, setError] = useState(false);

  const [alanlar, setAlanlar] = useState<any[]>([]);
  const [ustalar, setUstalar] = useState<any[]>([]);
  const [puantajlar, setPuantajlar] = useState<any[]>([]);
  const [aktifAlan, setAktifAlan] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  
  const [showAlanModal, setShowAlanModal] = useState(false);
  const [showUstaModal, setShowUstaModal] = useState(false);
  const [showSifreModal, setShowSifreModal] = useState<{tip: 'tekil' | 'genel'} | null>(null);
  const [sifreInput, setSifreInput] = useState('');
  const [seciliDetay, setSeciliDetay] = useState<{usta: string, gun: number} | null>(null);
  const [notInput, setNotInput] = useState('');

  const bugun = new Date();
  const yil = bugun.getFullYear();
  const ay = bugun.getMonth() + 1;
  const gunSayisi = new Date(yil, ay, 0).getDate();
  const gunler = Array.from({ length: gunSayisi }, (_, i) => i + 1);

  useEffect(() => {
    setMounted(true);
    // Sayfa yenilendiğinde giriş durumunu kontrol et (isteğe bağlı localStorage eklenebilir)
    if (isLoggedIn) {
      verileriGetir();
      const kanal = supabase.channel('pano_takip')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'puantaj' }, () => syncVeri())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ustalar' }, () => syncVeri())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alanlar' }, () => syncVeri())
        .subscribe();
      return () => { supabase.removeChannel(kanal); };
    }
  }, [isLoggedIn]);

  const handleLogin = () => {
    if (loginSifre === ADMIN_SIFRE) {
      setIsLoggedIn(true);
      setError(false);
    } else {
      setError(true);
      setLoginSifre('');
      setTimeout(() => setError(false), 2000);
    }
  };

  async function verileriGetir() {
    const { data: a } = await supabase.from('alanlar').select('*').order('ad');
    const { data: u } = await supabase.from('ustalar').select('*').order('ad');
    const { data: p } = await supabase.from('puantaj').select('*').match({ yil, ay });
    if (a) setAlanlar(a);
    if (u) setUstalar(u);
    if (p) setPuantajlar(p);
    if (a && a.length > 0 && !aktifAlan) setAktifAlan(a[0].ad);
  }

  async function syncVeri() {
    const { data: p } = await supabase.from('puantaj').select('*').match({ yil, ay });
    const { data: u } = await supabase.from('ustalar').select('*');
    const { data: a } = await supabase.from('alanlar').select('*');
    if (p) setPuantajlar(p);
    if (u) setUstalar(u);
    if (a) setAlanlar(a);
  }

  // ... (Diğer fonksiyonlar: alanEkle, ustaEkle, puantajKaydet, excelIndir aynı kaldı)
  async function alanEkle() {
    if (!yeniAlanAd.trim()) return;
    await supabase.from('alanlar').insert([{ ad: yeniAlanAd.trim() }]);
    setYeniAlanAd(''); setShowAlanModal(false);
  }
  async function ustaEkle() {
    if (!yeniUstaAd.trim()) return;
    await supabase.from('ustalar').insert([{ ad: yeniUstaAd.trim(), alan: aktifAlan }]);
    setYeniUstaAd(''); setShowUstaModal(false);
  }
  async function puantajKaydet(mesai: string) {
    if (!seciliDetay) return;
    if (mesai === 'sil') {
      await supabase.from('puantaj').delete().match({ usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun });
    } else {
      await supabase.from('puantaj').upsert({ usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun, mesai, not_: notInput });
    }
    setSeciliDetay(null); setNotInput('');
  }
  const sifreOnayla = () => {
    if (sifreInput === ADMIN_SIFRE) {
      if (showSifreModal?.tip === 'tekil') excelIndir();
      else if (showSifreModal?.tip === 'genel') genelRaporIndir();
      setShowSifreModal(null); setSifreInput('');
    } else { alert("Hatalı!"); setSifreInput(''); }
  };
  const excelIndir = () => {
    const aktifUstaListesi = ustalar.filter(u => u.alan === aktifAlan);
    const excelVerisi = aktifUstaListesi.map(usta => {
      const pList = puantajlar.filter(p => p.usta === usta.ad && p.alan === aktifAlan);
      const tam = pList.filter(p => p.mesai === 'tam').length;
      const yarim = pList.filter(p => p.mesai === 'yarim').length;
      return { "USTA": usta.ad, "TAM": tam, "YARIM": yarim, "TOPLAM": tam + (yarim * 0.5) };
    });
    const ws = XLSX.utils.json_to_sheet(excelVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `${aktifAlan}_Puantaj.xlsx`);
  };
  const genelRaporIndir = () => {
    const genelVeri = alanlar.map(alan => {
      const p = puantajlar.filter(px => px.alan === alan.ad);
      return { "ŞANTİYE": alan.ad, "USTA": ustalar.filter(u => u.alan === alan.ad).length, "GÜN": p.filter(x => x.mesai === 'tam').length + (p.filter(x => x.mesai === 'yarim').length * 0.5) };
    });
    const ws = XLSX.utils.json_to_sheet(genelVeri);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Genel");
    XLSX.writeFile(wb, `Genel_Rapor.xlsx`);
  };

  const [yeniAlanAd, setYeniAlanAd] = useState('');
  const [yeniUstaAd, setYeniUstaAd] = useState('');

  if (!mounted) return null;

  // GİRİŞ EKRANI (LOGIN VIEW)
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#02040a] flex items-center justify-center p-6">
        <div className={`w-full max-w-md bg-[#0b101d] p-12 rounded-[3rem] border ${error ? 'border-red-500 shadow-red-900/20' : 'border-slate-800'} shadow-2xl transition-all duration-500`}>
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-12">
              <ShieldCheck size={40}/>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter mb-2 italic">ŞANTİYE TAKİP</h1>
            <p className="text-slate-500 text-[10px] tracking-[0.3em] uppercase">Sisteme Giriş Yapın</p>
          </div>
          
          <div className="space-y-6">
            <div className="relative">
              <input 
                type="password" 
                autoFocus
                placeholder="GİRİŞ ŞİFRESİ"
                className="w-full bg-[#161b2c] border border-slate-700 p-6 rounded-2xl text-white text-center font-black tracking-[1em] text-xl outline-none focus:border-blue-500 transition-all"
                value={loginSifre}
                onChange={(e) => setLoginSifre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button 
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 p-6 rounded-2xl text-white font-black text-lg transition-all active:scale-95 shadow-xl shadow-blue-900/20"
            >
              GİRİŞ YAP
            </button>
          </div>
          {error && <p className="text-red-500 text-center mt-6 font-bold animate-bounce text-[10px] tracking-widest">HATALI ŞİFRE! TEKRAR DENEYİN.</p>}
        </div>
      </main>
    );
  }

  // ANA PANO (DASHBOARD VIEW)
  return (
    <main className="min-h-screen bg-[#02040a] text-slate-300 p-6 font-sans uppercase text-[11px]">
      <div className="max-w-[1800px] mx-auto space-y-8">
        
        {/* Üst Bar / Çıkış Butonu Eklendi */}
        <div className="flex justify-between items-center bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50">
           <div className="flex items-center gap-3 ml-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-black tracking-widest text-slate-500 italic">SİSTEM ÇEVRİMİÇİ / OTURUM AÇIK</span>
           </div>
           <button onClick={() => setIsLoggedIn(false)} className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-6 py-2 rounded-xl font-black transition-all flex items-center gap-2">
              ÇIKIŞ YAP <LogOut size={16}/>
           </button>
        </div>

        {/* Üst Kartlar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800/50 flex items-center gap-6 shadow-2xl">
            <div className="bg-blue-600/10 p-4 rounded-2xl text-blue-500"><LayoutDashboard size={28}/></div>
            <div><p className="text-slate-500 text-[10px] mb-1">TOPLAM ŞANTİYE</p><p className="text-3xl font-black text-white">{alanlar.length}</p></div>
          </div>
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800/50 flex items-center gap-6 shadow-2xl">
            <div className="bg-green-600/10 p-4 rounded-2xl text-green-500"><Users size={28}/></div>
            <div><p className="text-slate-500 text-[10px] mb-1">AKTİF USTA</p><p className="text-3xl font-black text-white">{ustalar.length}</p></div>
          </div>
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800/50 flex items-center gap-6 shadow-2xl">
            <div className="bg-purple-600/10 p-4 rounded-2xl text-purple-500"><Calculator size={28}/></div>
            <div><p className="text-slate-500 text-[10px] mb-1">AYLIK TOPLAM GÜN</p><p className="text-3xl font-black text-white">{puantajlar.filter(p => p.mesai === 'tam').length + (puantajlar.filter(p => p.mesai === 'yarim').length * 0.5)}</p></div>
          </div>
          <button onClick={() => setShowSifreModal({tip: 'genel'})} className="bg-[#8b2cf5] hover:bg-[#7a23e0] p-8 rounded-[2rem] flex items-center justify-center gap-4 text-white font-black transition-all shadow-xl shadow-purple-900/20">
            <Lock size={24}/> GENEL RAPOR (EXCEL)
          </button>
        </div>

        {/* Şantiye Seçici */}
        <div className="flex items-center gap-4 bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50">
          <Construction className="text-blue-500 ml-4" size={24} />
          <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {alanlar.map(alan => (
              <button key={alan.id} onClick={() => setAktifAlan(alan.ad)} className={`px-8 py-3 rounded-2xl font-black transition-all ${aktifAlan === alan.ad ? "bg-blue-600 text-white shadow-lg" : "bg-[#161b2c] text-slate-500 hover:bg-slate-800"}`}>{alan.ad}</button>
            ))}
          </div>
          <button onClick={() => setShowAlanModal(true)} className="p-3 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-2xl ml-auto mr-4 hover:bg-blue-600 hover:text-white transition-all"><Plus size={24}/></button>
        </div>

        {/* Çizelge */}
        <div className="bg-[#0b101d] rounded-[2.5rem] border border-slate-800/50 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-slate-800/50 flex justify-between items-center">
            <h2 className="text-2xl font-black text-white italic tracking-tighter">{aktifAlan} <span className="text-blue-500 font-normal opacity-40">/ GÜNLÜK ÇİZELGE</span></h2>
            <div className="flex gap-4">
              <button onClick={() => setShowSifreModal({tip: 'tekil'})} className="bg-[#00c853] hover:bg-[#00a844] text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all"><FileSpreadsheet size={20}/> BU ŞANTİYEYİ İNDİR</button>
              <button onClick={() => setShowUstaModal(true)} className="bg-[#2979ff] hover:bg-[#1565c0] text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all"><Plus size={20}/> USTA EKLE</button>
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="bg-[#02040a]">
                  <th className="p-6 text-left border-r border-slate-800 sticky left-0 bg-[#0b101d] z-10 w-48 text-slate-500 font-black">USTALAR</th>
                  {gunler.map(g => <th key={g} className="p-4 border-r border-slate-800/50 text-center text-slate-500 font-black min-w-[50px]">{g}</th>)}
                </tr>
              </thead>
              <tbody>
                {ustalar.filter(u => u.alan === aktifAlan).map(usta => (
                  <tr key={usta.id} className="border-t border-slate-800/50 hover:bg-white/[0.02] transition-all">
                    <td className="p-6 font-black sticky left-0 bg-[#0b101d] border-r border-slate-800 text-slate-200 z-10">{usta.ad}</td>
                    {gunler.map(g => {
                      const p = puantajlar.find(px => px.usta === usta.ad && px.gun === g && px.alan === aktifAlan);
                      return (
                        <td key={g} className="p-2 border-r border-slate-800/30">
                          <button onClick={() => setSeciliDetay({ usta: usta.ad, gun: g })} className={`w-12 h-12 mx-auto rounded-xl border-2 flex items-center justify-center transition-all ${!p ? "border-slate-800/50 hover:border-slate-600" : p.mesai === 'tam' ? "bg-[#00c853] border-[#00e676] text-white shadow-lg" : "bg-[#ffab00] border-[#ffc400] text-white shadow-lg"}`}>
                            {p?.mesai === 'tam' ? <Check size={20}/> : p?.mesai === 'yarim' ? "1/2" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODALLAR (Şifre, Puantaj Seçim, Ekleme Modalları Aynı Tasarımla Devam) */}
      {showSifreModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-xl">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-sm border border-slate-700 shadow-2xl text-center">
            <Lock className="mx-auto mb-6 text-blue-500" size={40}/>
            <h2 className="text-2xl font-black text-white mb-6 uppercase">YETKİ KONTROLÜ</h2>
            <input type="password" autoFocus className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white text-center font-black tracking-[1em] outline-none" value={sifreInput} onChange={e => setSifreInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sifreOnayla()}/>
            <button onClick={sifreOnayla} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white">ONAYLA</button>
          </div>
        </div>
      )}

      {seciliDetay && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-md">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-md border border-slate-700 shadow-2xl">
            <h3 className="text-3xl font-black text-white mb-8 italic">{seciliDetay.usta}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={() => puantajKaydet('tam')} className="bg-[#00c853] p-8 rounded-[2rem] font-black text-white">TAM GÜN</button>
              <button onClick={() => puantajKaydet('yarim')} className="bg-[#ffab00] p-8 rounded-[2rem] font-black text-white">YARIM GÜN</button>
            </div>
            <button onClick={() => puantajKaydet('sil')} className="w-full bg-red-600/10 text-red-500 p-4 rounded-2xl font-black mb-4">KAYDI SİL</button>
            <button onClick={() => setSeciliDetay(null)} className="w-full text-slate-500 font-black">KAPAT</button>
          </div>
        </div>
      )}

      {/* Şantiye/Usta Modalları */}
      {showAlanModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-black text-white mb-6 italic">YENİ ŞANTİYE</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black" placeholder="İsim..." value={yeniAlanAd} onChange={e => setYeniAlanAd(e.target.value)} />
            <button onClick={alanEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white">OLUŞTUR</button>
          </div>
        </div>
      )}

      {showUstaModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-black text-white mb-6 italic">USTA KAYDI</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black" placeholder="Ad Soyad..." value={yeniUstaAd} onChange={e => setYeniUstaAd(e.target.value)} />
            <button onClick={ustaEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white">KAYDET</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { bg: #161b2c; border-radius: 10px; }
      `}</style>
    </main>
  );
}