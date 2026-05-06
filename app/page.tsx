"use client";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, X, Construction, Calculator, FileSpreadsheet, LayoutDashboard, Users, Lock, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
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
  const [notInput, setNotInput] = useState('');

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

  // SİLME FONKSİYONLARI
  async function alanSil() {
    if (!aktifAlan) return;
    const onay = confirm(`${aktifAlan} şantiyesini ve bu şantiyeye ait tüm usta/puantaj kayıtlarını silmek istediğinize emin misiniz?`);
    if (onay) {
      await supabase.from('puantaj').delete().match({ alan: aktifAlan });
      await supabase.from('ustalar').delete().match({ alan: aktifAlan });
      await supabase.from('alanlar').delete().match({ ad: aktifAlan });
      setAktifAlan('');
      verileriGetir();
    }
  }

  async function ustaSil(ustaAd: string) {
    const onay = confirm(`${ustaAd} ustasını ve bu şantiyedeki puantajlarını silmek istediğinize emin misiniz?`);
    if (onay) {
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
      await supabase.from('puantaj').upsert({ usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun, mesai, not_: notInput });
    }
    setSeciliDetay(null); setNotInput('');
  }

  const sifreOnayla = () => {
    if (sifreInput === RAPOR_SIFRE) {
      if (showSifreModal?.tip === 'tekil') excelIndir();
      else if (showSifreModal?.tip === 'genel') genelRaporIndir();
      setShowSifreModal(null); 
      setSifreInput('');
    } else { 
      alert("Hatalı Rapor Şifresi!"); 
      setSifreInput(''); 
    }
  };

  const excelIndir = () => {
    const aktifUstaListesi = ustalar.filter(u => u.alan === aktifAlan);
    const excelVerisi = aktifUstaListesi.map(usta => {
      const pList = puantajlar.filter(p => p.usta === usta.ad && p.alan === aktifAlan);
      const tam = pList.filter(p => p.mesai === 'tam').length;
      const yarim = pList.filter(p => p.mesai === 'yarim').length;
      const toplamGun = tam + (yarim * 0.5);

      return { 
        "ŞANTİYE": aktifAlan,
        "USTA ADI": usta.ad, 
        "TAM GÜN": tam, 
        "YARIM GÜN ÇALIŞMA": yarim, 
        "TOPLAM GÜN": toplamGun,
        "YEVMİYE (ELİNLE YAZ)": 0,
        "TOPLAM HAKEDİŞ": 0 
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelVerisi);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hakediş Raporu");
    XLSX.writeFile(wb, `${aktifAlan}_Hakedis_Raporu.xlsx`);
  };

  const genelRaporIndir = () => {
    const genelVeri = alanlar.map(alan => {
      const p = puantajlar.filter(px => px.alan === alan.ad);
      const tam = p.filter(x => x.mesai === 'tam').length;
      const yarim = p.filter(x => x.mesai === 'yarim').length;
      
      return { 
        "ŞANTİYE ADI": alan.ad, 
        "USTA SAYISI": ustalar.filter(u => u.alan === alan.ad).length, 
        "TOPLAM GÜN (YEVMİYE)": tam + (yarim * 0.5) 
      };
    });
    const ws = XLSX.utils.json_to_sheet(genelVeri);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Genel Özet");
    XLSX.writeFile(wb, `Genel_Santiye_Raporu.xlsx`);
  };

  const [yeniAlanAd, setYeniAlanAd] = useState('');
  const [yeniUstaAd, setYeniUstaAd] = useState('');

  if (!mounted) return null;

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

  return (
    <main className="min-h-screen bg-[#02040a] text-slate-300 p-6 font-sans uppercase text-[11px]">
      <div className="max-w-[1800px] mx-auto space-y-8">
        
        <div className="flex justify-between items-center bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50">
           <div className="flex items-center gap-3 ml-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] font-black tracking-widest text-slate-500 italic">SİSTEM ÇEVRİMİÇİ / OTURUM AÇIK</span>
           </div>
           <button onClick={() => setIsLoggedIn(false)} className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-6 py-2 rounded-xl font-black transition-all flex items-center gap-2">
              ÇIKIŞ YAP <LogOut size={16}/>
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800/50 flex items-center gap-6 shadow-2xl">
            <div className="bg-blue-600