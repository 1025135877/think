import React, { useEffect, useRef } from 'react';
import { ChatMessage, AnswerType } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Small timeout ensures that the DOM has updated before scrolling
    const timer = setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  const getAnswerColor = (type?: AnswerType) => {
    switch (type) {
      case AnswerType.YES: return 'text-mystery-success font-bold';
      case AnswerType.NO: return 'text-mystery-error font-bold';
      case AnswerType.CORRECT: return 'text-mystery-warning font-bold text-lg';
      case AnswerType.HINT: return 'text-mystery-accent italic';
      case AnswerType.NPC_DIALOGUE: return 'text-sky-300';
      default: return 'text-slate-300';
    }
  };

  const getAnswerLabel = (type?: AnswerType) => {
     switch(type) {
         case AnswerType.YES: return '是';
         case AnswerType.NO: return '否';
         case AnswerType.IRRELEVANT: return '无关';
         case AnswerType.HINT: return '提示';
         case AnswerType.CLARIFICATION: return '系统';
         case AnswerType.CORRECT: return '正确';
         default: return type;
     }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 w-full max-w-4xl mx-auto scroll-smooth custom-scrollbar">
      {messages.length === 0 && (
        <div className="text-center text-slate-600 mt-20 italic animate-fade-in space-y-3 px-8">
            <div className="text-3xl mb-4 opacity-20">🕯️</div>
            <p className="text-sm">迷局已设，真相隐于迷雾之中。</p>
            <p className="text-[10px] tracking-widest uppercase">从左侧选择人物进行对话，或向上帝视角提问</p>
        </div>
      )}

      {messages.map((msg) => {
        if (msg.type === 'clue_alert') {
            return (
                <div key={msg.id} className="flex justify-center animate-fade-in py-2">
                    <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-6 py-1.5 rounded-full text-[10px] font-bold tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.1)] uppercase">
                        🔍 {msg.content}
                    </div>
                </div>
            )
        }

        const isUser = msg.type === 'user';

        return (
            <div 
            key={msg.id} 
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in items-end gap-2.5 md:gap-4`}
            >
            {!isUser && (
                <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-mystery-700 shadow-md bg-mystery-800 flex items-center justify-center">
                    {msg.avatarUrl ? (
                        <img src={msg.avatarUrl} alt={msg.speakerName} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-[10px]">{msg.speakerName === '案情提要' ? '📜' : '⚖️'}</span>
                    )}
                </div>
            )}

            <div 
                className={`
                max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm
                ${isUser 
                    ? 'bg-mystery-accent text-white rounded-br-none' 
                    : 'bg-mystery-800 text-slate-300 rounded-bl-none border border-mystery-700/50'
                }
                ${msg.answerType === AnswerType.CORRECT ? 'border-mystery-warning/50 bg-mystery-warning/10 ring-1 ring-mystery-warning/20' : ''}
                `}
            >
                {!isUser && msg.speakerName && (
                     <div className="text-[9px] uppercase tracking-[0.15em] opacity-40 mb-1 font-black flex justify-between">
                        <span>{msg.speakerName}</span>
                        {msg.answerType && msg.answerType !== AnswerType.NPC_DIALOGUE && (
                             <span className={getAnswerColor(msg.answerType)}>{getAnswerLabel(msg.answerType)}</span>
                        )}
                    </div>
                )}
                
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.answerType === AnswerType.NPC_DIALOGUE ? 'font-serif italic text-sky-100' : ''}`}>
                    {msg.content}
                </p>
            </div>

            {isUser && (
                 <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-mystery-700 shadow-md bg-mystery-700 flex items-center justify-center">
                     <span className="text-[10px] opacity-50">YOU</span>
                 </div>
            )}
            </div>
        );
      })}

      {isLoading && (
        <div className="flex justify-start animate-fade-in pl-10 md:pl-14">
          <div className="bg-mystery-800 rounded-2xl rounded-bl-none px-4 py-3 border border-mystery-700/50 flex items-center gap-1.5 shadow-sm">
            <div className="w-1.5 h-1.5 bg-mystery-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 bg-mystery-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 bg-mystery-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
      <div ref={endRef} className="h-4 shrink-0" />
    </div>
  );
};