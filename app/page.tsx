"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, Construction, Calculator, FileSpreadsheet, LayoutDashboard, Users, Lock, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_SIFRE = "1881"; 
const RAPOR_SIFRE = "1954"; 

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

  const bugun = new Date();
  const yil = bugun.getFullYear();
  const ay = bugun.getMonth() + 1;
  const gunSayisi = new Date(yil, ay, 0).getDate();
  const gunler = Array.from({ length: gunSayisi }, (_, i) => i + 1);

  useEffect(() => {
    setMounted(true);
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

  async function alanSil() {
    if (!aktifAlan) return;
    if (confirm(`${aktifAlan} şantiyesini silmek istediğinize emin misiniz?`)) {
      await supabase.from('puantaj').delete().match({ alan: aktifAlan });
      await supabase.from('ustalar').delete().match({ alan: aktifAlan });
      await supabase.from('alanlar').delete().match({ ad: aktifAlan });
      setAktifAlan('');
      verileriGetir();
    }
  }

  async function ustaSil(ustaAd: string) {
    if (confirm(`${ustaAd} ustasını silmek istediğinize emin misiniz?`)) {
      await supabase.from('puantaj').delete().match({ usta: ustaAd, alan: aktifAlan });
      await supabase.from('ustalar').delete().match({ ad: ustaAd, alan: aktifAlan });
      syncVeri();
    }
  }

  async function puantajKaydet(mesai: string) {
    if (!seciliDetay) return;
    if (mesai === 'sil') {
      await supabase.from('puantaj').delete().match({ usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun });
    } else {
      await supabase.from('puantaj').upsert({ usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun, mesai });
    }
    setSeciliDetay(null);
  }

  const sifreOnayla = () => {
    if (sifreInput === RAPOR_SIFRE) {
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
      return { "ŞANTİYE": aktifAlan, "USTA ADI": usta.ad, "TAM GÜN": tam, "YARIM GÜN": yarim, "TOPLAM GÜN": tam + (yarim * 0.5), "YEVMİYE": 0, "HAKEDİŞ": 0 };
    });
    const ws = XLSX.utils.json_to_sheet(excelVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `${aktifAlan}_Hakedis.xlsx`);
  };

  const genelRaporIndir = () => {
    const genelVeri = alanlar.map(alan => {
      const p = puantajlar.filter(px => px.alan === alan.ad);
      return { "ŞANTİYE": alan.ad, "USTA SAYISI": ustalar.filter(u => u.alan === alan.ad).length, "TOPLAM GÜN": p.filter(x => x.mesai === 'tam').length + (p.filter(x => x.mesai === 'yarim').length * 0.5) };
    });
    const ws = XLSX.utils.json_to_sheet(genelVeri);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Genel");
    XLSX.writeFile(wb, `Genel_Rapor.xlsx`);
  };

  const [yeniAlanAd, setYeniAlanAd] = useState('');
  const [yeniUstaAd, setYeniUstaAd] = useState('');

  if (!mounted) return null;

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#02040a] flex items-center justify-center p-6">
        <div className={`w-full max-w-md bg-[#0b101d] p-12 rounded-[3rem] border ${error ? 'border-red-500' : 'border-slate-800'} shadow-2xl`}>
          <div className="text-center mb-10">
            <ShieldCheck size={40} className="mx-auto mb-6 text-blue-500"/>
            <h1 className="text-3xl font-black text-white italic uppercase">ŞANTİYE TAKİP</h1>
          </div>
          <div className="space-y-6">
            <input type="password" autoFocus placeholder="ŞİFRE" className="w-full bg-[#161b2c] border border-slate-700 p-6 rounded-2xl text-white text-center font-black" value={loginSifre} onChange={(e) => setLoginSifre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()}/>
            <button onClick={handleLogin} className="w-full bg-blue-600 p-6 rounded-2xl text-white font-black hover:bg-blue-500">GİRİŞ YAP</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#02040a] text-slate-300 p-6 font-sans uppercase text-[11px]">
      <div className="max-w-[1800px] mx-auto space-y-8">
        <div className="flex justify-between items-center bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50 text-[9px] font-black">
           <span className="ml-4 text-slate-500 italic">SİSTEM ÇEVRİMİÇİ</span>
           <button onClick={() => setIsLoggedIn(false)} className="bg-red-600/10 text-red-500 px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-red-600 hover:text-white transition-all">ÇIKIŞ YAP <LogOut size={16}/></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800/50 flex items-center gap-6 shadow-2xl">
            <LayoutDashboard size={28} className="text-blue-500"/>
            <div><p className="text-slate-500 text-[10px]">ŞANTİYE</p><p className="text-3xl font-black text-white">{alanlar.length}</p></div>
          </div>
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800/50 flex items-center gap-6 shadow-2xl">
            <Users size={28} className="text-green-500"/>
            <div><p className="text-slate-500 text-[10px]">USTA</p><p className="text-3xl font-black text-white">{ustalar.length}</p></div>
          </div>
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800/50 flex items-center gap-6 shadow-2xl">
            <Calculator size={28} className="text-purple-500"/>
            <div><p className="text-slate-500 text-[10px]">AYLIK GÜN</p><p className="text-3xl font-black text-white">{puantajlar.filter(p => p.mesai === 'tam').length + (puantajlar.filter(p => p.mesai === 'yarim').length * 0.5)}</p></div>
          </div>
          <button onClick={() => setShowSifreModal({tip: 'genel'})} className="bg-purple-600 p-8 rounded-[2rem] flex items-center justify-center gap-4 text-white font-black hover:bg-purple-500 transition-all">
            <Lock size={24}/> GENEL RAPOR
          </button>
        </div>

        <div className="flex items-center gap-4 bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50 overflow-x-auto">
          <Construction className="text-blue-500 ml-4" size={24} />
          {alanlar.map(alan => (
            <button key={alan.id} onClick={() => setAktifAlan(alan.ad)} className={`px-8 py-3 rounded-2xl font-black whitespace-nowrap transition-all ${aktifAlan === alan.ad ? "bg-blue-600 text-white" : "bg-[#161b2c] text-slate-500 hover:bg-slate-800"}`}>{alan.ad}</button>
          ))}
          <div className="ml-auto flex gap-2 mr-4">
            {aktifAlan && <button onClick={alanSil} className="p-3 bg-red-600/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={24}/></button>}
            <button onClick={() => setShowAlanModal(true)} className="p-3 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-2xl hover:bg-blue-600 hover:text-white transition-all"><Plus size={24}/></button>
          </div>
        </div>

        <div className="bg-[#0b101d] rounded-[2.5rem] border border-slate-800/50 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-slate-800/50 flex flex-wrap gap-4 justify-between items-center">
            <h2 className="text-2xl font-black text-white italic">{aktifAlan} <span className="text-blue-500 font-normal opacity-40">/ ÇİZELGE</span></h2>
            <div className="flex gap-4">
              <button onClick={() => setShowSifreModal({tip: 'tekil'})} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-green-500"><FileSpreadsheet size={20}/> İNDİR</button>
              <button onClick={() => setShowUstaModal(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-blue-500"><Plus size={20}/> USTA EKLE</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#02040a]">
                  <th className="p-6 text-left sticky left-0 bg-[#0b101d] z-10 w-64 text-slate-500">USTALAR</th>
                  {gunler.map(g => <th key={g} className="p-4 text-center text-slate-500 min-w-[50px]">{g}</th>)}
                </tr>
              </thead>
              <tbody>
                {ustalar.filter(u => u.alan === aktifAlan).map(usta => (
                  <tr key={usta.id} className="border-t border-slate-800/50 group hover:bg-white/[0.02]">
                    <td className="p-6 font-black sticky left-0 bg-[#0b101d] text-slate-200 z-10 flex items-center justify-between">
                        <span>{usta.ad}</span>
                        <button onClick={() => ustaSil(usta.ad)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110 transition-all"><Trash2 size={16}/></button>
                    </td>
                    {gunler.map(g => {
                      const p = puantajlar.find(px => px.usta === usta.ad && px.gun === g && px.alan === aktifAlan);
                      return (
                        <td key={g} className="p-2 border-r border-slate-800/10">
                          <button onClick={() => setSeciliDetay({ usta: usta.ad, gun: g })} className={`w-12 h-12 mx-auto rounded-xl border-2 flex items-center justify-center transition-all ${!p ? "border-slate-800/50 hover:border-slate-500" : p.mesai === 'tam' ? "bg-green-600 border-green-400 text-white shadow-lg" : "bg-orange-500 border-orange-300 text-white shadow-lg"}`}>
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

      {showSifreModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-xl">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 text-center shadow-2xl">
            <Lock className="mx-auto mb-6 text-blue-500" size={40}/>
            <h2 className="text-2xl font-black text-white mb-6 uppercase">RAPOR ŞİFRESİ</h2>
            <input type="password" autoFocus className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white text-center font-black tracking-[1em]" value={sifreInput} onChange={e => setSifreInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sifreOnayla()}/>
            <button onClick={sifreOnayla} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500">ONAYLA</button>
            <button onClick={() => setShowSifreModal(null)} className="mt-4 text-slate-600 text-[10px] font-black hover:text-slate-300">İPTAL</button>
          </div>
        </div>
      )}

      {seciliDetay && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-md">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-md border border-slate-700 shadow-2xl">
            <h3 className="text-3xl font-black text-white mb-8 italic">{seciliDetay.usta}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={() => puantajKaydet('tam')} className="bg-green-600 p-8 rounded-[2rem] font-black text-white hover:bg-green-500 transition-all">TAM GÜN</button>
              <button onClick={() => puantajKaydet('yarim')} className="bg-orange-500 p-8 rounded-[2rem] font-black text-white hover:bg-orange-400 transition-all">YARIM GÜN</button>
            </div>
            <button onClick={() => puantajKaydet('sil')} className="w-full bg-red-600/10 text-red-500 p-4 rounded-2xl font-black mb-4 hover:bg-red-600 hover:text-white transition-all italic">KAYDI SİL</button>
            <button onClick={() => setSeciliDetay(null)} className="w-full text-slate-500 font-black hover:text-white transition-all">KAPAT</button>
          </div>
        </div>
      )}

      {showAlanModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-6 italic">YENİ ŞANTİYE</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black" placeholder="İSİM..." value={yeniAlanAd} onChange={e => setYeniAlanAd(e.target.value)} />
            <button onClick={alanEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500">EKLE</button>
            <button onClick={() => setShowAlanModal(false)} className="mt-4 w-full text-slate-500 font-black text-[10px] hover:text-white">VAZGEÇ</button>
          </div>
        </div>
      )}

      {showUstaModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-6 italic">YENİ USTA</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black" placeholder="AD SOYAD..." value={yeniUstaAd} onChange={e => setYeniUstaAd(e.target.value)} />
            <button onClick={ustaEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500">KAYDET</button>
            <button onClick={() => setShowUstaModal(false)} className="mt-4 w-full text-slate-500 font-black text-[10px] hover:text-white">VAZGEÇ</button>
          </div>
        </div>
      )}
    </main>
  );
}