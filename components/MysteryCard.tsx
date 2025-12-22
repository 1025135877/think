import React from 'react';
import { MysteryData } from '../types';

interface MysteryCardProps {
  mystery: MysteryData | null;
  isExpanded: boolean;
  onToggle: () => void;
}

export const MysteryCard: React.FC<MysteryCardProps> = ({ mystery, isExpanded, onToggle }) => {
  if (!mystery) return null;

  return (
    <div 
      className={`
        shrink-0 w-full transition-all duration-700 ease-in-out bg-slate-950/60 border-b border-white/5 backdrop-blur-3xl relative z-10
        ${isExpanded ? 'max-h-[50vh] overflow-y-auto' : 'max-h-[72px] overflow-hidden cursor-pointer hover:bg-white/[0.02]'}
      `}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className="max-w-4xl mx-auto px-8 py-5 md:px-12">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-5 min-w-0">
                <span className="shrink-0 text-[9px] font-black tracking-[0.2em] text-violet-400 uppercase bg-violet-400/5 border border-violet-400/20 px-3 py-1 rounded-full">
                    {mystery.difficulty}
                </span>
                <h2 className="text-base md:text-xl font-black text-white font-serif tracking-tight truncate uppercase">
                    {mystery.title}
                </h2>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={`p-2 rounded-full transition-all ${isExpanded ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-white'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </button>
        </div>
        
        <div className={`
            mt-8 text-slate-400 font-serif leading-relaxed text-base transition-all duration-500 transform
            ${isExpanded ? 'opacity-100 translate-y-0 pb-8' : 'opacity-0 -translate-y-4 h-0 overflow-hidden'}
        `}>
          <div className="p-8 bg-white/[0.02] rounded-[2rem] border border-white/5 italic relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/30"></div>
            <p className="relative z-10 leading-loose text-slate-300">
              {mystery.situation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};