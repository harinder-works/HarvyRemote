import React from 'react';

export function YouTubeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export function NetflixIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5.398 0v24c1.171-.274 2.378-.475 3.602-.602V0H5.398zm9.602 0v23.398c1.224.127 2.431.328 3.602.602V0H15zm-4.795 3.197L7.33 23.633a28.91 28.91 0 0 1 2.875-.231l4.496-18.004a44.62 44.62 0 0 0-4.496-2.201z"/>
    </svg>
  );
}

export function DisneyPlusIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.164 12.336c1.408-.344 2.227-1.393 2.227-2.617 0-1.89-1.533-3.08-4.004-3.08H5.5v10.722h5.105c2.617 0 4.391-1.34 4.391-3.328 0-.82-.363-1.422-.969-1.697zm-3.668-3.336h1.723c.898 0 1.57.48 1.57 1.34 0 .848-.672 1.352-1.57 1.352H8.496V9zm1.887 5.723H8.496V12.1h1.887c1.066 0 1.777.535 1.777 1.313 0 .8-.711 1.31-1.777 1.31zm9.367-4.148h-1.352v-1.352h-1.351v1.352h-1.352v1.351h1.352v1.352h1.351v-1.352h1.352z"/>
    </svg>
  );
}

export function HotstarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 1.5l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 15.7l-5.8 3.6 1.6-6.6-5.2-4.4 6.8-.5L12 1.5z" />
    </svg>
  );
}

export function PrimeVideoIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 14c4 4 12 4 16 0"/>
      <path d="M18 13l2 1-1 2"/>
      <path d="M7 8h3a2 2 0 0 1 0 4H7V8z"/>
      <path d="M14 8v4"/>
    </svg>
  );
}

export function SpotifyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export function AppleTvIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.98.6-2.62 1.35-.57.65-1.06 1.71-.93 2.73 1 .08 2.01-.48 2.62-1.23z"/>
    </svg>
  );
}

export function MaxIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span className={`font-black uppercase tracking-tighter text-[11px] leading-none ${className} flex items-center justify-center font-sans`}>
      MAX
    </span>
  );
}

export function JioCinemaIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <polygon points="10,8 16,12 10,16" fill="white" />
    </svg>
  );
}

export function SonyLivIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <div className={`font-black text-[9px] tracking-tight uppercase leading-none ${className} flex items-center justify-center font-sans`}>
      LIV
    </div>
  );
}

export function Zee5Icon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <div className={`font-black text-[9px] tracking-tight uppercase leading-none ${className} flex items-center justify-center font-sans`}>
      ZEE5
    </div>
  );
}

export function HuluIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span className={`font-black lowercase tracking-tighter text-xs ${className} flex items-center justify-center font-sans`}>
      hulu
    </span>
  );
}

export function ParamountIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2L3 20h18L12 2zm0 4.5l5.5 11h-11L12 6.5z"/>
    </svg>
  );
}

export function PeacockIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="8" r="3" />
      <circle cx="7" cy="12" r="2.5" />
      <circle cx="17" cy="12" r="2.5" />
      <circle cx="9" cy="17" r="2" />
      <circle cx="15" cy="17" r="2" />
    </svg>
  );
}

export function TwitchIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
    </svg>
  );
}

export function CrunchyrollIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="14" cy="12" r="4.5" />
    </svg>
  );
}

export function TubiIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <span className={`font-black lowercase tracking-tighter text-xs ${className} flex items-center justify-center font-sans`}>
      tubi
    </span>
  );
}

export function GoogleDots({ className = "w-6 h-6", active = false }: { className?: string; active?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      <span className={`w-2 h-2 rounded-full bg-[#4285F4] ${active ? 'assistant-dot-1' : ''}`} />
      <span className={`w-2 h-2 rounded-full bg-[#EA4335] ${active ? 'assistant-dot-2' : ''}`} />
      <span className={`w-2 h-2 rounded-full bg-[#FBBC05] ${active ? 'assistant-dot-3' : ''}`} />
      <span className={`w-2 h-2 rounded-full bg-[#34A853] ${active ? 'assistant-dot-4' : ''}`} />
    </div>
  );
}

export function WebsiteEmblem({ className = "w-6 h-4 text-slate-400" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 62"
      fill="currentColor"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask id="remoteEmblemMask">
          <rect width="100" height="62" fill="white" />
          {/* Diagonal separation gap cut at bottom-left of the right ring */}
          <polygon points="49.5,39 53.5,35 44.5,53 40.5,49" fill="black" />
        </mask>
      </defs>

      {/* Left Ring */}
      <path
        fillRule="evenodd"
        d="M 33.5,3.5 A 27.5,27.5 0 1,0 33.5,58.5 A 27.5,27.5 0 1,0 33.5,3.5 Z M 33.5,15 A 16,16 0 1,1 33.5,47 A 16,16 0 1,1 33.5,15 Z"
      />

      {/* Right Ring (with diagonal gap cut to interlock) */}
      <g mask="url(#remoteEmblemMask)">
        <path
          fillRule="evenodd"
          d="M 66.5,3.5 A 27.5,27.5 0 1,0 66.5,58.5 A 27.5,27.5 0 1,0 66.5,3.5 Z M 66.5,15 A 16,16 0 1,1 66.5,47 A 16,16 0 1,1 66.5,15 Z"
        />
      </g>

      {/* Solid Center Dot in Right Ring */}
      <circle cx="66.5" cy="31" r="8.8" />
    </svg>
  );
}

export function GoogleGLogo({ className = "w-4 h-4 text-slate-400" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v4H7v2h4v4h2v-4h4v-2h-4z" opacity="0"/>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
    </svg>
  );
}

export function AppIconRenderer({ iconType, className = "w-4 h-4" }: { iconType: string; className?: string }) {
  switch (iconType) {
    case 'youtube':
      return <YouTubeIcon className={className} />;
    case 'netflix':
      return <NetflixIcon className={className} />;
    case 'disney':
      return <DisneyPlusIcon className={className} />;
    case 'hotstar':
      return <HotstarIcon className={className} />;
    case 'prime':
      return <PrimeVideoIcon className={className} />;
    case 'spotify':
      return <SpotifyIcon className={className} />;
    case 'twitch':
      return <TwitchIcon className={className} />;
    case 'apple':
      return <AppleTvIcon className={className} />;
    case 'hulu':
      return <HuluIcon className={className} />;
    case 'max':
      return <MaxIcon className={className} />;
    case 'crunchyroll':
      return <CrunchyrollIcon className={className} />;
    case 'peacock':
      return <PeacockIcon className={className} />;
    case 'paramount':
      return <ParamountIcon className={className} />;
    case 'jiocinema':
      return <JioCinemaIcon className={className} />;
    case 'sonyliv':
      return <SonyLivIcon className={className} />;
    case 'zee5':
      return <Zee5Icon className={className} />;
    case 'tubi':
      return <TubiIcon className={className} />;
    default:
      return <span className={`font-bold uppercase text-[10px] ${className}`}>TV</span>;
  }
}
