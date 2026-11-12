import type { TeamTemplate } from './generator';

// TFF 1. Lig 2026-27: 17 gerçek takım + 3 geçici takım.
// Amed, Arca Çorum ve Erzurumspor Süper Lig verisinde bulunduğu için burada yoktur.
export const LIG1_2026: TeamTemplate[] = [
  { name: 'Bandırmaspor', short: 'BAN', city: 'Balıkesir', color: '#c8102e', stadium: 'Bandırma 17 Eylül Stadyumu', rep: 8, logoUrl: '/clubs/bandirmaspor.svg' },
  { name: 'Batman Petrolspor', short: 'BAT', city: 'Batman', color: '#c8102e', stadium: 'Batman 16 Mayıs Stadyumu', rep: 6, logoUrl: '/clubs/batman-petrol-spor.svg' },
  { name: 'Bodrum FK', short: 'BOD', city: 'Muğla', color: '#0b6e4f', stadium: 'Bodrum İlçe Stadyumu', rep: 9, logoUrl: '/clubs/bodrum-fk.svg' },
  { name: 'Boluspor', short: 'BOL', city: 'Bolu', color: '#c8102e', stadium: 'Bolu Atatürk Stadyumu', rep: 8, logoUrl: '/clubs/boluspor.svg' },
  { name: 'Bursaspor', short: 'BUR', city: 'Bursa', color: '#00a650', stadium: 'Yüzüncü Yıl Atatürk Stadyumu', rep: 10, logoUrl: '/clubs/bursaspor.svg' },
  { name: 'Esenler Erokspor', short: 'ERO', city: 'İstanbul', color: '#1e40af', stadium: 'Esenler Stadyumu', rep: 7, logoUrl: '/clubs/esenler-erokspor.svg' },
  { name: 'Iğdır FK', short: 'IĞD', city: 'Iğdır', color: '#c8102e', stadium: 'Iğdır Şehir Stadyumu', rep: 6, logoUrl: '/clubs/igdir.svg' },
  { name: 'İstanbulspor', short: 'İST', city: 'İstanbul', color: '#f4d21f', stadium: 'Esenyurt Necmi Kadıoğlu Stadyumu', rep: 9, logoUrl: '/clubs/istanbulspor.svg' },
  { name: 'Ankara Keçiörengücü', short: 'KEÇ', city: 'Ankara', color: '#7c2d12', stadium: 'Aktepe Stadyumu', rep: 7, logoUrl: '/clubs/keciorengucu.svg' },
  { name: 'Manisa FK', short: 'MAN', city: 'Manisa', color: '#c8102e', stadium: 'Manisa 19 Mayıs Stadyumu', rep: 8, logoUrl: '/clubs/manisa.svg' },
  { name: 'Mardin 1969 Spor', short: 'MAR', city: 'Mardin', color: '#0891b2', stadium: 'Mardin 21 Kasım Stadyumu', rep: 6, logoUrl: '/clubs/mardin-1969-spor.svg' },
  { name: 'Muğlaspor', short: 'MUĞ', city: 'Muğla', color: '#16a34a', stadium: 'Muğla Atatürk Stadyumu', rep: 6, logoUrl: '/clubs/muglaspor.svg' },
  { name: 'Pendikspor', short: 'PEN', city: 'İstanbul', color: '#c8102e', stadium: 'Pendik Stadyumu', rep: 8, logoUrl: '/clubs/pendikspor.svg' },
  { name: 'Sarıyer', short: 'SAR', city: 'İstanbul', color: '#0891b2', stadium: 'Yusuf Ziya Öniş Stadyumu', rep: 7, logoUrl: '/clubs/sariyer.svg' },
  { name: 'Sivasspor', short: 'SİV', city: 'Sivas', color: '#c8102e', stadium: 'Yeni 4 Eylül Stadyumu', rep: 10, logoUrl: '/clubs/sivasspor.svg' },
  { name: 'Ümraniyespor', short: 'ÜMR', city: 'İstanbul', color: '#c8102e', stadium: 'Ümraniye Hekimbaşı Stadyumu', rep: 8, logoUrl: '/clubs/umraniyespor.svg' },
  { name: 'Vanspor FK', short: 'VAN', city: 'Van', color: '#c8102e', stadium: 'Van Atatürk Stadyumu', rep: 7, logoUrl: '/clubs/van-spor.svg' },
  // Geçici takımlar: logo yok; arayüz kısa takım adını gösterir.
  { name: 'Aydın İncir', short: 'AYD', city: 'Aydın', color: '#84cc16', stadium: 'İncir Stadyumu', rep: 7 },
  { name: 'Balıkesir Körfez', short: 'BAL', city: 'Balıkesir', color: '#06b6d4', stadium: 'Körfez Arena', rep: 7 },
  { name: 'Malatya Kayısı', short: 'MAL', city: 'Malatya', color: '#f97316', stadium: 'Kayısı Park', rep: 8 },
];
