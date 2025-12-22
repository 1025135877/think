
import React, { useState, useEffect, useCallback } from 'react';
import { generateMystery, judgeInput, evaluateSolution } from './services/geminiService';
import { MysteryCard } from './components/MysteryCard';
import { ChatInterface } from './components/ChatInterface';
import { InputArea } from './components/InputArea';
import { GamePhase, MysteryData, ChatMessage, AnswerType, EndingEvaluation } from './types';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.IDLE);
  const [mystery, setMystery] = useState<MysteryData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTarget, setActiveTarget] = useState<string>('GM');
  const [unlockedClues, setUnlockedClues] = useState<Set<string>>(new Set());
  const [showCluePanel, setShowCluePanel] = useState(false);
  const [isMysteryExpanded, setIsMysteryExpanded] = useState(false);
  const [finalTheory, setFinalTheory] = useState('');
  const [endingResult, setEndingResult] = useState<EndingEvaluation | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) setHasApiKey(true);
      } else if (process.env.API_KEY) {
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const startNewGame = useCallback(async () => {
    setPhase(GamePhase.LOADING);
    setMessages([]);
    setMystery(null);
    setUnlockedClues(new Set());
    setEndingResult(null);
    setFinalTheory('');
    setActiveTarget('GM');
    setIsProcessing(true);

    try {
      const data = await generateMystery();
      setMystery(data);
      setMessages([{
        id: 'init-situation',
        type: 'ai_response',
        content: `【案件概要】\n${data.situation}`,
        speakerName: '案情提要',
        answerType: AnswerType.CLARIFICATION
      }]);
      setPhase(GamePhase.PLAYING);
    } catch (error: any) {
      console.error("Game creation failed:", error);
      if (error.message === "KEY_RESELECT_REQUIRED") {
        setHasApiKey(false);
        alert("API 密钥权限不足或无效。请确保使用已启用 Gemini API 的 API 密钥。");
      }
      setPhase(GamePhase.FAILED);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    if (hasApiKey && phase === GamePhase.IDLE) {
      startNewGame();
    }
  }, [hasApiKey, phase, startNewGame]);

  const handlePlayerInput = async (text: string) => {
    if (!mystery || phase !== GamePhase.PLAYING) return;

    const targetNPC = mystery.npcs.find(n => n.id === activeTarget);
    const targetName = activeTarget === 'GM' ? '上帝视角 (GM)' : targetNPC?.name || '未知';

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      speakerName: `对 ${targetName}`
    }]);
    setIsProcessing(true);

    try {
      const historyContext = messages.slice(-5).map(m => m.content);
      const judgment = await judgeInput(mystery, text, activeTarget, historyContext);

      if (judgment.unlockedClueId && !unlockedClues.has(judgment.unlockedClueId)) {
        setUnlockedClues(prev => new Set(prev).add(judgment.unlockedClueId!));
        const clue = mystery.clues.find(c => c.id === judgment.unlockedClueId);
        if (clue) {
            setMessages(prev => [...prev, {
                id: 'clue-' + Date.now(),
                type: 'clue_alert',
                content: `🔍 关键线索已获得: ${clue.title}`,
            }]);
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'ai_response',
        content: judgment.reply,
        answerType: judgment.answerType,
        speakerName: targetName,
        avatarUrl: targetNPC?.avatarUrl
      }]);
    } catch (error: any) {
      console.error("Interaction failed:", error);
      if (error.message === "KEY_RESELECT_REQUIRED") {
        setHasApiKey(false);
        alert("API 密钥权限不足或无效，请重新选择。");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSolveAttempt = async () => {
    if (!mystery || !finalTheory.trim()) return;
    setIsProcessing(true);
    try {
        const result = await evaluateSolution(mystery, finalTheory);
        setEndingResult(result);
        setPhase(GamePhase.ENDED);
    } catch (e: any) {
        console.error(e);
        if (e.message === "KEY_RESELECT_REQUIRED") {
            setHasApiKey(false);
            alert("API 密钥权限不足或无效，请重新选择。");
        }
    } finally {
        setIsProcessing(false);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="flex h-screen w-full bg-[#0f172a] bg-mystery-900 items-center justify-center p-4">
        <div className="bg-slate-800/90 bg-mystery-800 p-8 rounded-2xl border border-slate-700 border-mystery-700 shadow-2xl max-w-md w-full text-center space-y-8 animate-fade-in backdrop-blur-md">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto border border-slate-600">
            <span className="text-4xl">🕵️</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-slate-100">Enigma AI</h1>
            <p className="text-violet-400 text-mystery-accent text-sm font-bold tracking-widest uppercase">沉浸式推理剧场</p>
          </div>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              欢迎进入迷局。请先连接您的 Google AI Studio 密钥以开启一段独特的推理旅程。
            </p>
            <button 
                onClick={handleSelectKey}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
                🔑 连接 Google AI Studio
            </button>
            <p className="text-[10px] text-slate-500 italic">
                建议使用已启用计费的项目密钥以获得最佳体验。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0f172a] bg-mystery-900 font-sans overflow-hidden text-slate-200">
      
      {/* 渐变遮罩增强氛围感 */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_rgba(139,92,246,0.03)_0%,_rgba(15,23,42,0)_100%)] z-0" />

      {/* Mobile Overlay */}
      {showCluePanel && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden animate-fade-in"
          onClick={() => setShowCluePanel(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative z-30 w-72 h-full bg-[#1e293b] bg-mystery-800 border-r border-slate-700/50 border-mystery-700 transform transition-transform duration-300 flex flex-col shadow-2xl
        ${showCluePanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-slate-700/50 bg-[#0f172a]/50 flex justify-between items-center shrink-0">
            <h2 className="font-serif font-bold text-violet-400 text-lg">调查手册</h2>
            <button onClick={() => setShowCluePanel(false)} className="md:hidden text-slate-400 p-2 hover:bg-slate-700 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar z-10">
            {phase === GamePhase.PLAYING && mystery && (
                <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">询问对象</p>
                    <button 
                        onClick={() => { setActiveTarget('GM'); setShowCluePanel(false); }}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3
                        ${activeTarget === 'GM' ? 'bg-violet-500/20 border-violet-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">👻</div>
                        <div>
                            <div className="font-bold text-xs">上帝视角</div>
                            <div className="text-[10px] opacity-70">Yes/No/无关</div>
                        </div>
                    </button>

                    {mystery.npcs.map(npc => (
                        <button 
                            key={npc.id}
                            onClick={() => { setActiveTarget(npc.id); setShowCluePanel(false); }}
                            className={`w-full text-left p-2 rounded-xl border transition-all flex items-center gap-3 relative overflow-hidden
                            ${activeTarget === npc.id ? 'bg-violet-500/20 border-violet-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                        >
                             <div className="w-10 h-10 rounded-full bg-indigo-900 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-600 z-10 shadow-md">
                                {npc.avatarUrl ? (
                                    <img src={npc.avatarUrl} alt={npc.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-bold">{npc.name.charAt(0)}</span>
                                )}
                             </div>
                             <div className="z-10 min-w-0">
                                <div className="font-bold text-xs truncate">{npc.name}</div>
                                <div className="text-[10px] opacity-90 font-serif italic truncate">{npc.role}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">关键线索</p>
                {unlockedClues.size === 0 ? (
                    <div className="text-center p-6 border border-dashed border-slate-700 rounded-xl text-slate-600 text-[10px] italic">
                        随着调查深入，线索将在此显现...
                    </div>
                ) : (
                    <div className="space-y-2">
                        {mystery?.clues.map(clue => {
                            if (!unlockedClues.has(clue.id)) return null;
                            return (
                                <div key={clue.id} className="bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-xl text-[11px] animate-fade-in backdrop-blur-sm">
                                    <div className="text-emerald-400 font-bold mb-1 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500" /> {clue.title}
                                    </div>
                                    <div className="text-slate-400 leading-relaxed italic">{clue.description}</div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>

        {phase === GamePhase.PLAYING && (
            <div className="p-4 border-t border-slate-700/50 bg-[#0f172a]/50 shrink-0">
                <button 
                    onClick={() => { setPhase(GamePhase.SOLVING); setShowCluePanel(false); }}
                    className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-700 text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition-all uppercase tracking-widest text-[10px]"
                >
                    终结调查
                </button>
            </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Mobile Navbar */}
        <div className="md:hidden h-14 bg-[#1e293b] border-b border-slate-700/50 flex items-center px-4 justify-between shrink-0 z-20 shadow-xl">
             <span className="font-serif font-bold text-slate-100 tracking-tight">Enigma AI</span>
             <button onClick={() => setShowCluePanel(true)} className="text-violet-400 text-xs font-bold flex items-center gap-1.5 bg-slate-700/50 px-3 py-1.5 rounded-full border border-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                手册
             </button>
        </div>

        {phase === GamePhase.LOADING ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-6 p-8">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-violet-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <div className="text-center space-y-2">
                    <p className="animate-pulse tracking-[0.3em] uppercase text-[10px] font-bold text-violet-400">正在编织谜团...</p>
                    <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed italic">Gemini 正在细致刻画每一个嫌疑人的面容与动机...</p>
                </div>
             </div>
        ) : phase === GamePhase.SOLVING ? (
            <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center animate-fade-in overflow-y-auto">
                <div className="max-w-xl w-full space-y-8 py-8">
                    <div className="text-center space-y-3">
                        <h2 className="text-3xl font-serif text-slate-100">审判时刻</h2>
                        <p className="text-slate-400 text-sm italic">请拼凑你掌握的所有线索。一旦提交，真相将定格。</p>
                    </div>
                    <textarea 
                        value={finalTheory}
                        onChange={(e) => setFinalTheory(e.target.value)}
                        className="w-full h-64 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all resize-none shadow-inner text-sm leading-relaxed backdrop-blur-sm"
                        placeholder="在此处写下你对真相的完整推理..."
                    />
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setPhase(GamePhase.PLAYING)}
                            className="flex-1 py-4 text-slate-500 hover:text-slate-300 font-bold transition-colors text-sm"
                        >
                            返回搜证
                        </button>
                        <button 
                            onClick={handleSolveAttempt}
                            disabled={!finalTheory.trim() || isProcessing}
                            className="flex-1 py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl shadow-xl disabled:opacity-50 transition-all text-sm"
                        >
                            {isProcessing ? '正在判定...' : '提交真相'}
                        </button>
                    </div>
                </div>
            </div>
        ) : phase === GamePhase.ENDED && endingResult ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-900 to-black">
                 <div className={`text-[10px] font-bold tracking-[0.4em] uppercase mb-4
                    ${endingResult.type === 'GOOD' ? 'text-emerald-400' : endingResult.type === 'NEUTRAL' ? 'text-amber-400' : 'text-rose-500'}
                 `}>
                    结局: {endingResult.type === 'GOOD' ? '完美破案' : endingResult.type === 'NEUTRAL' ? '真相迷雾' : '迷失真相'}
                 </div>
                 <h1 className="text-4xl md:text-6xl font-serif font-bold text-slate-100 mb-8 px-4 leading-tight">{endingResult.title}</h1>
                 <p className="max-w-2xl text-base md:text-lg text-slate-300 leading-relaxed mb-12 italic px-4">
                    {endingResult.narrative}
                 </p>
                 
                 <div className="bg-slate-800/40 backdrop-blur-md p-8 rounded-3xl max-w-2xl w-full border border-slate-700 text-left mb-12 shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl">🔎</div>
                    <h3 className="text-violet-400 font-bold text-[10px] uppercase tracking-widest mb-4 border-b border-violet-400/30 pb-2">世界真相</h3>
                    <p className="text-slate-400 text-sm whitespace-pre-wrap leading-loose font-serif italic">{mystery?.solution}</p>
                 </div>

                 <button
                    onClick={startNewGame}
                    className="bg-slate-100 text-slate-900 hover:bg-white font-bold py-4 px-12 rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-xl shrink-0 mb-8"
                 >
                    开启新局
                 </button>
            </div>
        ) : phase === GamePhase.FAILED ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center">
                <div className="text-rose-500 text-4xl mb-2">⚠️</div>
                <p className="text-rose-500 font-bold text-lg">无法连接至迷局</p>
                <div className="text-[10px] bg-slate-800/50 p-4 rounded-xl border border-slate-700 max-w-xs text-center leading-relaxed text-slate-500">
                    这可能是由于网络不稳定或 API 密钥限制导致。
                </div>
                <button onClick={() => setPhase(GamePhase.IDLE)} className="bg-slate-700 px-8 py-2.5 rounded-full text-white hover:bg-slate-600 transition-colors text-sm mt-4 shadow-lg">重试</button>
            </div>
        ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-[#0f172a]">
                {mystery && (
                  <MysteryCard 
                    mystery={mystery} 
                    isExpanded={isMysteryExpanded} 
                    onToggle={() => setIsMysteryExpanded(!isMysteryExpanded)} 
                  />
                )}
                <ChatInterface messages={messages} isLoading={isProcessing} />
                <InputArea onSend={handlePlayerInput} onNewGame={startNewGame} phase={phase} />
            </div>
        )}
      </div>
    </div>
  );
}

export default App;
