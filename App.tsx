import React, { useState, useEffect, useCallback } from 'react';
import { generateMystery, judgeInput, evaluateSolution } from './services/geminiService';
import { MysteryCard } from './components/MysteryCard';
import { ChatInterface } from './components/ChatInterface';
import { InputArea } from './components/InputArea';
import { GamePhase, MysteryData, ChatMessage, AnswerType, Clue, EndingEvaluation } from './types';

declare global {
  interface Window {
    aistudio: any;
  }
}

function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.IDLE);
  const [mystery, setMystery] = useState<MysteryData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTarget, setActiveTarget] = useState<string>('GM'); // 'GM' or NPC ID
  const [manualKey, setManualKey] = useState('');

  // New State for Features
  const [unlockedClues, setUnlockedClues] = useState<Set<string>>(new Set());
  const [showCluePanel, setShowCluePanel] = useState(false);
  const [finalTheory, setFinalTheory] = useState('');
  const [endingResult, setEndingResult] = useState<EndingEvaluation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Check for API Key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      console.log("Checking API Key availability...");
      try {
        // 1. Check AI Studio Environment
        if (window.aistudio) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (hasKey) {
            console.log("API Key found in AI Studio.");
            setHasApiKey(true);
            return;
          }
        }

        // 2. Check LocalStorage (Manual Entry)
        const localKey = localStorage.getItem("gemini_api_key");
        if (localKey) {
          console.log("API Key found in LocalStorage.");
          setHasApiKey(true);
          return;
        }

        // 3. Check Process Env
        if (process.env.API_KEY) {
          console.log("API Key found in process.env.");
          setHasApiKey(true);
          return;
        }

        console.log("No API Key found.");
        setHasApiKey(false);
      } catch (err) {
        console.error("Error during API Key check:", err);
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

  const handleSaveManualKey = () => {
    if (manualKey.trim()) {
      localStorage.setItem("gemini_api_key", manualKey.trim());
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

      // Inject the background story as the first message
      setMessages([{
        id: 'init-situation',
        type: 'ai_response',
        content: `【案件概要】\n${data.situation}`,
        speakerName: '案情提要',
        answerType: AnswerType.CLARIFICATION
      }]);

      setPhase(GamePhase.PLAYING);
    } catch (error: any) {
      console.error("Error starting game:", error);

      // Error handling for API Key issues
      const errString = error.toString().toLowerCase();
      if (errString.includes("api key") || errString.includes("400") || error.status === 400 || error.message?.includes('API key')) {
        // Clear invalid key
        localStorage.removeItem("gemini_api_key");
        setHasApiKey(false);
        setPhase(GamePhase.IDLE);
        alert("API Key 无效或过期，请重新输入。");
      } else {
        setErrorMessage(error.message || error.toString());
        setPhase(GamePhase.FAILED);
      }
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Only auto-start if key is present and we are idle
  useEffect(() => {
    if (hasApiKey && phase === GamePhase.IDLE) {
      console.log("Auto-starting game since key is present and phase is IDLE");
      startNewGame();
    }
  }, [hasApiKey, phase, startNewGame]);

  const handlePlayerInput = async (text: string) => {
    if (!mystery || phase !== GamePhase.PLAYING) return;

    // Get current speaker name
    const targetNPC = mystery.npcs.find(n => n.id === activeTarget);
    const targetName = activeTarget === 'GM'
      ? '上帝视角 (GM)'
      : targetNPC?.name || '未知';

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      speakerName: `To ${targetName}`
    };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // Logic: Pass 5 messages context + current Target
      const historyContext = messages.slice(-5).map(m => m.content);
      const judgment = await judgeInput(mystery, text, activeTarget, historyContext);

      // Handle Clue Unlock
      if (judgment.unlockedClueId && !unlockedClues.has(judgment.unlockedClueId)) {
        setUnlockedClues(prev => new Set(prev).add(judgment.unlockedClueId!));
        const clue = mystery.clues.find(c => c.id === judgment.unlockedClueId);
        if (clue) {
          setMessages(prev => [...prev, {
            id: 'clue-' + Date.now(),
            type: 'clue_alert',
            content: `🔍 发现线索: ${clue.title}`,
          }]);
          setShowCluePanel(true);
        }
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai_response',
        content: judgment.reply,
        answerType: judgment.answerType,
        speakerName: targetName,
        avatarUrl: targetNPC?.avatarUrl // Attach Avatar if available
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("Error processing input:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSolveAttempt = async () => {
    if (!mystery || !finalTheory.trim()) return;
    setIsProcessing(true);
    setPhase(GamePhase.ENDED);

    try {
      const result = await evaluateSolution(mystery, finalTheory);
      setEndingResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasApiKey) {
    return (
      <div className="flex h-screen w-full bg-mystery-900 items-center justify-center p-4 animate-fade-in">
        <div className="bg-mystery-800 p-8 rounded-2xl border border-mystery-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] max-w-md w-full text-center space-y-8 relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-mystery-accent to-transparent opacity-50"></div>

          <div className="w-20 h-20 bg-mystery-700/50 rounded-full flex items-center justify-center mx-auto border border-mystery-600 shadow-inner">
            <span className="text-4xl filter drop-shadow-lg">🕵️</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-slate-100 tracking-wide">Enigma AI</h1>
            <p className="text-mystery-accent text-sm font-bold tracking-widest uppercase opacity-80">沉浸式推理游戏</p>
          </div>

          <div className="space-y-4">
            <p className="text-slate-400 text-sm leading-relaxed">
              欢迎来到 Enigma。要开始这段由 AI 生成的推理之旅，请先连接您的 API 密钥。
            </p>

            {/* AI Studio Key Selection */}
            {window.aistudio && (
              <button
                onClick={handleSelectKey}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5"
              >
                🔑 使用 Google AI Studio 连接
              </button>
            )}

            {/* Manual Key Entry Fallback */}
            {!window.aistudio && (
              <div className="space-y-3 pt-2">
                <input
                  type="password"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="输入 Gemini API Key (以 AIza 开头)"
                  className="w-full px-4 py-3 bg-mystery-900 border border-mystery-700 rounded-lg text-slate-200 text-sm focus:border-mystery-accent focus:outline-none"
                />
                <button
                  onClick={handleSaveManualKey}
                  disabled={!manualKey.trim()}
                  className="w-full py-3 bg-mystery-700 hover:bg-mystery-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors border border-mystery-600"
                >
                  开始游戏
                </button>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-600 border-t border-mystery-700 pt-4 mt-4">
            <p>本游戏使用 Google Gemini 2.5 & Imagen 3 模型</p>
            <p className="mt-1">
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-slate-400 transition-colors">
                获取 Gemini API Key
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-mystery-900 font-sans overflow-hidden">

      {/* LEFT SIDEBAR: Controls & Clues (Desktop) */}
      <div className={`
        fixed md:relative z-30 w-80 h-full bg-mystery-800 border-r border-mystery-700 transform transition-transform duration-300 flex flex-col
        ${showCluePanel ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-mystery-700 bg-mystery-900/50 flex justify-between items-center">
          <h2 className="font-serif font-bold text-mystery-accent text-xl">调查手册</h2>
          <button onClick={() => setShowCluePanel(false)} className="md:hidden text-slate-400">✕</button>
        </div>

        {/* TARGET SELECTION */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {phase === GamePhase.PLAYING && mystery && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-2">选择询问对象</p>

              <button
                onClick={() => setActiveTarget('GM')}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3
                        ${activeTarget === 'GM' ? 'bg-mystery-accent/20 border-mystery-accent text-white' : 'bg-mystery-900 border-mystery-700 text-slate-400 hover:bg-mystery-700'}`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs shadow-inner">👻</div>
                <div>
                  <div className="font-bold text-sm">上帝视角</div>
                  <div className="text-[10px] opacity-70">是/否 提问</div>
                </div>
              </button>

              {mystery.npcs.map(npc => (
                <button
                  key={npc.id}
                  onClick={() => setActiveTarget(npc.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-all flex items-center gap-3 relative overflow-hidden
                            ${activeTarget === npc.id ? 'bg-mystery-accent/20 border-mystery-accent text-white' : 'bg-mystery-900 border-mystery-700 text-slate-400 hover:bg-mystery-700'}`}
                >
                  {/* Background Image Fade */}
                  {npc.avatarUrl && (
                    <div className="absolute inset-0 opacity-20 z-0">
                      <img src={npc.avatarUrl} alt="" className="w-full h-full object-cover grayscale" />
                    </div>
                  )}

                  <div className="w-10 h-10 rounded-full bg-indigo-900 flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden border border-mystery-600 z-10 shadow-md">
                    {npc.avatarUrl ? (
                      <img src={npc.avatarUrl} alt={npc.name} className="w-full h-full object-cover" />
                    ) : (
                      npc.name.charAt(0)
                    )}
                  </div>
                  <div className="z-10">
                    <div className="font-bold text-sm text-shadow-sm">{npc.name}</div>
                    <div className="text-[10px] opacity-90 font-serif italic">{npc.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* CLUES LIST */}
          <div className="mt-8">
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3">线索记录</p>
            {unlockedClues.size === 0 ? (
              <div className="text-center p-4 border border-dashed border-mystery-700 rounded text-slate-600 text-sm italic">
                暂无发现线索
              </div>
            ) : (
              <div className="space-y-2">
                {mystery?.clues.map(clue => {
                  const isUnlocked = unlockedClues.has(clue.id);
                  if (!isUnlocked) return null;
                  return (
                    <div key={clue.id} className="bg-emerald-900/20 border border-emerald-900/50 p-3 rounded text-sm animate-fade-in">
                      <div className="text-emerald-400 font-bold mb-1">✓ {clue.title}</div>
                      <div className="text-emerald-100/70 text-xs">{clue.description}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* SOLVE BUTTON */}
        {phase === GamePhase.PLAYING && (
          <div className="p-4 border-t border-mystery-700 bg-mystery-900/50">
            <button
              onClick={() => setPhase(GamePhase.SOLVING)}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded shadow-lg hover:shadow-orange-900/50 transition-all uppercase tracking-wider text-sm"
            >
              破解谜题
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Mobile Header for Sidebar */}
        <div className="md:hidden h-14 bg-mystery-800 border-b border-mystery-700 flex items-center px-4 justify-between shrink-0">
          <span className="font-serif font-bold text-slate-200">Enigma AI</span>
          <button onClick={() => setShowCluePanel(true)} className="text-mystery-accent text-sm font-bold flex items-center gap-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
            线索
          </button>
        </div>

        {phase === GamePhase.LOADING ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-mystery-700 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-mystery-accent rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="animate-pulse tracking-widest uppercase text-sm font-bold">正在构建迷局与人物画像...</p>
          </div>
        ) : phase === GamePhase.SOLVING ? (
          /* SOLVING INTERFACE */
          <div className="flex-1 p-6 md:p-12 flex flex-col items-center justify-center bg-mystery-900 animate-fade-in">
            <div className="max-w-xl w-full space-y-6">
              <h2 className="text-3xl font-serif text-slate-100 text-center">最终推理</h2>
              <p className="text-slate-400 text-center">整理你的线索。一旦提交，真相将无法更改。你的结论是什么？</p>
              <textarea
                value={finalTheory}
                onChange={(e) => setFinalTheory(e.target.value)}
                className="w-full h-48 bg-mystery-800 border border-mystery-700 rounded-lg p-4 text-slate-200 focus:outline-none focus:border-mystery-accent resize-none"
                placeholder="请在此输入你的完整推理过程..."
              />
              <div className="flex gap-4">
                <button
                  onClick={() => setPhase(GamePhase.PLAYING)}
                  className="flex-1 py-3 text-slate-400 hover:text-white transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={handleSolveAttempt}
                  disabled={!finalTheory.trim() || isProcessing}
                  className="flex-1 py-3 bg-mystery-accent hover:bg-violet-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50"
                >
                  {isProcessing ? '审判中...' : '提交结论'}
                </button>
              </div>
            </div>
          </div>
        ) : phase === GamePhase.ENDED && endingResult ? (
          /* ENDING SCREEN */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in overflow-y-auto">
            <div className={`text-sm font-bold tracking-[0.2em] uppercase mb-4
                    ${endingResult.type === 'GOOD' ? 'text-emerald-500' : endingResult.type === 'NEUTRAL' ? 'text-amber-500' : 'text-rose-500'}
                 `}>
              结局达成: {endingResult.type === 'GOOD' ? '完美破案' : endingResult.type === 'NEUTRAL' ? '真相未明' : '迷雾重重'}
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-100 mb-6">{endingResult.title}</h1>
            <p className="max-w-2xl text-lg text-slate-300 leading-relaxed mb-12">
              {endingResult.narrative}
            </p>

            <div className="bg-mystery-800/50 p-6 rounded-lg max-w-2xl w-full border border-mystery-700 text-left mb-8">
              <h3 className="text-mystery-accent font-bold text-sm uppercase mb-2">事件真相</h3>
              <p className="text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">{mystery?.solution}</p>
            </div>

            <button
              onClick={startNewGame}
              className="bg-slate-100 text-mystery-900 hover:bg-white font-bold py-3 px-8 rounded-full transition-transform transform hover:scale-105"
            >
              开始新游戏
            </button>
          </div>
        ) : phase === GamePhase.FAILED ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
            <p className="text-rose-500 font-bold">生成游戏失败</p>
            <div className="text-xs bg-mystery-800 p-2 rounded border border-mystery-700 mb-4 max-w-sm text-center">
              请检查 API Key 额度或网络连接
              {errorMessage && <div className="mt-2 text-rose-400 border-t border-mystery-700 pt-2 break-all">{errorMessage}</div>}
            </div>
            <button onClick={() => { setPhase(GamePhase.IDLE); setHasApiKey(false); localStorage.removeItem("gemini_api_key"); }} className="underline hover:text-white">重新输入 API Key</button>
          </div>
        ) : (
          /* GAME PLAY AREA */
          <>
            {mystery && <MysteryCard mystery={mystery} isExpanded={false} onToggle={() => { }} />}
            <ChatInterface messages={messages} isLoading={isProcessing} />
            <InputArea
              onSend={handlePlayerInput}
              onNewGame={startNewGame}
              phase={phase}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;