
import React, { useState, useEffect, useCallback } from 'react';
import { generateMystery, judgeInput, evaluateSolution } from './services/geminiService';
import { MysteryCard } from './components/MysteryCard';
import { ChatInterface } from './components/ChatInterface';
import { InputArea } from './components/InputArea';
import { GamePhase, MysteryData, ChatMessage, AnswerType, EndingEvaluation } from './types';

declare global {
  // Define AIStudio interface globally to match the environment and avoid conflicts
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Fixed: Removed readonly modifier to avoid "identical modifiers" error with standard window interface merging
    aistudio: AIStudio;
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
      // Assume success after opening dialog to mitigate race conditions
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
      // Handle required key re-selection if the key is invalid or lacks permissions
      if (error.message === "KEY_RESELECT_REQUIRED") {
        setHasApiKey(false);
        alert("API 密钥权限不足或无效。请确保使用已启用 Gemini API 的 API 密钥（建议使用付费项目密钥以访问高级模型）。");
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
      // Handle required key re-selection
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
        // Handle required key re-selection
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
      <div className="flex h-screen w-full bg-mystery-900 items-center justify-center p-4">
        <div className="bg-mystery-800 p-8 rounded-2xl border border-mystery-700 shadow-2xl max-w-md w-full text-center space-y-8">
          <div className="w-20 h-20 bg-mystery-700/50 rounded-full flex items-center justify-center mx-auto border border-mystery-600">
            <span className="text-4xl">🕵️</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-slate-100">Enigma AI</h1>
            <p className="text-mystery-accent text-sm font-bold tracking-widest uppercase">沉浸式推理剧场</p>
          </div>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              欢迎。要开启这场迷局，请先连接您的 Google AI Studio 密钥。由于本作涉及图像生成，建议使用付费项目的密钥。
            </p>
            <button 
                onClick={handleSelectKey}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
            >
                🔑 连接 Google AI Studio
            </button>
            <p className="text-[10px] text-slate-500 italic">
                注意：本项目使用 Gemini 2.5 Flash Image 模型进行人物刻画。
            </p>
          </div>
          <div className="text-[10px] text-slate-600 border-t border-mystery-700 pt-4">
             <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">
                了解关于计费和 API 密钥的更多信息
             </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-mystery-900 font-sans overflow-hidden text-slate-200">
      
      {/* Sidebar */}
      <div className={`
        fixed md:relative z-30 w-80 h-full bg-mystery-800 border-r border-mystery-700 transform transition-transform duration-300 flex flex-col
        ${showCluePanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-mystery-700 bg-mystery-900/50 flex justify-between items-center">
            <h2 className="font-serif font-bold text-mystery-accent text-xl">调查手册</h2>
            <button onClick={() => setShowCluePanel(false)} className="md:hidden text-slate-400">✕</button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1 scrollbar-hide">
            {phase === GamePhase.PLAYING && mystery && (
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">选择询问对象</p>
                    <button 
                        onClick={() => setActiveTarget('GM')}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3
                        ${activeTarget === 'GM' ? 'bg-mystery-accent/20 border-mystery-accent text-white' : 'bg-mystery-900 border-mystery-700 text-slate-400 hover:bg-mystery-700'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">👻</div>
                        <div>
                            <div className="font-bold text-sm">上帝视角</div>
                            <div className="text-[10px] opacity-70">是/否 提问模式</div>
                        </div>
                    </button>

                    {mystery.npcs.map(npc => (
                        <button 
                            key={npc.id}
                            onClick={() => setActiveTarget(npc.id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 relative overflow-hidden
                            ${activeTarget === npc.id ? 'bg-mystery-accent/20 border-mystery-accent text-white' : 'bg-mystery-900 border-mystery-700 text-slate-400 hover:bg-mystery-700'}`}
                        >
                             <div className="w-10 h-10 rounded-full bg-indigo-900 flex-shrink-0 flex items-center justify-center overflow-hidden border border-mystery-600 z-10 shadow-md">
                                {npc.avatarUrl ? (
                                    <img src={npc.avatarUrl} alt={npc.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs font-bold">{npc.name.charAt(0)}</span>
                                )}
                             </div>
                             <div className="z-10">
                                <div className="font-bold text-sm">{npc.name}</div>
                                <div className="text-[10px] opacity-90 font-serif italic">{npc.role}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-8">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">已锁定的事实</p>
                {unlockedClues.size === 0 ? (
                    <div className="text-center p-6 border border-dashed border-mystery-700 rounded-xl text-slate-600 text-xs italic">
                        通过巧妙的提问揭开真相...
                    </div>
                ) : (
                    <div className="space-y-2">
                        {mystery?.clues.map(clue => {
                            if (!unlockedClues.has(clue.id)) return null;
                            return (
                                <div key={clue.id} className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-lg text-sm animate-fade-in">
                                    <div className="text-emerald-400 font-bold mb-1 flex items-center gap-2">
                                        <span className="text-[10px]">✔</span> {clue.title}
                                    </div>
                                    <div className="text-emerald-100/60 text-[11px] leading-relaxed">{clue.description}</div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>

        {phase === GamePhase.PLAYING && (
            <div className="p-4 border-t border-mystery-700 bg-mystery-900/50">
                <button 
                    onClick={() => setPhase(GamePhase.SOLVING)}
                    className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition-all uppercase tracking-wider text-xs"
                >
                    终结调查 / 提交推理
                </button>
            </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Mobile Navbar */}
        <div className="md:hidden h-14 bg-mystery-800 border-b border-mystery-700 flex items-center px-4 justify-between shrink-0">
             <span className="font-serif font-bold text-slate-100">Enigma AI</span>
             <button onClick={() => setShowCluePanel(true)} className="text-mystery-accent text-sm font-bold flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
                线索
             </button>
        </div>

        {phase === GamePhase.LOADING ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-6 p-8">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-mystery-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-mystery-accent rounded-full border-t-transparent animate-spin"></div>
                </div>
                <div className="text-center space-y-2">
                    <p className="animate-pulse tracking-[0.2em] uppercase text-xs font-bold text-mystery-accent">正在构建迷局...</p>
                    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">Gemini 正在细致刻画每一个嫌疑人的面容与动机，请耐心等待这份独特的黑暗馈赠。</p>
                </div>
             </div>
        ) : phase === GamePhase.SOLVING ? (
            <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center bg-mystery-900 animate-fade-in">
                <div className="max-w-xl w-full space-y-8">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-serif text-slate-100">审判时刻</h2>
                        <p className="text-slate-400 text-sm">将碎片拼凑成真相。一旦落笔，结局将定。</p>
                    </div>
                    <textarea 
                        value={finalTheory}
                        onChange={(e) => setFinalTheory(e.target.value)}
                        className="w-full h-64 bg-mystery-800 border border-mystery-700 rounded-2xl p-6 text-slate-200 focus:outline-none focus:ring-2 focus:ring-mystery-accent transition-all resize-none shadow-inner"
                        placeholder="在此处写下你对案件真相的完整推理..."
                    />
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setPhase(GamePhase.PLAYING)}
                            className="flex-1 py-4 text-slate-500 hover:text-slate-300 font-bold transition-colors"
                        >
                            继续搜证
                        </button>
                        <button 
                            onClick={handleSolveAttempt}
                            disabled={!finalTheory.trim() || isProcessing}
                            className="flex-1 py-4 bg-mystery-accent hover:bg-violet-500 text-white font-bold rounded-xl shadow-xl disabled:opacity-50 transition-all"
                        >
                            {isProcessing ? '法官思考中...' : '提交真相'}
                        </button>
                    </div>
                </div>
            </div>
        ) : phase === GamePhase.ENDED && endingResult ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in overflow-y-auto bg-gradient-to-b from-mystery-900 to-black">
                 <div className={`text-xs font-bold tracking-[0.3em] uppercase mb-4
                    ${endingResult.type === 'GOOD' ? 'text-emerald-400' : endingResult.type === 'NEUTRAL' ? 'text-amber-400' : 'text-rose-500'}
                 `}>
                    达成结局: {endingResult.type === 'GOOD' ? '完美破案' : endingResult.type === 'NEUTRAL' ? '真相迷雾' : '迷失真相'}
                 </div>
                 <h1 className="text-4xl md:text-6xl font-serif font-bold text-slate-100 mb-8 px-4">{endingResult.title}</h1>
                 <p className="max-w-2xl text-lg text-slate-300 leading-relaxed mb-12 italic px-4">
                    {endingResult.narrative}
                 </p>
                 
                 <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl max-w-2xl w-full border border-white/10 text-left mb-12 shadow-2xl">
                    <h3 className="text-mystery-accent font-bold text-xs uppercase tracking-widest mb-4">世界真相 (The Truth)</h3>
                    <p className="text-slate-400 text-sm whitespace-pre-wrap leading-loose font-serif">{mystery?.solution}</p>
                 </div>

                 <button
                    onClick={startNewGame}
                    className="bg-slate-100 text-mystery-900 hover:bg-white font-bold py-4 px-12 rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                 >
                    再来一局
                 </button>
            </div>
        ) : phase === GamePhase.FAILED ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                <p className="text-rose-500 font-bold">连接至迷雾深处失败</p>
                <div className="text-[10px] bg-mystery-800 p-4 rounded-xl border border-mystery-700 mb-4 max-w-xs text-center leading-relaxed">
                    这可能是由于 API 额度耗尽、网络不稳或密钥权限受限。
                </div>
                <button onClick={() => setPhase(GamePhase.IDLE)} className="underline hover:text-white text-sm">点击重试</button>
            </div>
        ) : (
            <>
                {mystery && <MysteryCard mystery={mystery} isExpanded={false} onToggle={() => {}} />}
                <ChatInterface messages={messages} isLoading={isProcessing} />
                <InputArea onSend={handlePlayerInput} onNewGame={startNewGame} phase={phase} />
            </>
        )}
      </div>
    </div>
  );
}

export default App;
