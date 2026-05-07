"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, Construction, Calculator, FileSpreadsheet, LayoutDashboard, Users, Lock, LogOut, ShieldCheck, Trash2, ChevronLeft, ChevronRight, Download, FileText, Star, Plane } from 'lucide-react';
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
  
  const [seciliTarih, setSeciliTarih] = useState(new Date());
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const [showAlanModal, setShowAlanModal] = useState(false);
  const [showUstaModal, setShowUstaModal] = useState(false);
  const [showSifreModal, setShowSifreModal] = useState<{tip: 'aylik' | 'genel_ozet' | 'santiye_tum'} | null>(null);
  const [sifreInput, setSifreInput] = useState('');
  const [seciliDetay, setSeciliDetay] = useState<{usta: string, gun: number} | null>(null);
  const [yeniAlanAd, setYeniAlanAd] = useState('');
  const [yeniUstaAd, setYeniUstaAd] = useState('');

  const yil = seciliTarih.getFullYear();
  const ay = seciliTarih.getMonth() + 1;
  const ayAdi = seciliTarih.toLocaleString('tr-TR', { month: 'long' });
  
  const gunSayisi = new Date(yil, ay, 0).getDate();
  const gunler = Array.from({ length: gunSayisi }, (_, i) => i + 1);

  const getGunAdi = (gun: number) => {
    const d = new Date(yil, ay - 1, gun);
    return d.toLocaleString('tr-TR', { weekday: 'short' });
  };

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
  }, [isLoggedIn, seciliTarih]);

  const ayDegistir = (yon: 'ileri' | 'geri') => {
    const yeni = new Date(seciliTarih);
    if (yon === 'ileri') yeni.setMonth(yeni.getMonth() + 1);
    else yeni.setMonth(yeni.getMonth() - 1);
    setSeciliTarih(yeni);
  };

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
    verileriGetir();
  }

  async function ustaEkle() {
    if (!yeniUstaAd.trim()) return;
    await supabase.from('ustalar').insert([{ ad: yeniUstaAd.trim(), alan: aktifAlan }]);
    setYeniUstaAd(''); setShowUstaModal(false);
    verileriGetir();
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
      if (showSifreModal?.tip === 'aylik') excelIndir();
      else if (showSifreModal?.tip === 'genel_ozet') genelRaporIndir();
      else if (showSifreModal?.tip === 'santiye_tum') santiyeTumZamanlarIndir();
      setShowSifreModal(null); setSifreInput('');
    } else { alert("Hatalı!"); setSifreInput(''); }
  };

  const excelIndir = () => {
    const aktifUstaListesi = ustalar.filter(u => u.alan === aktifAlan);
    const excelVerisi = aktifUstaListesi.map(usta => {
      const pList = puantajlar.filter(p => p.usta === usta.ad && p.alan === aktifAlan);
      const tam = pList.filter(p => p.mesai === 'tam').length;
      const yarim = pList.filter(p => p.mesai === 'yarim').length;
      const cift = pList.filter(p => p.mesai === 'cift').length;
      const izin = pList.filter(p => p.mesai === 'izin').length;
      return { 
        "ŞANTİYE": aktifAlan, 
        "USTA ADI": usta.ad, 
        "TAM GÜN": tam, 
        "YARIM GÜN": yarim, 
        "MESAİ (ÇİFT)": cift,
        "İZİNLİ/RAPORLU": izin,
        "TOPLAM YEVMİYE": tam + (yarim * 0.5) + (cift * 2), 
        "YEVMİYE": 0, 
        "HAKEDİŞ": 0 
      };
    });
    const ws = XLSX.utils.json_to_sheet(excelVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `${aktifAlan}_${ayAdi}_Puantaj.xlsx`);
  };

  const santiyeTumZamanlarIndir = async () => {
    const { data: tumPuantajlar } = await supabase.from('puantaj').select('*').match({ alan: aktifAlan });
    const aktifUstaListesi = ustalar.filter(u => u.alan === aktifAlan);
    
    const excelVerisi = aktifUstaListesi.map(usta => {
      const pList = (tumPuantajlar || []).filter(p => p.usta === usta.ad);
      const tam = pList.filter(p => p.mesai === 'tam').length;
      const yarim = pList.filter(p => p.mesai === 'yarim').length;
      const cift = pList.filter(p => p.mesai === 'cift').length;
      const izin = pList.filter(p => p.mesai === 'izin').length;
      return { 
        "ŞANTİYE": aktifAlan, 
        "USTA ADI": usta.ad, 
        "TOPLAM TAM GÜN": tam, 
        "TOPLAM YARIM GÜN": yarim, 
        "TOPLAM MESAİ (ÇİFT)": cift,
        "TOPLAM İZİNLİ/RAPORLU": izin,
        "GENEL TOPLAM YEVMİYE": tam + (yarim * 0.5) + (cift * 2),
        "YEVMİYE": 0,
        "GENEL HAKEDİŞ": 0
      };
    });
    const ws = XLSX.utils.json_to_sheet(excelVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Genel Rapor");
    XLSX.writeFile(wb, `${aktifAlan}_GENEL_DOKUM.xlsx`);
  };

  const genelRaporIndir = () => {
    const genelVeri = alanlar.map(alan => {
      const p = puantajlar.filter(px => px.alan === alan.ad);
      const tam = p.filter(x => x.mesai === 'tam').length;
      const yarim = p.filter(x => x.mesai === 'yarim').length;
      const cift = p.filter(x => x.mesai === 'cift').length;
      return { 
        "ŞANTİYE": alan.ad, 
        "USTA SAYISI": ustalar.filter(u => u.alan === alan.ad).length, 
        "TOPLAM YEVMİYE": tam + (yarim * 0.5) + (cift * 2) 
      };
    });
    const ws = XLSX.utils.json_to_sheet(genelVeri);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Genel");
    XLSX.writeFile(wb, `Santiye_Ozet_Raporu.xlsx`);
  };

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
            <button onClick={handleLogin} className="w-full bg-blue-600 p-6 rounded-2xl text-white font-black hover:bg-blue-500 transition-all">GİRİŞ YAP</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#02040a] text-slate-300 p-6 font-sans uppercase text-[11px]">
      <div className="max-w-[1800px] mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50">
           <div className="flex items-center gap-6">
              <span className="ml-4 text-[9px] font-black text-slate-500 italic uppercase tracking-widest">SİSTEM ÇEVRİMİÇİ</span>
              <div className="flex items-center bg-[#161b2c] rounded-xl border border-slate-700 overflow-hidden">
                <button onClick={() => ayDegistir('geri')} className="p-3 hover:bg-blue-600/20 text-blue-500 transition-all"><ChevronLeft size={18}/></button>
                <span className="px-6 font-black text-white text-[12px] min-w-[150px] text-center">{ayAdi} {yil}</span>
                <button onClick={() => ayDegistir('ileri')} className="p-3 hover:bg-blue-600/20 text-blue-500 transition-all"><ChevronRight size={18}/></button>
              </div>
           </div>
           <button onClick={() => setIsLoggedIn(false)} className="bg-red-600/10 text-red-500 px-6 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-red-600 hover:text-white transition-all">ÇIKIŞ YAP <LogOut size={16}/></button>
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
            <div className="bg-purple-600/10 p-4 rounded-2xl text-purple-500"><Calculator size={28}/></div>
            <div><p className="text-slate-500 text-[10px]">{ayAdi.toUpperCase()} YEVMİYE</p><p className="text-3xl font-black text-white">{puantajlar.filter(p => p.mesai === 'tam').length + (puantajlar.filter(p => p.mesai === 'yarim').length * 0.5) + (puantajlar.filter(p => p.mesai === 'cift').length * 2)}</p></div>
          </div>
          <button onClick={() => setShowSifreModal({tip: 'genel_ozet'})} className="bg-purple-600 p-8 rounded-[2rem] flex items-center justify-center gap-4 text-white font-black hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/20">
            <Lock size={24}/> GENEL RAPOR
          </button>
        </div>

        <div className="flex items-center gap-4 bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50 overflow-x-auto no-scrollbar">
          <Construction className="text-blue-500 ml-4 shrink-0" size={24} />
          <div className="flex gap-2">
            {alanlar.map(alan => (
              <button key={alan.id} onClick={() => setAktifAlan(alan.ad)} className={`px-8 py-3 rounded-2xl font-black whitespace-nowrap transition-all ${aktifAlan === alan.ad ? "bg-blue-600 text-white shadow-lg" : "bg-[#161b2c] text-slate-500 hover:bg-slate-800"}`}>{alan.ad}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-2 mr-4 shrink-0">
            {aktifAlan && <button onClick={alanSil} className="p-3 bg-red-600/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={24}/></button>}
            <button onClick={() => setShowAlanModal(true)} className="p-3 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-2xl hover:bg-blue-600 hover:text-white transition-all"><Plus size={24}/></button>
          </div>
        </div>

        <div className="bg-[#0b101d] rounded-[2.5rem] border border-slate-800/50 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-slate-800/50 flex flex-wrap gap-4 justify-between items-center">
            <h2 className="text-2xl font-black text-white italic">{aktifAlan} <span className="text-blue-500 font-normal opacity-40">/ ÇİZELGE</span></h2>
            <div className="flex gap-4 relative">
              <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-green-500 shadow-lg transition-all"><Download size={20}/> İNDİR</button>
              
              {showDownloadMenu && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-[#161b2c] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <button onClick={() => { setShowSifreModal({tip: 'aylik'}); setShowDownloadMenu(false); }} className="w-full text-left px-6 py-4 hover:bg-blue-600 text-white font-bold flex items-center gap-3 border-b border-slate-800/50"><ChevronRight size={16}/> {ayAdi} Raporu</button>
                  <button onClick={() => { setShowSifreModal({tip: 'santiye_tum'}); setShowDownloadMenu(false); }} className="w-full text-left px-6 py-4 hover:bg-blue-600 text-white font-bold flex items-center gap-3"><FileText size={16}/> Şantiye Genel (Tüm Zamanlar)</button>
                </div>
              )}

              <button onClick={() => setShowUstaModal(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-blue-500 shadow-lg transition-all"><Plus size={20}/> USTA EKLE</button>
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="bg-[#02040a]">
                  <th className="p-6 text-left sticky left-0 bg-[#0b101d] z-10 w-64 text-slate-500 font-black border-r border-slate-800">USTALAR</th>
                  {gunler.map(g => (
                    <th key={g} className="p-4 text-center border-r border-slate-800/50 min-w-[65px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-white font-black text-[14px]">{g}</span>
                        <span className={`text-[9px] font-bold ${['Cmt', 'Paz'].includes(getGunAdi(g)) ? 'text-red-500' : 'text-slate-600'}`}>{getGunAdi(g).toUpperCase()}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ustalar.filter(u => u.alan === aktifAlan).map(usta => (
                  <tr key={usta.id} className="border-t border-slate-800/50 group hover:bg-white/[0.02]">
                    <td className="p-6 font-black sticky left-0 bg-[#0b101d] text-slate-200 z-10 flex items-center justify-between border-r border-slate-800">
                        <span>{usta.ad}</span>
                        <button onClick={() => ustaSil(usta.ad)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110 transition-all p-2 bg-red-500/5 rounded-lg"><Trash2 size={16}/></button>
                    </td>
                    {gunler.map(g => {
                      const p = puantajlar.find(px => px.usta === usta.ad && px.gun === g && px.alan === aktifAlan);
                      const gunAdi = getGunAdi(g);
                      return (
                        <td key={g} className={`p-2 border-r border-slate-800/20 ${['Cmt', 'Paz'].includes(gunAdi) ? 'bg-white/[0.01]' : ''}`}>
                          <button onClick={() => setSeciliDetay({ usta: usta.ad, gun: g })} className={`w-12 h-12 mx-auto rounded-xl border-2 flex items-center justify-center transition-all ${!p ? "border-slate-800/50 hover:border-slate-500" : p.mesai === 'tam' ? "bg-green-600 border-green-400 text-white shadow-lg" : p.mesai === 'yarim' ? "bg-orange-500 border-orange-300 text-white shadow-lg" : p.mesai === 'cift' ? "bg-blue-600 border-blue-400 text-white shadow-lg" : "bg-slate-700 border-slate-500 text-white shadow-lg"}`}>
                            {p?.mesai === 'tam' ? <Check size={20}/> : p?.mesai === 'yarim' ? "1/2" : p?.mesai === 'cift' ? <Star size={20}/> : p?.mesai === 'izin' ? "İ" : ""}
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
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 text-center shadow-2xl w-full max-w-sm">
            <Lock className="mx-auto mb-6 text-blue-500" size={40}/>
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-tighter">RAPOR ŞİFRESİ</h2>
            <input type="password" autoFocus className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white text-center font-black tracking-[1em] outline-none" value={sifreInput} onChange={e => setSifreInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sifreOnayla()}/>
            <button onClick={sifreOnayla} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500 transition-all">ONAYLA</button>
            <button onClick={() => setShowSifreModal(null)} className="mt-4 text-slate-600 text-[10px] font-black hover:text-slate-300 transition-all uppercase">İPTAL</button>
          </div>
        </div>
      )}

      {seciliDetay && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-md">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-md border border-slate-700 shadow-2xl">
            <h3 className="text-3xl font-black text-white mb-2 italic tracking-tighter">{seciliDetay.usta}</h3>
            <p className="text-slate-500 mb-8 font-bold text-[10px]">{seciliDetay.gun} {ayAdi.toUpperCase()} {yil} PUANTAJI</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => puantajKaydet('tam')} className="bg-green-600 p-6 rounded-[1.5rem] font-black text-white hover:bg-green-500 transition-all shadow-lg text-[10px]">TAM GÜN</button>
              <button onClick={() => puantajKaydet('yarim')} className="bg-orange-500 p-6 rounded-[1.5rem] font-black text-white hover:bg-orange-400 transition-all shadow-lg text-[10px]">YARIM GÜN</button>
              <button onClick={() => puantajKaydet('cift')} className="bg-blue-600 p-6 rounded-[1.5rem] font-black text-white hover:bg-blue-500 transition-all shadow-lg text-[10px]">MESAİ (ÇİFT)</button>
              <button onClick={() => puantajKaydet('izin')} className="bg-slate-700 p-6 rounded-[1.5rem] font-black text-white hover:bg-slate-600 transition-all shadow-lg text-[10px] flex flex-col items-center gap-1">İZİNLİ <span>/ RAPORLU</span></button>
            </div>
            <button onClick={() => puantajKaydet('sil')} className="w-full bg-red-600/10 text-red-500 p-4 rounded-2xl font-black mb-4 hover:bg-red-600 hover:text-white transition-all italic">KAYDI SİL</button>
            <button onClick={() => setSeciliDetay(null)} className="w-full text-slate-500 font-black hover:text-white transition-all text-[10px]">KAPAT</button>
          </div>
        </div>
      )}

      {showAlanModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 shadow-2xl w-full max-w-sm">
            <h2 className="text-xl font-black text-white mb-6 italic tracking-tighter">YENİ ŞANTİYE EKLE</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black" placeholder="ŞANTİYE ADI..." value={yeniAlanAd} onChange={e => setYeniAlanAd(e.target.value)} />
            <button onClick={alanEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500">EKLE</button>
            <button onClick={() => setShowAlanModal(false)} className="mt-4 w-full text-slate-500 font-black text-[10px] hover:text-white uppercase">VAZGEÇ</button>
          </div>
        </div>
      )}

      {showUstaModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 shadow-2xl w-full max-w-sm">
            <h2 className="text-xl font-black text-white mb-6 italic tracking-tighter">YENİ USTA EKLE</h2>
            <p className="text-[9px] text-blue-500 mb-4 font-bold">{aktifAlan} ŞANTİYESİNE KAYDEDİLECEK</p>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black" placeholder="USTA AD SOYAD..." value={yeniUstaAd} onChange={e => setYeniUstaAd(e.target.value)} />
            <button onClick={ustaEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500">KAYDET</button>
            <button onClick={() => setShowUstaModal(false)} className="mt-4 w-full text-slate-500 font-black text-[10px] hover:text-white uppercase">VAZGEÇ</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { height: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0b101d; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; border: 2px solid #0b101d; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </main>
  );
}