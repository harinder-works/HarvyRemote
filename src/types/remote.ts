export type RemoteTheme = 'snow' | 'sky' | 'sunrise' | 'charcoal';

export interface AppShortcut {
  id: string;
  name: string;
  shortLabel: string;
  iconType:
    | 'youtube'
    | 'netflix'
    | 'hotstar'
    | 'prime'
    | 'disney'
    | 'spotify'
    | 'apple'
    | 'twitch'
    | 'hulu'
    | 'max'
    | 'crunchyroll'
    | 'peacock'
    | 'paramount'
    | 'jiocinema'
    | 'sonyliv'
    | 'zee5'
    | 'tubi'
    | 'custom';
  brandColor: string;
  textColor: string;
  category: string;
  tagline: string;
  heroColor: string;
}

export const PRESET_APPS: AppShortcut[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    shortLabel: 'YouTube',
    iconType: 'youtube',
    brandColor: '#FF0000',
    textColor: '#FFFFFF',
    category: 'Video',
    tagline: 'Stream videos, creators, music & live podcasts',
    heroColor: 'from-red-950 via-slate-950 to-black',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    shortLabel: 'Netflix',
    iconType: 'netflix',
    brandColor: '#E50914',
    textColor: '#E50914',
    category: 'Movies & Series',
    tagline: 'Unlimited films, TV programmes and award-winning originals',
    heroColor: 'from-rose-950 via-black to-black',
  },
  {
    id: 'hotstar',
    name: 'Disney+ Hotstar',
    shortLabel: 'Hotstar',
    iconType: 'hotstar',
    brandColor: '#1259D4',
    textColor: '#FFFFFF',
    category: 'Live Sports & Movies',
    tagline: 'Cricket live, Disney, blockbuster movies and series',
    heroColor: 'from-blue-950 via-slate-950 to-black',
  },
  {
    id: 'prime',
    name: 'Prime Video',
    shortLabel: 'Prime Video',
    iconType: 'prime',
    brandColor: '#00A8E1',
    textColor: '#FFFFFF',
    category: 'Streaming',
    tagline: 'Amazon Originals, blockbuster hits & sports live',
    heroColor: 'from-cyan-950 via-slate-950 to-black',
  },
  {
    id: 'disney',
    name: 'Disney+',
    shortLabel: 'Disney+',
    iconType: 'disney',
    brandColor: '#113CCF',
    textColor: '#FFFFFF',
    category: 'Entertainment',
    tagline: 'Disney, Pixar, Marvel, Star Wars & National Geographic',
    heroColor: 'from-blue-950 via-indigo-950 to-black',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    shortLabel: 'Spotify',
    iconType: 'spotify',
    brandColor: '#1DB954',
    textColor: '#FFFFFF',
    category: 'Music & Podcasts',
    tagline: 'Millions of songs, playlists, and audiobooks',
    heroColor: 'from-emerald-950 via-slate-950 to-black',
  },
  {
    id: 'apple',
    name: 'Apple TV',
    shortLabel: 'Apple TV',
    iconType: 'apple',
    brandColor: '#2D2D2D',
    textColor: '#FFFFFF',
    category: 'Originals',
    tagline: 'Award-winning Apple Original series and movies',
    heroColor: 'from-slate-900 via-slate-950 to-black',
  },
  {
    id: 'max',
    name: 'Max (HBO)',
    shortLabel: 'Max',
    iconType: 'max',
    brandColor: '#002BE7',
    textColor: '#FFFFFF',
    category: 'HBO & Warner',
    tagline: 'HBO originals, Warner Bros movies, and DC Universe',
    heroColor: 'from-blue-900 via-slate-950 to-black',
  },
  {
    id: 'jiocinema',
    name: 'JioCinema',
    shortLabel: 'JioCinema',
    iconType: 'jiocinema',
    brandColor: '#D81977',
    textColor: '#FFFFFF',
    category: 'Entertainment & Sports',
    tagline: 'Live cricket, HBO, Peacock and premium cinema',
    heroColor: 'from-pink-950 via-slate-950 to-black',
  },
  {
    id: 'sonyliv',
    name: 'Sony LIV',
    shortLabel: 'SonyLIV',
    iconType: 'sonyliv',
    brandColor: '#307FE2',
    textColor: '#FFFFFF',
    category: 'Live TV & Sports',
    tagline: 'Live sports, UEFA, tennis and Sony entertainment originals',
    heroColor: 'from-blue-950 via-slate-950 to-black',
  },
  {
    id: 'zee5',
    name: 'ZEE5',
    shortLabel: 'ZEE5',
    iconType: 'zee5',
    brandColor: '#802682',
    textColor: '#FFFFFF',
    category: 'Movies & TV',
    tagline: 'Blockbusters, exclusive web series and live regional news',
    heroColor: 'from-purple-950 via-slate-950 to-black',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    shortLabel: 'Hulu',
    iconType: 'hulu',
    brandColor: '#1CE783',
    textColor: '#0B3B24',
    category: 'Live TV & Shows',
    tagline: 'Current seasons, FX shows, and classic cinema',
    heroColor: 'from-teal-950 via-slate-950 to-black',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    shortLabel: 'Paramount+',
    iconType: 'paramount',
    brandColor: '#0064FF',
    textColor: '#FFFFFF',
    category: 'Movies & Live CBS',
    tagline: 'Star Trek, Paramount blockbusters & live NFL football',
    heroColor: 'from-blue-950 via-slate-950 to-black',
  },
  {
    id: 'peacock',
    name: 'Peacock',
    shortLabel: 'Peacock',
    iconType: 'peacock',
    brandColor: '#00833E',
    textColor: '#FFFFFF',
    category: 'Live TV & Movies',
    tagline: 'NBCUniversal hits, Premier League & exclusive originals',
    heroColor: 'from-emerald-950 via-slate-950 to-black',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    shortLabel: 'Twitch',
    iconType: 'twitch',
    brandColor: '#9146FF',
    textColor: '#FFFFFF',
    category: 'Live Streams',
    tagline: 'Watch gamers, esports, and interactive creative streams',
    heroColor: 'from-purple-950 via-slate-950 to-black',
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll',
    shortLabel: 'Crunchyroll',
    iconType: 'crunchyroll',
    brandColor: '#F47521',
    textColor: '#FFFFFF',
    category: 'Anime',
    tagline: "World's largest anime library straight from Japan",
    heroColor: 'from-amber-950 via-slate-950 to-black',
  },
  {
    id: 'tubi',
    name: 'Tubi TV',
    shortLabel: 'Tubi',
    iconType: 'tubi',
    brandColor: '#FA3246',
    textColor: '#FFFFFF',
    category: 'Free Movies & TV',
    tagline: 'Free movies, streaming TV channels with zero subscription',
    heroColor: 'from-rose-950 via-slate-950 to-black',
  },
];
