import React, { useState, useEffect } from 'react';

export default function LoadingScreen() {
  const [loadingText, setLoadingText] = useState('AUTHENTICATING BADGE');

  // Cycle through secure, ID-themed loading texts
  useEffect(() => {
    const texts = [
      'AUTHENTICATING BADGE',
      'VERIFYING CREDENTIALS',
      'CHECKING CLEARANCE LEVEL',
      'ESTABLISHING SECURE LINK',
    ];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % texts.length;
      setLoadingText(texts[i]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Simple array to generate a fake barcode pattern
  const barcodePattern = [3, 1, 2, 4, 1, 2, 2, 1, 4, 2, 1, 1, 3, 2, 1, 2, 4, 1, 2, 3, 1, 2];

  return (
    <div className="fixed inset-0 bg-slate-50/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 overflow-hidden font-sans">
      
      {/* Custom Keyframes for Animations */}
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-12px) rotate(1deg); }
          }
          @keyframes scan-vertical {
            0% { top: -5%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 105%; opacity: 0; }
          }
          @keyframes data-flow {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>

      {/* Background ambient glow based on logo colors */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[40%] left-[45%] -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-400/10 rounded-full blur-[80px] pointer-events-none" />

      {/* The Animated ID Badge */}
      <div 
        className="relative w-52 h-[22rem] rounded-2xl bg-white shadow-2xl shadow-slate-300/50 border border-slate-200 flex flex-col overflow-hidden"
        style={{ animation: 'float 4s ease-in-out infinite' }}
      >
        {/* Lanyard Hole (Punch out) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-2 bg-slate-100 rounded-full shadow-inner border border-slate-200/80 z-20" />

        {/* Badge Header with Logo */}
        <div className="pt-8 pb-3 bg-slate-50 flex flex-col items-center border-b border-slate-100 relative">
          <img 
            src="logo.png" 
            alt="Company Logo" 
            className="w-16 h-16 object-contain drop-shadow-sm relative z-10"
          />
        </div>

        {/* Badge Body / Employee Details */}
        <div className="flex-1 p-4 flex flex-col items-center bg-white relative">
          
          {/* Holographic Watermark behind text */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
            <img src="logo.png" alt="" className="w-32 h-32 object-contain grayscale" />
          </div>

          {/* Profile Photo Placeholder */}
          <div className="w-16 h-16 rounded-lg bg-slate-100 border-2 border-slate-200 mb-3 flex items-center justify-center relative overflow-hidden">
            {/* Grid background for the avatar */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:4px_4px]" />
            
            <svg className="w-8 h-8 text-slate-300 mt-2 relative z-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>

          {/* User Info */}
          <div className="text-center w-full z-10">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">System Admin</h3>
            <p className="text-[9px] font-bold text-slate-400 tracking-widest mt-0.5">AUTHORIZATION ID</p>
            <p className="text-xs font-mono text-slate-600 mt-1 bg-slate-50 py-0.5 px-2 inline-block rounded border border-slate-100">
              GL-8042-X
            </p>
          </div>

          {/* Clearance Level Tag */}
          <div className="mt-3 px-2.5 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-bold tracking-widest uppercase rounded-full border border-orange-200">
            Clearance Level 5
          </div>

          {/* Barcode */}
          <div className="mt-auto w-full h-5 flex justify-center gap-[1px] opacity-60">
            {barcodePattern.map((width, idx) => (
              <div key={idx} className="h-full bg-slate-800" style={{ width: `${width * 0.8}px` }} />
            ))}
          </div>
        </div>

        {/* Badge Footer / Loading Status */}
        <div className="bg-[#1e1b4b] p-4 relative overflow-hidden">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-lime-500"></span>
            </div>
            <h2 className="font-mono text-[9px] tracking-[0.1em] text-white font-bold uppercase w-full truncate">
              {loadingText}
            </h2>
          </div>
          
          {/* Animated Progress Bar */}
          <div className="w-full h-1 bg-[#312e81] rounded-full overflow-hidden relative">
            {/* The sweeping gradient bar */}
            <div 
              className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-orange-500 via-lime-500 to-orange-500" 
              style={{ backgroundSize: '200% 100%', animation: 'data-flow 2s infinite linear' }}
            />
          </div>
        </div>

        {/* The Scanning Laser Line Overlay */}
        <div 
          className="absolute left-0 right-0 h-0.5 bg-lime-400 shadow-[0_0_10px_rgba(163,230,53,0.8)] z-50 pointer-events-none mix-blend-screen" 
          style={{ animation: 'scan-vertical 2.5s ease-in-out infinite' }} 
        />
      </div>
      
    </div>
  );
}