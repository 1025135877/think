import React, { useState } from 'react';
import { GamePhase } from '../types';

interface InputAreaProps {
  onSend: (text: string) => void;
  onNewGame: () => void;
  phase: GamePhase;
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend, onNewGame, phase }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || phase !== GamePhase.PLAYING) return;
    onSend(input);
    setInput('');
  };

  const isPlaying = phase === GamePhase.PLAYING;
  
  if (phase === GamePhase.SOLVING || phase === GamePhase.ENDED || phase === GamePhase.FAILED) return null;

  return (
    <div className="shrink-0 w-full bg-mystery-900 border-t border-mystery-700/50 p-4 z-10 safe-area-bottom">
      <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={phase === GamePhase.LOADING ? "正在生成迷局..." : "提出你的疑问..."}
                disabled={!isPlaying}
                className="flex-1 bg-mystery-800/80 text-slate-100 placeholder-slate-600 border border-mystery-700 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-mystery-accent focus:border-transparent transition-all disabled:opacity-50 shadow-inner"
            />
            <button
                type="submit"
                disabled={!isPlaying || !input.trim()}
                className="bg-mystery-accent hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-mystery-accent text-white rounded-2xl px-5 py-3.5 transition-all flex items-center justify-center shadow-lg active:scale-95"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
            </button>
            </form>
      </div>
    </div>
  );
};