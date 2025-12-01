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
        relative z-10 w-full transition-all duration-300 ease-in-out bg-mystery-800 border-b border-mystery-700 shadow-xl
        ${isExpanded ? 'max-h-96' : 'max-h-16 overflow-hidden cursor-pointer hover:bg-mystery-700/50'}
      `}
      onClick={!isExpanded ? onToggle : undefined}
    >
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-3">
                <span className="text-xs font-bold tracking-wider text-mystery-accent uppercase bg-mystery-900/50 px-2 py-1 rounded">
                    {mystery.difficulty}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-slate-100 font-serif tracking-wide">
                    {mystery.title}
                </h2>
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                className="text-slate-400 hover:text-white p-1"
            >
                {isExpanded ? (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                   </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                )}
            </button>
        </div>
        
        <div className={`
            text-slate-300 font-serif leading-relaxed text-base md:text-lg transition-opacity duration-300
            ${isExpanded ? 'opacity-100' : 'opacity-60 line-clamp-1'}
        `}>
          {mystery.situation}
        </div>
      </div>
    </div>
  );
};