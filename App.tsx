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
  const [loadingText, setLoadingText] = useState('正在初始化系统...');

  useEffect(() => {
    if (phase === GamePhase.LOADING) {
      const phrases = [
        '正在搜集现场证据...',
        '正在构建嫌疑人画像...',
        '正在加密传输卷宗...',
        '正在模拟时空片段...',
        '线索整合中...',
        '暗夜降临...'
      ];
      let i = 0;
      const interval = setInterval(() => {
        setLoadingText(phrases[i % phrases.length]);
        i++;
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [phase]);

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
        alert("API 密钥权限不足或无效。请重新连接。");
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
        alert("API 密钥异常，请重试。");
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
            alert("API 密钥异常，请重试。");
        }
    } finally {
        setIsProcessing(false);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="relative flex h-screen w-full bg-[#020617] items-center justify-center p-6 scanlines">
        {/* 背景氛围 */}
        <div className="absolute inset-0 ambient-light z-0"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center max-w-2xl w-full">
          {/* 装饰线 */}
          <div className="w-px h-24 bg-gradient-to-b from-transparent via-violet-500/50 to-transparent mb-8 animate-pulse"></div>

          <div className="text-center space-y-6 mb-16">
            <h1 className="text-7xl md:text-9xl font-serif font-black text-white animate-spread uppercase tracking-[0.2em] neon-text">
              ENIGMA
            </h1>
            <div className="flex items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="h-px w-8 bg-violet-500/30"></div>
              <p className="text-violet-400 text-[11px] font-bold tracking-[0.5em] uppercase">
                Detective AI Experience v3.0
              </p>
              <div className="h-px w-8 bg-violet-500/30"></div>
            </div>
          </div>

          <div className="w-full space-y-12 animate-slide-up" style={{ animationDelay: '0.6s' }}>
             <div className="text-center">
               <p className="text-slate-400 font-serif italic text-lg opacity-80 mb-12 max-w-md mx-auto leading-relaxed">
                 "真理往往并不复杂，只是被我们不愿面对的借口所掩盖。"
               </p>
               
               <button 
                  onClick={handleSelectKey}
                  className="group relative px-12 py-5 bg-transparent border border-white/10 rounded-full overflow-hidden transition-all hover:border-violet-500/50 pulse-ring"
               >
                  <div className="absolute inset-0 bg-violet-600 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  <span className="relative text-white font-black text-xs uppercase tracking-[0.4em] flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
                    建立神经连接
                  </span>
               </button>
             </div>

             <div className="flex justify-between items-center text-[9px] text-slate-600 tracking-[0.3em] font-bold uppercase pt-12 border-t border-white/5">
                <span>Status: Offline</span>
                <span>Security: High</span>
                <span>Session: Encrypted</span>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#020617] font-sans overflow-hidden text-slate-200">
      
      {/* 侧边栏 */}
      <div className={`
        fixed md:relative z-50 w-80 h-full bg-slate-950/95 border-r border-white/5 transform transition-all duration-700 ease-in-out flex flex-col backdrop-blur-3xl shadow-2xl
        ${showCluePanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-10 pb-6 shrink-0 space-y-2">
            <h2 className="font-serif font-black text-white text-3xl tracking-tight">DOSSIER</h2>
            <div className="h-0.5 w-12 bg-violet-500/50"></div>
        </div>

        <div className="p-6 pt-2 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
            {phase === GamePhase.PLAYING && mystery && (
                <div className="space-y-4">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-slate-600 font-black mb-2 px-1">Interrogation Targets</p>
                    
                    <button 
                        onClick={() => { setActiveTarget('GM'); setShowCluePanel(false); }}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group relative overflow-hidden
                        ${activeTarget === 'GM' ? 'bg-violet-600/10 border-violet-500/50 text-white shadow-[inset_0_0_20px_rgba(139,92,246,0.1)]' : 'bg-slate-900/30 border-white/5 text-slate-500 hover:bg-slate-900 hover:border-white/10'}`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${activeTarget === 'GM' ? 'bg-violet-500/20' : 'bg-slate-800'}`}>
                          👁️
                        </div>
                        <div className="min-w-0">
                            <div className="font-black text-xs uppercase tracking-wider">上帝视角</div>
                            <div className="text-[9px] opacity-60 font-medium truncate">Yes / No / Facts Only</div>
                        </div>
                        {activeTarget === 'GM' && <div className="absolute right-0 top-0 bottom-0 w-1 bg-violet-500 animate-pulse"></div>}
                    </button>

                    <div className="flex items-center gap-2 py-2">
                      <div className="h-px flex-1 bg-white/5"></div>
                      <span className="text-[8px] font-bold text-slate-700 uppercase tracking-widest">Witnesses</span>
                      <div className="h-px flex-1 bg-white/5"></div>
                    </div>

                    {mystery.npcs.map(npc => (
                        <button 
                            key={npc.id}
                            onClick={() => { setActiveTarget(npc.id); setShowCluePanel(false); }}
                            className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-4 relative overflow-hidden group
                            ${activeTarget === npc.id ? 'bg-indigo-600/10 border-indigo-500/50 shadow-xl' : 'bg-slate-900/20 border-white/5 text-slate-500 hover:bg-slate-900 hover:border-white/10'}`}
                        >
                             <div className="w-12 h-12 rounded-xl bg-slate-950 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 z-10 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                {npc.avatarUrl ? (
                                    <img src={npc.avatarUrl} alt={npc.name} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" />
                                ) : (
                                    <span className="text-xs font-bold text-white/30">{npc.name.charAt(0)}</span>
                                )}
                             </div>
                             <div className="z-10 min-w-0">
                                <div className={`font-black text-xs tracking-tight transition-colors ${activeTarget === npc.id ? 'text-white' : 'text-slate-400'}`}>{npc.name}</div>
                                <div className="text-[9px] opacity-50 font-serif italic truncate mt-0.5">{npc.role}</div>
                            </div>
                            {activeTarget === npc.id && (
                              <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-500 animate-pulse"></div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-8 space-y-4">
                <p className="text-[9px] uppercase tracking-[0.3em] text-slate-600 font-black px-1">Evidence Log</p>
                {unlockedClues.size === 0 ? (
                    <div className="text-center p-12 border border-dashed border-white/5 rounded-[2rem] text-slate-700 text-[10px] italic leading-relaxed bg-white/[0.01]">
                        案件尚未取得突破...
                    </div>
                ) : (
                    <div className="space-y-4">
                        {mystery?.clues.map(clue => {
                            if (!unlockedClues.has(clue.id)) return null;
                            return (
                                <div key={clue.id} className="group bg-slate-900/40 border border-white/5 p-5 rounded-[1.5rem] animate-fade-in hover:border-emerald-500/20 transition-all shadow-lg">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="text-emerald-500 font-black text-[8px] uppercase tracking-[0.3em]">Confirmed</div>
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                                    </div>
                                    <div className="text-slate-200 font-bold text-xs mb-2 leading-tight">{clue.title}</div>
                                    <div className="text-slate-500 text-[10px] leading-relaxed italic border-t border-white/5 pt-2">{clue.description}</div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>

        {phase === GamePhase.PLAYING && (
            <div className="p-8 border-t border-white/5 bg-slate-950 shrink-0">
                <button 
                    onClick={() => { setPhase(GamePhase.SOLVING); setShowCluePanel(false); }}
                    className="group relative w-full py-4 bg-white text-slate-900 font-black rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.3em] text-[10px] overflow-hidden"
                >
                    终结调查
                </button>
            </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Mobile Navbar */}
        <div className="md:hidden h-20 bg-slate-950/90 backdrop-blur-2xl border-b border-white/5 flex items-center px-8 justify-between shrink-0 z-20">
             <span className="font-serif font-black text-white tracking-tighter text-2xl uppercase">ENIGMA</span>
             <button onClick={() => setShowCluePanel(true)} className="text-violet-400 text-[10px] font-black flex items-center gap-2 bg-violet-500/10 px-4 py-2 rounded-full border border-violet-500/20 uppercase tracking-[0.2em]">
                Dossier
             </button>
        </div>

        {phase === GamePhase.LOADING ? (
             <div className="flex-1 flex flex-col items-center justify-center p-12 bg-mask scanlines">
                <div className="relative space-y-16 text-center">
                    <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                        <div className="absolute inset-0 border border-violet-500/20 rounded-full animate-ping"></div>
                        <div className="absolute inset-0 border border-violet-500/10 rounded-full animate-pulse scale-150"></div>
                        <div className="text-4xl animate-bounce">⚖️</div>
                    </div>
                    <div className="space-y-6">
                        <p className="text-violet-400 font-black tracking-[0.6em] uppercase text-[10px] animate-pulse">Initializing Environment</p>
                        <p className="text-slate-500 text-sm font-light italic typing-cursor">{loadingText}</p>
                    </div>
                </div>
             </div>
        ) : phase === GamePhase.SOLVING ? (
            <div className="flex-1 p-8 md:p-24 flex flex-col items-center justify-center animate-fade-in overflow-y-auto">
                <div className="max-w-2xl w-full space-y-12 py-12">
                    <div className="text-center space-y-6">
                        <div className="text-[10px] text-amber-500 font-black tracking-[0.6em] uppercase">The Final Verdict</div>
                        <h2 className="text-6xl font-serif text-white font-black uppercase tracking-tight">最终裁决</h2>
                        <p className="text-slate-500 text-sm font-light italic max-w-sm mx-auto leading-relaxed border-t border-white/5 pt-6">
                          "证据已集齐。真相隐匿于谎言背后，等待你来揭露。"
                        </p>
                    </div>
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-[2.5rem] blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
                      <textarea 
                          value={finalTheory}
                          onChange={(e) => setFinalTheory(e.target.value)}
                          className="relative w-full h-80 bg-slate-950 border border-white/5 rounded-[2.5rem] p-10 text-slate-100 focus:outline-none focus:border-violet-500/20 transition-all resize-none shadow-2xl text-lg leading-relaxed font-serif italic"
                          placeholder="陈述你的推理过程..."
                      />
                    </div>
                    <div className="flex flex-col md:flex-row gap-6">
                        <button 
                            onClick={() => setPhase(GamePhase.PLAYING)}
                            className="flex-1 py-5 text-slate-500 hover:text-white font-black transition-all text-[10px] uppercase tracking-[0.3em] border border-white/5 rounded-2xl hover:bg-white/5"
                        >
                            搜证阶段
                        </button>
                        <button 
                            onClick={handleSolveAttempt}
                            disabled={!finalTheory.trim() || isProcessing}
                            className="flex-[2] py-5 bg-violet-600 hover:bg-violet-500 text-white font-black rounded-2xl shadow-2xl disabled:opacity-50 transition-all text-[10px] uppercase tracking-[0.4em]"
                        >
                            {isProcessing ? '判定中...' : '提交真相'}
                        </button>
                    </div>
                </div>
            </div>
        ) : phase === GamePhase.ENDED && endingResult ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in overflow-y-auto bg-gradient-to-b from-[#020617] to-black">
                 <div className={`text-[9px] font-black tracking-[0.6em] uppercase mb-8 px-6 py-2 rounded-full border border-current
                    ${endingResult.type === 'GOOD' ? 'text-emerald-500 bg-emerald-500/5' : endingResult.type === 'NEUTRAL' ? 'text-amber-500 bg-amber-500/5' : 'text-rose-500 bg-rose-500/5'}
                 `}>
                    Archive {endingResult.type === 'GOOD' ? 'Resolved' : 'Closed'}
                 </div>
                 <h1 className="text-6xl md:text-9xl font-serif font-black text-white mb-10 leading-none tracking-tighter uppercase">{endingResult.title}</h1>
                 <p className="max-w-2xl text-xl md:text-2xl text-slate-400 font-light leading-relaxed mb-20 italic px-4 font-serif">
                    “{endingResult.narrative}”
                 </p>
                 
                 <div className="bg-white/[0.02] backdrop-blur-3xl p-12 rounded-[3.5rem] max-w-3xl w-full border border-white/5 text-left mb-20 shadow-2xl relative group overflow-hidden">
                    <div className="absolute -top-10 -right-10 opacity-[0.02] text-[12rem] font-serif select-none pointer-events-none uppercase">Fact</div>
                    <h3 className="text-violet-400 font-black text-[9px] uppercase tracking-[0.5em] mb-8 border-b border-violet-400/20 pb-4">案件世界观全貌 (Absolute Truth)</h3>
                    <p className="text-slate-300 text-lg md:text-xl whitespace-pre-wrap leading-loose font-serif italic">{mystery?.solution}</p>
                 </div>

                 <button
                    onClick={startNewGame}
                    className="group relative bg-white text-slate-900 font-black py-6 px-20 rounded-2xl transition-all transform hover:scale-105 active:scale-95 shadow-2xl mb-16 overflow-hidden uppercase tracking-[0.4em] text-[10px]"
                 >
                    开启新卷宗
                 </button>
            </div>
        ) : phase === GamePhase.FAILED ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-8 p-12 text-center">
                <div className="text-rose-500 font-black text-8xl opacity-10 font-serif">ERROR</div>
                <div className="space-y-2">
                  <h3 className="text-rose-500 font-black text-lg tracking-widest uppercase">接入失败</h3>
                  <p className="text-xs font-serif italic">“由于不可抗力，此次时空连接已断开。”</p>
                </div>
                <button onClick={() => setPhase(GamePhase.IDLE)} className="px-12 py-4 bg-slate-900 border border-white/5 rounded-2xl text-white hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-[0.3em]">重新连接</button>
            </div>
        ) : (
            <div className="flex-1 flex flex-col min-h-0 relative">
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