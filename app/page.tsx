"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Check, Construction, Calculator, LayoutDashboard, Users, Lock, LogOut, ShieldCheck, Trash2, ChevronLeft, ChevronRight, Download, Clock, Plane, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ADMIN_SIFRE = "1881"; 

export default function PuantajYonetim() {
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginSifre, setLoginSifre] = useState('');
  const [alanlar, setAlanlar] = useState<any[]>([]);
  const [ustalar, setUstalar] = useState<any[]>([]);
  const [puantajlar, setPuantajlar] = useState<any[]>([]);
  const [aktifAlan, setAktifAlan] = useState<string>('');
  const [seciliTarih, setSeciliTarih] = useState(new Date());
  const [seciliDetay, setSeciliDetay] = useState<{usta: string, gun: number} | null>(null);
  const [saatInput, setSaatInput] = useState<string>('');
  const [showAlanModal, setShowAlanModal] = useState(false);
  const [showUstaModal, setShowUstaModal] = useState(false);
  const [showRaporMenu, setShowRaporMenu] = useState(false);
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
    if (isLoggedIn) verileriGetir();
  }, [isLoggedIn, seciliTarih]);

  async function puantajKaydet(tip: string, deger?: number) {
    if (!seciliDetay || !aktifAlan) return;
    const kayitDegeri = tip === 'tam' ? 8 : tip === 'izin' ? -1 : deger;
    try {
      if (tip === 'sil') {
        await supabase.from('puantaj').delete().match({ usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun });
      } else {
        await supabase.from('puantaj').upsert({ 
          usta: seciliDetay.usta, alan: aktifAlan, yil, ay, gun: seciliDetay.gun, mesai: kayitDegeri 
        }, { onConflict: 'usta,alan,yil,ay,gun' });
      }
      setSeciliDetay(null); setSaatInput(''); await verileriGetir();
    } catch (e) { alert("Kayıt Hatası: " + JSON.stringify(e)); }
  }

  // --- RAPORLAMA FONKSİYONLARI ---
  const excelIndir = (data: any[], dosyaAdi: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rapor");
    XLSX.writeFile(wb, `${dosyaAdi}.xlsx`);
  };

  const genelRaporHazirla = async () => {
    const { data } = await supabase.from('puantaj').select('*');
    if (!data) return;
    const rapor = data.map(p => ({ "Şantiye": p.alan, "Usta": p.usta, "Tarih": `${p.gun}/${p.ay}/${p.yil}`, "Mesai/Saat": p.mesai === -1 ? "İzinli" : p.mesai }));
    excelIndir(rapor, "TUM_SANTIYELER_GENEL_RAPOR");
  };

  const santiyeRaporu = async (tip: 'aylik' | 'genel') => {
    let query = supabase.from('puantaj').select('*').eq('alan', aktifAlan);
    if (tip === 'aylik') query = query.match({ yil, ay });
    const { data } = await query;
    if (!data) return;
    const rapor = data.map(p => ({ "Usta": p.usta, "Gün": p.gun, "Ay": p.ay, "Yıl": p.yil, "Çalışma": p.mesai === -1 ? "İzin" : p.mesai }));
    excelIndir(rapor, `${aktifAlan}_${tip === 'aylik' ? ayAdi : 'GENEL'}_RAPOR`);
    setShowRaporMenu(false);
  };

  if (!mounted) return null;

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#02040a] flex items-center justify-center p-6 text-white uppercase">
        <div className="w-full max-w-md bg-[#0b101d] p-12 rounded-[3rem] border border-slate-800 text-center shadow-2xl">
          <ShieldCheck size={40} className="mx-auto mb-6 text-blue-500"/><h1 className="text-3xl font-black italic mb-6">ŞANTİYE TAKİP</h1>
          <input type="password" autoFocus placeholder="ŞİFRE" className="w-full bg-[#161b2c] border border-slate-700 p-6 rounded-2xl text-center font-black mb-6" value={loginSifre} onChange={(e) => setLoginSifre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (loginSifre === ADMIN_SIFRE ? setIsLoggedIn(true) : alert("Hatalı"))}/>
          <button onClick={() => loginSifre === ADMIN_SIFRE ? setIsLoggedIn(true) : alert("Hatalı")} className="w-full bg-blue-600 p-6 rounded-2xl font-black">GİRİŞ</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#02040a] text-slate-300 p-6 font-sans uppercase text-[11px]">
      <div className="max-w-[1800px] mx-auto space-y-8">
        
        {/* ÜST BAR */}
        <div className="flex justify-between items-center bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50 shadow-lg">
           <div className="flex items-center bg-[#161b2c] rounded-xl border border-slate-700 overflow-hidden">
             <button onClick={() => setSeciliTarih(new Date(yil, ay - 2))} className="p-3 hover:bg-blue-600/20 text-blue-500"><ChevronLeft size={18}/></button>
             <span className="px-6 font-black text-white text-[12px] min-w-[150px] text-center">{ayAdi} {yil}</span>
             <button onClick={() => setSeciliTarih(new Date(yil, ay))} className="p-3 hover:bg-blue-600/20 text-blue-500"><ChevronRight size={18}/></button>
           </div>
           <button onClick={() => setIsLoggedIn(false)} className="bg-red-600/10 text-red-500 px-6 py-2 rounded-xl font-black">ÇIKIŞ YAP</button>
        </div>

        {/* ÖZET KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800 flex items-center gap-6">
            <LayoutDashboard size={28} className="text-blue-500"/>
            <div><p className="text-slate-500 text-[10px]">ŞANTİYE</p><p className="text-3xl font-black text-white">{alanlar.length}</p></div>
          </div>
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800 flex items-center gap-6">
            <Users size={28} className="text-green-500"/>
            <div><p className="text-slate-500 text-[10px]">USTA</p><p className="text-3xl font-black text-white">{ustalar.length}</p></div>
          </div>
          <div className="bg-[#0b101d] p-8 rounded-[2rem] border border-slate-800 flex items-center gap-6">
            <Calculator size={28} className="text-purple-500"/>
            <div><p className="text-slate-500 text-[10px]">AYLIK YEVMİYE</p>
            <p className="text-3xl font-black text-white">{(puantajlar.reduce((acc, curr) => acc + (curr.mesai > 0 ? curr.mesai : (curr.mesai === 8 ? 8 : 0)), 0) / 8).toFixed(1)}</p></div>
          </div>
          <button onClick={genelRaporHazirla} className="bg-purple-600 p-8 rounded-[2rem] flex items-center justify-center gap-4 text-white font-black hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/20">
            <FileSpreadsheet size={24}/> GENEL RAPOR (TÜMÜ)
          </button>
        </div>

        {/* ALAN SEÇİCİ */}
        <div className="flex items-center gap-4 bg-[#0b101d] p-4 rounded-[1.5rem] border border-slate-800/50 overflow-x-auto no-scrollbar">
          <Construction className="text-blue-500 ml-4 shrink-0" size={24} />
          {alanlar.map(alan => (
            <button key={alan.id} onClick={() => setAktifAlan(alan.ad)} className={`px-8 py-3 rounded-2xl font-black whitespace-nowrap transition-all ${aktifAlan === alan.ad ? "bg-blue-600 text-white shadow-lg" : "bg-[#161b2c] text-slate-500 hover:bg-slate-800"}`}>{alan.ad}</button>
          ))}
          <button onClick={() => setShowAlanModal(true)} className="p-3 bg-blue-600/10 text-blue-500 rounded-2xl ml-auto mr-4"><Plus size={24}/></button>
        </div>

        {/* TABLO */}
        <div className="bg-[#0b101d] rounded-[2.5rem] border border-slate-800/50 overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-slate-800/50 flex justify-between items-center bg-white/[0.01]">
            <h2 className="text-2xl font-black text-white italic">{aktifAlan} / PUANTAJ</h2>
            <div className="flex gap-4">
              <div className="relative">
                <button onClick={() => setShowRaporMenu(!showRaporMenu)} className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-green-500 transition-all">
                  <Download size={20}/> ŞANTİYE RAPORU
                </button>
                {showRaporMenu && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-[#161b2c] border border-slate-700 rounded-2xl overflow-hidden z-50 shadow-2xl">
                    <button onClick={() => santiyeRaporu('aylik')} className="w-full p-4 text-left hover:bg-blue-600 text-white font-bold border-b border-slate-700">BU AYIN RAPORU</button>
                    <button onClick={() => santiyeRaporu('genel')} className="w-full p-4 text-left hover:bg-blue-600 text-white font-bold">ŞANTİYE GENEL RAPOR</button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowUstaModal(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:bg-blue-500">
                <Plus size={20}/> USTA EKLE
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
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
                  <tr key={usta.id} className="border-t border-slate-800/50 group">
                    <td className="p-6 font-black sticky left-0 bg-[#0b101d] text-slate-200 z-10 flex items-center justify-between border-r border-slate-800">
                        <span>{usta.ad}</span>
                        <button onClick={() => { if(confirm("Usta Silinsin mi?")) supabase.from('ustalar').delete().eq('id', usta.id).then(() => verileriGetir()) }} className="opacity-0 group-hover:opacity-100 text-red-500"><Trash2 size={16}/></button>
                    </td>
                    {gunler.map(g => {
                      const p = puantajlar.find(px => px.usta === usta.ad && px.gun === g && px.alan === aktifAlan);
                      const isTam = p?.mesai === 8;
                      const isIzin = p?.mesai === -1;
                      return (
                        <td key={g} className="p-2 border-r border-slate-800/20 text-center">
                          <button onClick={() => setSeciliDetay({ usta: usta.ad, gun: g })} className={`w-12 h-12 mx-auto rounded-xl border-2 flex items-center justify-center transition-all ${!p ? "border-slate-800/50" : isTam ? "bg-green-600 border-green-400 text-white" : isIzin ? "bg-slate-700 border-slate-500 text-white" : "bg-orange-500 border-orange-300 text-white font-black"}`}>
                            {isTam ? <Check size={20}/> : isIzin ? "İ" : p?.mesai || ""}
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

      {/* KAYIT MODAL */}
      {seciliDetay && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[110] backdrop-blur-md p-6">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] w-full max-w-md border border-slate-700 shadow-2xl text-center">
            <h3 className="text-3xl font-black text-white mb-2 italic uppercase">{seciliDetay.usta}</h3>
            <p className="text-slate-500 mb-8 font-bold text-[10px] uppercase">{seciliDetay.gun} {ayAdi}</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={() => puantajKaydet('tam')} className="bg-green-600 p-6 rounded-[1.5rem] font-black text-white flex flex-col items-center gap-2 shadow-xl shadow-green-900/20"><Check size={24}/><span>TAM GÜN (8)</span></button>
              <button onClick={() => puantajKaydet('izin')} className="bg-slate-700 p-6 rounded-[1.5rem] font-black text-white flex flex-col items-center gap-2"><Plane size={24}/><span>İZİNLİ</span></button>
            </div>
            <div className="bg-[#161b2c] p-6 rounded-[2rem] border border-slate-700 mb-6 text-center">
               <p className="text-blue-500 font-black text-[10px] mb-4 uppercase">ÖZEL SAAT GİRİŞİ</p>
               <div className="flex gap-4">
                  <input type="number" className="flex-1 bg-[#0b101d] border border-slate-700 p-4 rounded-xl text-white font-black text-center" value={saatInput} onChange={(e) => setSaatInput(e.target.value)} />
                  <button onClick={() => saatInput && puantajKaydet('ozel', Number(saatInput))} className="bg-blue-600 px-6 rounded-xl text-white font-black"><Clock size={20}/></button>
               </div>
            </div>
            <button onClick={() => puantajKaydet('sil')} className="w-full bg-red-600/10 text-red-500 p-4 rounded-2xl font-black mb-4 italic">KAYDI SİL</button>
            <button onClick={() => setSeciliDetay(null)} className="w-full text-slate-500 font-black text-[10px]">KAPAT</button>
          </div>
        </div>
      )}

      {/* DİĞER MODALLAR (ŞANTİYE/USTA EKLE) */}
      {showAlanModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 w-full max-w-sm text-center">
            <h2 className="text-xl font-black text-white mb-6 uppercase">YENİ ŞANTİYE</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black uppercase text-center" value={yeniAlanAd} onChange={(e) => setYeniAlanAd(e.target.value)} />
            <button onClick={async () => { await supabase.from('alanlar').insert([{ ad: yeniAlanAd }]); setYeniAlanAd(''); setShowAlanModal(false); verileriGetir(); }} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white">OLUŞTUR</button>
          </div>
        </div>
      )}

      {showUstaModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110]">
          <div className="bg-[#0b101d] p-10 rounded-[3rem] border border-slate-700 w-full max-w-sm text-center">
            <h2 className="text-xl font-black text-white mb-6 uppercase">YENİ USTA</h2>
            <input className="w-full bg-[#161b2c] border border-slate-700 p-5 rounded-2xl mb-6 text-white font-black uppercase text-center" value={yeniUstaAd} onChange={(e) => setYeniUstaAd(e.target.value)} />
            <button onClick={async () => { await supabase.from('ustalar').insert([{ ad: yeniUstaAd, alan: aktifAlan }]); setYeniUstaAd(''); setShowUstaModal(false); verileriGetir(); }} className="w-full bg-blue-600 p-5 rounded-2xl font-black text-white">KAYDET</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  );
}