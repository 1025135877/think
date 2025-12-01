
import React, { useEffect, useRef } from 'react';
import { ChatMessage, AnswerType } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-6 w-full max-w-4xl mx-auto scroll-smooth custom-scrollbar">
      {messages.length === 0 && (
        <div className="text-center text-slate-500 mt-20 italic animate-fade-in space-y-2">
            <p>迷局已设。</p>
            <p>从左侧选择人物进行对话，或向“上帝视角”提问是/否问题。</p>
        </div>
      )}

      {messages.map((msg) => {
        if (msg.type === 'clue_alert') {
            return (
                <div key={msg.id} className="flex justify-center animate-fade-in">
                    <div className="bg-emerald-900/40 border border-emerald-500/50 text-emerald-200 px-4 py-2 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        {msg.content}
                    </div>
                </div>
            )
        }

        return (
            <div 
            key={msg.id} 
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in items-end gap-3`}
            >
            {/* NPC Avatar for AI messages if available */}
            {msg.type === 'ai_response' && msg.avatarUrl && (
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-mystery-700 shadow-lg relative bg-mystery-900">
                    <img src={msg.avatarUrl} alt={msg.speakerName} className="w-full h-full object-cover" />
                </div>
            )}
            {/* Fallback avatar for GM/No Image */}
            {msg.type === 'ai_response' && !msg.avatarUrl && msg.speakerName && (
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-mystery-700 shadow-lg bg-mystery-800 flex items-center justify-center text-xs font-bold text-slate-500">
                    {msg.speakerName === '案情提要' ? '📝' : 'GM'}
                </div>
            )}

            <div 
                className={`
                max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3 shadow-md relative
                ${msg.type === 'user' 
                    ? 'bg-mystery-700 text-slate-100 rounded-br-none' 
                    : 'bg-mystery-800 text-slate-300 rounded-bl-none border border-mystery-700'
                }
                ${msg.answerType === AnswerType.CORRECT ? 'border-mystery-warning/50 bg-mystery-warning/10' : ''}
                `}
            >
                {/* Speaker Label */}
                {msg.speakerName && !msg.avatarUrl && (
                    <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1 font-bold">
                        {msg.speakerName}
                    </div>
                )}
                {/* Speaker Label for Avatar (optional, maybe redundant if avatar is clear, but good for names) */}
                {msg.type === 'ai_response' && msg.avatarUrl && (
                     <div className="text-[10px] uppercase tracking-wider opacity-50 mb-1 font-bold">
                     {msg.speakerName}
                 </div>
                )}


                {msg.type === 'ai_response' && msg.answerType !== AnswerType.NPC_DIALOGUE && (
                <div className={`text-xs uppercase tracking-widest mb-1 ${getAnswerColor(msg.answerType)}`}>
                    {getAnswerLabel(msg.answerType)}
                </div>
                )}
                
                <p className={`leading-relaxed whitespace-pre-wrap ${msg.answerType === AnswerType.NPC_DIALOGUE ? 'font-serif text-sky-100 italic' : ''}`}>
                    {msg.answerType === AnswerType.NPC_DIALOGUE && <span className="text-sky-500 not-italic mr-1">❝</span>}
                    {msg.content}
                    {msg.answerType === AnswerType.NPC_DIALOGUE && <span className="text-sky-500 not-italic ml-1">❞</span>}
                </p>
            </div>
            </div>
        );
      })}

      {isLoading && (
        <div className="flex justify-start animate-fade-in pl-14">
          <div className="bg-mystery-800 rounded-2xl rounded-bl-none px-5 py-4 border border-mystery-700 flex items-center gap-2">
            <div className="w-2 h-2 bg-mystery-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-mystery-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-mystery-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
};
