"use client";
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
  const [saatInput, setSaatInput] = useState<string>('');

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
    yon === 'ileri' ? yeni.setMonth(yeni.getMonth() + 1) : yeni.setMonth(yeni.getMonth() - 1);
    setSeciliTarih(yeni);
  };

  const handleLogin = () => {
    if (loginSifre === ADMIN_SIFRE) { setIsLoggedIn(true); setError(false); }
    else { setError(true); setLoginSifre(''); setTimeout(() => setError(false), 2000); }
  };

  async function verileriGetir() {
    const { data: a } = await supabase.from('alanlar').select('*').order('ad');
    const { data: u } = await supabase.from('ustalar').select('*').order('ad');
    const { data: p } = await supabase.from('puantaj').select('*').match({ yil, ay });
    if (a) setAlanlar(a); if (u) setUstalar(u); if (p) setPuantajlar(p);
    if (a && a.length > 0 && !aktifAlan) setAktifAlan(a[0].ad);
  }

  async function syncVeri() {
    const { data: p } = await supabase.from('puantaj').select('*').match({ yil, ay });
    const { data: u } = await supabase.from('ustalar').select('*');
    const { data: a } = await supabase.from('alanlar').select('*');
    if (p) setPuantajlar(p); if (u) setUstalar(u); if (a) setAlanlar(a);
  }

  async function alanEkle() {
    if (!yeniAlanAd.trim()) return;
    await supabase.from('alanlar').insert([{ ad: yeniAlanAd.trim() }]);
    setYeniAlanAd(''); setShowAlanModal(false); verileriGetir();
  }

  async function ustaEkle() {
    if (!yeniUstaAd.trim()) return;
    await supabase.from('ustalar').insert([{ ad: yeniUstaAd.trim(), alan: aktifAlan }]);
    setYeniUstaAd(''); setShowUstaModal(false); verileriGetir();
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

  // DÜZELTİLEN KAYIT FONKSİYONU
  async function puantajKaydet(tip: string, deger?: number) {
    if (!seciliDetay) return;
    
    if (tip === 'sil') {
      await supabase.from('puantaj').delete().match({