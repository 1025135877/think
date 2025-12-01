
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
    <div className="absolute bottom-0 left-0 w-full bg-mystery-900/90 backdrop-blur-md border-t border-mystery-700 p-4 z-20">
      <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={phase === GamePhase.LOADING ? "正在生成迷局..." : "在此输入你的问题..."}
                disabled={!isPlaying}
                className="flex-1 bg-mystery-800 text-slate-100 placeholder-slate-500 border border-mystery-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-mystery-accent focus:border-transparent transition-all disabled:opacity-50"
            />
            <button
                type="submit"
                disabled={!isPlaying || !input.trim()}
                className="bg-mystery-700 hover:bg-mystery-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 transition-colors flex items-center justify-center min-w-[3rem]"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
            </button>
            </form>
      </div>
    </div>
  );
};
