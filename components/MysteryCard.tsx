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
        shrink-0 w-full transition-all duration-500 ease-in-out bg-mystery-800 border-b border-mystery-700/50 shadow-2xl relative z-10
        ${isExpanded ? 'max-h-[50vh] overflow-y-auto' : 'max-h-[64px] overflow-hidden cursor-pointer hover:bg-mystery-700/30'}
      `}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className="max-w-4xl mx-auto px-4 py-4 md:px-6">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 text-[10px] font-black tracking-tighter text-mystery-accent uppercase bg-mystery-900/80 border border-mystery-700/50 px-2 py-0.5 rounded italic">
                    {mystery.difficulty}
                </span>
                <h2 className="text-sm md:text-base font-bold text-slate-100 font-serif tracking-tight truncate">
                    {mystery.title}
                </h2>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className={`p-1.5 rounded-full transition-colors ${isExpanded ? 'bg-mystery-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
                {isExpanded ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                     <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                   </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                )}
            </button>
        </div>
        
        <div className={`
            mt-4 text-slate-400 font-serif leading-relaxed text-sm md:text-base transition-all duration-300 transform
            ${isExpanded ? 'opacity-100 translate-y-0 pb-4' : 'opacity-0 -translate-y-2 h-0 overflow-hidden'}
        `}>
          <div className="p-4 bg-mystery-900/40 rounded-2xl border border-mystery-700/30 italic">
            {mystery.situation}
          </div>
        </div>
      </div>
    </div>
  );
};