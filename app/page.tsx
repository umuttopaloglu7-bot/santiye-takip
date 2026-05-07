"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, Construction, Calculator, FileSpreadsheet, LayoutDashboard, Users, Lock, LogOut, ShieldCheck, Trash2, ChevronLeft, ChevronRight, Download, FileText, Clock, Plane } from 'lucide-react';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_SIFRE = "1881"; 
const RAPOR_SIFRE = "1954"; 
const STANDART_CALISMA_SAATI = 8; 

export default function PuantajYonetim() {
  // 1. ÖNCE TÜM DEĞİŞKENLER (STATE)
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginSifre, setLoginSifre] = useState('');
  const [error, setError] = useState(false);
  
  const [alanlar, setAlanlar] = useState<any[]>([]);
  const [ustalar, setUstalar] = useState<any[]>([]);
  const [puantajlar, setPuantajlar] = useState<any[]>([]);
  const [aktifAlan, setAktifAlan] = useState<string>('');
  
  const [seciliTarih, setSeciliTarih] = useState(new Date());
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showAlanModal, setShowAlanModal] = useState(false);
  const [showUstaModal, setShowUstaModal] = useState(false);
  const [showSifreModal, setShowSifreModal] = useState<{tip: 'aylik' | 'genel_ozet' | 'santiye_tum'} | null>(null);
  
  const [sifreInput, setSifreInput] = useState('');
  const [seciliDetay, setSeciliDetay] = useState<{usta: string, gun: number} | null>(null);
  const [saatInput, setSaatInput] = useState<string>('');
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

  // 2. VERİ ÇEKME VE SENKRONİZASYON
  const syncVeri = async () => {
    const { data: p } = await supabase.from('puantaj').select('*').match({ yil, ay });
    const { data: u } = await supabase.from('ustalar').select('*');
    const { data: a } = await supabase.from('alanlar').select('*');
    if (p) setPuantajlar(p);
    if (u) setUstalar(u);
    if (a) setAlanlar(a);
  };

  const verileriGetir = async () => {
    const { data: a } = await supabase.from('alanlar').select('*').order('ad');
    const { data: u } = await supabase.from('ustalar').select('*').order('ad');
    const { data: p } = await supabase.from('puantaj').select('*').match({ yil, ay });
    if (a) setAlanlar(a);
    if (u) setUstalar(u);
    if (p) setPuantajlar(p);
    if (a && a.length > 0 && !aktifAlan) setAktifAlan(a[0].ad);
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

  // 3. BUTON FONKSİYONLARI
  const handleLogin = () => {
    if (loginSifre === ADMIN_SIFRE) { setIsLoggedIn(true); setError(false); }
    else { setError(true); setLoginSifre(''); setTimeout(() => setError(false), 2000); }
  };

  const ayDegistir = (yon: 'ileri' | 'geri') => {
    const yeni = new Date(seciliTarih);
    yon === 'ileri' ? yeni.setMonth(yeni.getMonth() + 1) : yeni.setMonth(yeni.getMonth() - 1);
    setSeciliTarih(yeni);
  };

  async function puantajKaydet(tip: string, deger?: number) {
    if (!seciliDetay) return;
    if (tip === 'sil') {
      await supabase.from('puantaj').delete().match({ usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun });
    } else {
      const kayitDegeri = tip === 'tam' ? STANDART_CALISMA_SAATI : tip === 'izin' ? -1 : deger;
      await supabase.from('puantaj').upsert({ 
        usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun, 
        saat: kayitDegeri 
      });
    }
    setSeciliDetay(null); setSaatInput(''); syncVeri();
  }

  async function alanSil() {
    if (!aktifAlan || !confirm(`${aktifAlan} silinsin mi?`)) return;
    await supabase.from('puantaj').delete().match({ alan: aktifAlan });
    await supabase.from('ustalar').delete().match({ alan: aktifAlan });
    await supabase.from('alanlar').delete().match({ ad: aktifAlan });
    setAktifAlan(''); verileriGetir();
  }

  async function ustaSil(ustaAd: string) {
    if (!confirm(`${ustaAd} silinsin mi?`)) return;
    await supabase.from('puantaj').delete().match({ usta: ustaAd, alan: aktifAlan });
    await supabase.from('ustalar').delete().match({ ad: ustaAd, alan: aktifAlan });
    syncVeri();
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
      const tSaat = pList.reduce((acc, curr) => acc + (curr.saat > 0 ? curr.saat : 0), 0);
      const izinliGun = pList.filter(p => p.saat === -1).length;
      return { "ŞANTİYE": aktifAlan, "USTA ADI": usta.ad, "TOPLAM SAAT": tSaat, "YEVMİYE": tSaat / STANDART_CALISMA_SAATI, "İZİNLİ GÜN": izinliGun };
    });
    const ws = XLSX.utils.json_to_sheet(excelVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `${aktifAlan}_${ayAdi}_Rapor.xlsx`);
  };

  const santiyeTumZamanlarIndir = async () => {
    const { data: tumPuantajlar } = await supabase.from('puantaj').select('*').match({ alan: aktifAlan });
    const aktifUstaListesi = ustalar.filter(u => u.alan === aktifAlan);
    const excelVerisi = aktifUstaListesi.map(usta => {
      const pList = (tumPuantajlar || []).filter(p => p.usta === usta.ad);
      const tSaat = pList.reduce((acc, curr) => acc + (curr.saat > 0 ? curr.saat : 0), 0);
      return { "ŞANTİYE": aktifAlan, "USTA ADI": usta.ad, "TOPLAM SAAT": tSaat, "YEVMİYE": tSaat / STANDART_CALISMA_SAATI };
    });
    const ws = XLSX.utils.json_to_sheet(excelVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Genel");
    XLSX.writeFile(wb, `${aktifAlan}_Tum_Zamanlar.xlsx`);
  };

  const genelRaporIndir = () => {
    const genelVeri = alanlar.map(alan => {
      const p = puantajlar.filter(px => px.alan === alan.ad);
      const tSaat = p.reduce((acc, curr) => acc + (curr.saat > 0 ? curr.saat : 0), 0);
      return { "ŞANTİYE": alan.ad, "USTA": ustalar.filter(u => u.alan === alan.ad).length, "YEVMİYE": tSaat / STANDART_CALISMA_SAATI };
    });
    const ws = XLSX.utils.json_to_sheet(genelVeri);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ozet");
    XLSX.writeFile(wb, `Tum_Santiyeler.xlsx`);
  };

  if (!mounted) return null;

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#02040a] flex items-center justify-center p-6">
        <div className={`w-full max-w-md bg-[#0b101d] p-12 rounded-[3rem] border ${error ? 'border-red-500' : 'border-slate-800'} shadow-2xl`}>
          <div className="text-center mb-10"><ShieldCheck size={40} className="mx-auto mb-6 text-blue-500"/><h1 className="text-3xl font-black text-white italic">ŞANTİYE TAKİP</h1></div>
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
        {/* Üst Bar */}
        <div className="flex justify-between items-center bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50">
           <div className="flex items-center gap-6">
              <span className="ml-4 text-[9px] font-black text-slate-500 italic uppercase">SİSTEM ÇEVRİMİÇİ</span>
              <div className="flex items-center bg-[#161b2c] rounded-xl border border-slate-700 overflow-hidden">
                <button onClick={() => ayDegistir('geri')} className="p-3 hover:bg-blue-600/20 text-blue-500 transition-all"><ChevronLeft size={18}/></button>
                <span className="px-6 font-black text-white text-[12px] min-w-[150px] text-center">{ayAdi} {yil}</span>
                <button onClick={() => ayDegistir('ileri')} className="p-3 hover:bg-blue-600/20 text-blue-500 transition-all"><ChevronRight size={18}/></button>
              </div>
           </div>
           <button onClick={() => setIsLoggedIn(false)} className="bg-red-600/10 text-red-500 px-6 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-red-600 hover:text-white transition-all">ÇIKIŞ YAP <LogOut size={16}/></button>
        </div>

        {/* İstatistikler */}
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
            <div><p className="text-slate-500 text-[10px]">{ayAdi.toUpperCase()} YEVMİYE</p>
            <p className="text-3xl font-black text-white">{(puantajlar.reduce((acc, curr) => acc + (curr.saat > 0 ? curr.saat : 0), 0) / STANDART_CALISMA_SAATI).toFixed(2)}</p></div>
          </div>
          <button onClick={() => setShowSifreModal({tip: 'genel_ozet'})} className="bg-purple-600 p-8 rounded-[2rem] flex items-center justify-center gap-4 text-white font-black hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/20"><Lock size={24}/> GENEL RAPOR</button>
        </div>

        {/* Şantiyeler */}
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

        {/* Ana Çizelge */}
        <div className="bg-[#0b101d] rounded-[2.5rem] border border-slate-800/50 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-slate-800/50 flex flex-wrap gap-4 justify-between items-center">
            <h2 className="text-2xl font-black text-white italic">{aktifAlan} <span className="text-blue-500 font-normal opacity-40">/ ÇİZELGE</span></h2>
            <div className="flex gap-4 relative">
              <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-green-500 shadow-lg transition-all"><Download size={20}/> İNDİR</button>
              {showDownloadMenu && (
                <div className="absolute top-full mt-2 right-0 w-64 bg-[#161b2c] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <button onClick={() => { setShowSifreModal({tip: 'aylik'}); setShowDownloadMenu(false); }} className="w-full text-left px-6 py-4 hover:bg-blue-600 text-white font-bold border-b border-slate-800/50 uppercase">📅 {ayAdi} Raporu</button>
                  <button onClick={() => { setShowSifreModal({tip: 'santiye_tum'}); setShowDownloadMenu(false); }} className="w-full text-left px-6 py-4 hover:bg-blue-600 text-white font-bold uppercase">🏗️ Tüm Zamanlar</button>
                </div>
              )}
              <button onClick={() => setShowUstaModal(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-blue-500 transition-all"><Plus size={20}/> USTA EKLE</button>
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
                        <button onClick={() => ustaSil(usta.ad)} className="opacity-0 group-hover:opacity-100 text-red-500 transition-all p-2 bg-red-500/5 rounded-lg"><Trash2 size={16}/></button>
                    </td>
                    {gunler.map(g => {
                      const p = puantajlar.find(px => px.usta === usta.ad && px.gun === g && px.alan === aktifAlan);
                      return (
                        <td key={g} className="p-2 border-r border-slate-800/20 text-center">
                          <button onClick={() => setSeciliDetay({ usta: usta.ad, gun: g })} className={`w-12 h-12 mx-auto rounded-xl border-2 flex items-center justify-center transition-all ${!p ? "border-slate-800/50 hover:border-slate-500" : p.saat === STANDART_CALISMA_SAATI ? "bg-green-600 border-green-400 text-white shadow-lg" : p.saat === -1 ? "bg-slate-700 border-slate-500 text-white" : "bg-orange-500 border-orange-300 text-white font-black text-[14px]"}`}>
                            {p?.saat === STANDART_CALISMA_SAATI ? <Check size={20}/> : p?.saat === -1 ? "İ" : p?.saat || ""}
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

      {/* Şifre Modalı */}
      {showSifreModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-xl">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 text-center shadow-2xl w-full max-w-sm">
            <Lock className="mx-auto mb-6 text-blue-500" size={40}/><h2 className="text-2xl font-black text-white mb-6 uppercase text-center">YETKİ GEREKLİ</h2>
            <input type="password" autoFocus className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white text-center font-black tracking-[1em] outline-none" value={sifreInput} onChange={e => setSifreInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sifreOnayla()}/>
            <button onClick={sifreOnayla} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500 transition-all">ONAYLA</button>
            <button onClick={() => setShowSifreModal(null)} className="mt-4 text-slate-600 text-[10px] font-black uppercase text-center w-full">İPTAL</button>
          </div>
        </div>
      )}

      {/* Puantaj Giriş Modalı */}
      {seciliDetay && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-md">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-md border border-slate-700 shadow-2xl text-center">
            <h3 className="text-3xl font-black text-white mb-2 italic text-center uppercase">{seciliDetay.usta}</h3>
            <p className="text-slate-500 mb-8 font-bold text-[10px] text-center uppercase">{seciliDetay.gun} {ayAdi} {yil}</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={() => puantajKaydet('tam')} className="bg-green-600 p-6 rounded-[1.5rem] font-black text-white hover:bg-green-500 transition-all shadow-lg flex flex-col items-center gap-2"><Check size={24}/><span>TAM GÜN</span></button>
              <button onClick={() => puantajKaydet('izin')} className="bg-slate-700 p-6 rounded-[1.5rem] font-black text-white hover:bg-slate-600 transition-all shadow-lg flex flex-col items-center gap-2"><Plane size={24}/><span>İZİNLİ</span></button>
            </div>
            <div className="bg-[#161b2c] p-6 rounded-[2rem] border border-slate-700 mb-6 text-center">
               <p className="text-blue-500 font-black text-[10px] mb-4 uppercase text-center">SAAT GİRİŞİ</p>
               <div className="flex gap-4">
                  <input type="number" placeholder="SAAT..." className="flex-1 bg-[#0b101d] border border-slate-700 p-4 rounded-xl text-white font-black text-center outline-none focus:border-blue-500" value={saatInput} onChange={(e) => setSaatInput(e.target.value)} />
                  <button onClick={() => saatInput && puantajKaydet('ozel', Number(saatInput))} className="bg-blue-600 px-6 rounded-xl text-white font-black"><Clock size={20}/></button>
               </div>
            </div>
            <button onClick={() => puantajKaydet('sil')} className="w-full bg-red-600/10 text-red-500 p-4 rounded-2xl font-black mb-4 hover:bg-red-600 hover:text-white transition-all italic uppercase text-center">KAYDI SİL</button>
            <button onClick={() => {setSeciliDetay(null); setSaatInput('');}} className="w-full text-slate-500 font-black hover:text-white transition-all text-[10px] uppercase text-center">KAPAT</button>
          </div>
        </div>
      )}

      {/* Şantiye Ekleme */}
      {showAlanModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 shadow-2xl w-full max-w-sm text-center">
            <h2 className="text-xl font-black text-white mb-6 italic uppercase">YENİ ŞANTİYE</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black uppercase text-center" placeholder="AD..." value={yeniAlanAd} onChange={(e) => setYeniAlanAd(e.target.value)} />
            <button onClick={alanEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500 transition-all">OLUŞTUR</button>
            <button onClick={() => setShowAlanModal(false)} className="mt-4 w-full text-slate-500 font-black text-[10px] uppercase">VAZGEÇ</button>
          </div>
        </div>
      )}

      {/* Usta Ekleme */}
      {showUstaModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 shadow-2xl w-full max-w-sm text-center">
            <h2 className="text-xl font-black text-white mb-6 italic uppercase">YENİ USTA</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black uppercase text-center" placeholder="AD SOYAD..." value={yeniUstaAd} onChange={(e) => setYeniUstaAd(e.target.value)} />
            <button onClick={ustaEkle} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white hover:bg-blue-500 transition-all">KAYDET</button>
            <button onClick={() => setShowUstaModal(false)} className="mt-4 w-full text-slate-500 font-black text-[10px] uppercase">VAZGEÇ</button>
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