"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, ColorType, Time } from "lightweight-charts";
import { fetchStockData, generateAIReport } from "./actions";

interface CandleData { time: Time; open: number; high: number; low: number; close: number; volume?: number; }
interface AIReportData { trendStatus: string; winRateEstimate: string; fundamentalSentiment: string; diagnosis: string; actionPlan: { entry: string; stopLoss: string; target: string; }; }
interface QuoteData { price: string; change: string; changePercent: string; }

const i18n = {
  TW: {
    title: "量化決策終端", searchPh: "輸入股號", analyze: "解析",
    marketTW: "🇹🇼 台股", marketUS: "🇺🇸 美股",
    sysDiag: "技術與量價診斷", fundDiag: "產業籌碼與事件雷達", action: "戰術執行腳本",
    entry: "進場策略", stop: "嚴格停損", target: "目標停利",
    modeNovice: "👶 新手引導", modeVeteran: "🧙‍♂️ 老手量化",
    quoteLabel: "最新報價 (盤中/收盤)"
  },
  EN: {
    title: "Quant Terminal", searchPh: "Ticker", analyze: "Analyze",
    marketTW: "🇹🇼 TW", marketUS: "🇺🇸 US",
    sysDiag: "Technical & Volume", fundDiag: "Sentiment & Catalyst", action: "Action Protocol",
    entry: "Entry Strategy", stop: "Strict Stop-Loss", target: "Take-Profit Target",
    modeNovice: "👶 Novice", modeVeteran: "🧙‍♂️ Veteran",
    quoteLabel: "Latest Quote"
  }
};

const FREE_TICKERS = ["AAPL", "2330.TW", "2330", "006208.TW", "006208"];
const MONTHLY_PRO_CODE = "EDEN2026"; 

export default function AutoInvestDashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  
  const [isClient, setIsClient] = useState(false);
  const [lang, setLang] = useState<"TW" | "EN">("TW");
  const [market, setMarket] = useState<"TW" | "US">("TW");
  const [userMode, setUserMode] = useState<"NOVICE" | "VETERAN">("NOVICE");
  const [tickerInput, setTickerInput] = useState("");
  
  const [isProUser, setIsProUser] = useState(false); 
  const [showPaywall, setShowPaywall] = useState(false);
  const [inputCode, setInputCode] = useState("");

  const [currentTicker, setCurrentTicker] = useState("2330.TW");
  const [stockData, setStockData] = useState<CandleData[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReportData | null>(null);
  const [aiErrorMsg, setAiErrorMsg] = useState("");
  const [igMode, setIgMode] = useState(false);
  
  // 【新增功能 A】Watchlist 記憶狀態
  const [watchlist, setWatchlist] = useState<string[]>([]);
  
  const t = i18n[lang];

  useEffect(() => { 
    setIsClient(true); 
    const savedCode = localStorage.getItem("edenProCode");
    if (savedCode === MONTHLY_PRO_CODE) setIsProUser(true);
    
    // 讀取自選股記憶
    const savedWatchlist = localStorage.getItem("edenWatchlist");
    if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));

    executeSearch("2330.TW"); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchClick = (forceTicker?: string) => {
    const targetInput = typeof forceTicker === "string" ? forceTicker : tickerInput;
    if (!targetInput) return;
    let target = targetInput.trim().toUpperCase();
    if (market === "TW" && !target.includes(".")) target += ".TW";

    if (!isProUser && !FREE_TICKERS.includes(target)) {
      setShowPaywall(true); return; 
    }
    setShowPaywall(false); executeSearch(target);
  };

  // 【新增功能 A】加入/移除自選股
  const toggleWatchlist = (ticker: string) => {
    let newWl = [];
    if (watchlist.includes(ticker)) newWl = watchlist.filter(t => t !== ticker);
    else newWl = [...watchlist, ticker];
    setWatchlist(newWl);
    localStorage.setItem("edenWatchlist", JSON.stringify(newWl));
  };

  const handleUnlock = () => {
    if (inputCode.trim().toUpperCase() === MONTHLY_PRO_CODE) {
      setIsProUser(true); 
      setShowPaywall(false);
      localStorage.setItem("edenProCode", MONTHLY_PRO_CODE); 
    } else {
      alert(lang === "TW" ? "解鎖碼無效或已過期！" : "Invalid Access Code.");
    }
  };

  const executeSearch = async (finalTicker: string) => {
    setStockData([]); setQuoteData(null); setAiReport(null); setErrorMsg(""); setAiErrorMsg("");
    setIsLoading(true); setAiLoading(true); setCurrentTicker(finalTicker);
    
    const result = await fetchStockData(finalTicker);
    
    if (result.success && result.data && result.quote) {
      setStockData(result.data); setQuoteData(result.quote);
      
      const slice = result.data.slice(-20);
      const sma = slice.length > 0 ? slice.reduce((acc: number, val: CandleData) => acc + val.close, 0) / slice.length : 0;
      const variance = slice.length > 0 ? slice.reduce((acc: number, val: CandleData) => acc + Math.pow(val.close - sma, 2), 0) / slice.length : 0;
      const sd = Math.sqrt(variance);
      
      const lastClose = result.data[result.data.length - 1].close;
      const recent5Days = result.data.slice(-5).map((d: CandleData) => d.close).join(" -> ");
      const lastVol = result.data.length > 0 ? (result.data[result.data.length - 1].volume || 0) : 0;
      const prevVol = result.data.length > 1 ? (result.data[result.data.length - 2].volume || 0) : 0;
      const volumeTrend = lastVol > prevVol * 1.5 ? "爆量" : lastVol < prevVol * 0.7 ? "量縮" : "穩定";
      
      const aiResult = await generateAIReport(finalTicker, {
        lastClose, sma: sma.toFixed(2), upper: (sma + sd * 2).toFixed(2), lower: (sma - sd * 2).toFixed(2), recentTrend: recent5Days, volumeTrend
      }, lang);
      
      if (aiResult.success) setAiReport(aiResult.data);
      else setAiErrorMsg(aiResult.error);
    } else { 
      setErrorMsg(result.error || "Data retrieval failed."); 
    }
    setIsLoading(false); setAiLoading(false);
  };

  useEffect(() => {
    if (!isClient || !chartContainerRef.current || stockData.length === 0) return;
    chartContainerRef.current.innerHTML = '';
    if (chartInstanceRef.current) { try { chartInstanceRef.current.remove(); } catch(e) {} }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0F172A' }, textColor: '#94A3B8' },
      grid: { vertLines: { color: '#1E293B', style: 1 }, horzLines: { color: '#1E293B', style: 1 } },
      crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: '#334155' }, timeScale: { borderColor: '#334155', timeVisible: true },
    });
    chartInstanceRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({ upColor: '#10B981', downColor: '#F43F5E', borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#F43F5E' });
    candlestickSeries.setData(stockData as any);

    const volSeries = chart.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    const volumeData = stockData.map((d: CandleData, i: number) => ({ time: d.time, value: d.volume || 0, color: i > 0 && d.close >= stockData[i-1].close ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)' }));
    volSeries.setData(volumeData as any);
    volumeSeriesRef.current = volSeries;
    volSeries.applyOptions({ visible: userMode === "VETERAN" });

    const upperBand: any[] = []; const lowerBand: any[] = []; const movingAverage: any[] = [];
    if (stockData.length >= 20) {
      for (let i = 19; i < stockData.length; i++) {
        const slice = stockData.slice(i - 19, i + 1);
        const sma = slice.reduce((acc: number, val: CandleData) => acc + val.close, 0) / 20;
        const variance = slice.reduce((acc: number, val: CandleData) => acc + Math.pow(val.close - sma, 2), 0) / 20;
        const sd = Math.sqrt(variance);
        movingAverage.push({ time: stockData[i].time, value: sma });
        upperBand.push({ time: stockData[i].time, value: sma + sd * 2 });
        lowerBand.push({ time: stockData[i].time, value: sma - sd * 2 });
      }
      chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.3)', lineWidth: 1 }).setData(upperBand);
      chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.3)', lineWidth: 1 }).setData(lowerBand);
      chart.addLineSeries({ color: 'rgba(234, 179, 8, 0.7)', lineWidth: 2 }).setData(movingAverage);
    }
    chart.timeScale().fitContent();
    const handleResize = () => { if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); try { chart.remove(); } catch(e){} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, stockData]);

  useEffect(() => {
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: userMode === "VETERAN" });
  }, [userMode]);

  if (!isClient) return <div className="min-h-screen bg-slate-950" />;
  const isUp = quoteData && Number(quoteData.change) >= 0;
  const inWatchlist = watchlist.includes(currentTicker);

  return (
    <main className={`min-h-screen bg-slate-950 p-4 md:p-8 text-slate-200 font-sans tracking-wide transition-all ${igMode ? 'max-w-md mx-auto border border-slate-800 rounded-xl pb-20 mt-10 shadow-2xl' : ''}`}>
      
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4">
          <div className="bg-slate-900 border border-amber-900/50 rounded-xl shadow-[0_0_40px_rgba(217,119,6,0.15)] max-w-sm w-full p-8">
            <h2 className="text-xl font-medium text-amber-500 mb-2 flex items-center gap-2">🔒 PRO 專屬權限</h2>
            <p className="text-slate-400 text-sm mb-6">升級 Pro 立即解鎖全市場代碼查詢，並每日獲取 AI 嚴選高勝率標的。</p>
            <a href="https://edenphoto6.gumroad.com/l/spgiui" target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-900 font-bold py-3 rounded-md mb-6 transition-all">Subscribe to Pro (NT$299)</a>
            <div className="border-t border-slate-800 pt-6">
              <div className="flex gap-2">
                <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} placeholder="輸入解鎖碼" className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-4 py-2 text-sm uppercase outline-none text-slate-300 focus:border-amber-500/50" />
                <button onClick={handleUnlock} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-md text-sm text-slate-300 transition-colors">Verify</button>
              </div>
            </div>
            <button onClick={() => setShowPaywall(false)} className="w-full text-center text-slate-500 hover:text-slate-400 text-xs mt-6 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className={`${igMode ? 'space-y-4' : 'max-w-6xl mx-auto space-y-6'}`}>
        
        <header className={`flex flex-col md:flex-row justify-between items-start md:items-end pb-6 gap-4 ${igMode ? 'hidden' : ''}`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-light tracking-tight text-slate-100">Auto-Invest<span className="font-semibold">Pro</span></h1>
              <button onClick={() => setLang(lang === "TW" ? "EN" : "TW")} className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-sm border border-slate-700 hover:bg-slate-700 transition-colors">
                {lang === "TW" ? "EN" : "中文"}
              </button>
              {isProUser && <span className="text-[10px] bg-amber-950/50 text-amber-400 px-2 py-1 rounded-sm border border-amber-900/50 uppercase tracking-widest shadow-[0_0_10px_rgba(217,119,6,0.2)]">Pro</span>}
            </div>
            
            <div className="flex bg-slate-900 rounded-md p-1 border border-slate-800 mt-3 w-fit">
              <button onClick={() => setUserMode("NOVICE")} className={`px-4 py-1.5 text-xs tracking-wider rounded-sm transition-colors ${userMode === "NOVICE" ? "bg-slate-800 text-slate-200 shadow" : "text-slate-500 hover:text-slate-300"}`}>{t.modeNovice}</button>
              <button onClick={() => setUserMode("VETERAN")} className={`px-4 py-1.5 text-xs tracking-wider rounded-sm transition-colors ${userMode === "VETERAN" ? "bg-slate-800 text-slate-200 shadow" : "text-slate-500 hover:text-slate-300"}`}>{t.modeVeteran}</button>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex bg-slate-900 rounded-md p-1 w-full md:w-auto border border-slate-800">
              <button onClick={() => { setMarket("TW"); setTickerInput(""); }} className={`flex-1 px-6 py-1.5 text-xs tracking-wider rounded-sm transition-colors ${market === "TW" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}>{t.marketTW}</button>
              <button onClick={() => { setMarket("US"); setTickerInput(""); }} className={`flex-1 px-6 py-1.5 text-xs tracking-wider rounded-sm transition-colors ${market === "US" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}>{t.marketUS}</button>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="text" value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()} placeholder={t.searchPh} autoComplete="off" autoCorrect="off" spellCheck="false" data-form-type="other" className="bg-slate-900 border border-slate-800 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-amber-500/50 w-full md:w-56 uppercase text-slate-200 transition-colors" />
              <button onClick={() => handleSearchClick()} disabled={isLoading || aiLoading} className="bg-slate-200 hover:bg-white text-slate-900 px-6 py-2 rounded-md text-sm font-medium transition-colors">{t.analyze}</button>
            </div>
            
            {/* 【完美整合 A】個人自選股清單 (Watchlist) */}
            <div className="flex flex-wrap gap-2 mt-1 justify-end max-w-md">
              <span className="text-[10px] text-slate-500 py-1 flex items-center gap-1">⭐ Watchlist:</span>
              {watchlist.length === 0 && <span className="text-[10px] text-slate-600 py-1">尚無自選</span>}
              {watchlist.map(tick => (
                <button key={tick} onClick={() => { setTickerInput(tick.replace('.TW','')); setMarket(tick.includes('.TW') ? "TW" : "US"); handleSearchClick(tick); }} className="text-[10px] text-slate-300 hover:text-white bg-slate-800/50 border border-slate-700 px-2 py-1 rounded transition-colors">{tick.replace('.TW','')}</button>
              ))}
            </div>
          </div>
        </header>

        <div className={`flex justify-between items-end pb-2 border-b border-slate-800 ${igMode ? 'pt-6 px-2' : ''}`}>
          <div>
            <div className="flex items-center gap-3">
              <h2 className={`${igMode ? 'text-3xl' : 'text-4xl'} font-light text-slate-100`}>{currentTicker.replace('.TW', '')}</h2>
              {/* 【完美整合 A】加入自選按鈕 */}
              {!igMode && currentTicker && !isLoading && (
                <button onClick={() => toggleWatchlist(currentTicker)} className={`text-xl transition-all hover:scale-110 ${inWatchlist ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'text-slate-600 hover:text-amber-400/50'}`} title="加入自選">★</button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{igMode ? 'AI Snapshot' : t.quoteLabel}</p>
          </div>
          {quoteData && (
            <div className="text-right">
              <div className="text-3xl font-medium text-slate-100">{quoteData.price}</div>
              <div className={`text-sm tracking-wide ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? '+' : ''}{quoteData.change} ({isUp ? '+' : ''}{quoteData.changePercent}%)
              </div>
            </div>
          )}
        </div>

        <div className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden relative ${igMode ? 'h-[240px]' : 'h-[400px]'}`}>
          {isLoading && <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-transparent via-slate-800/20 to-transparent h-full w-full animate-[scan_2s_ease-in-out_infinite]" />}
          {errorMsg && !isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900">
               <p className="text-rose-400 font-mono text-sm bg-rose-950/30 px-4 py-2 rounded border border-rose-900/50">⚠ {errorMsg}</p>
            </div>
          )}
          <div className="absolute top-4 left-4 z-10 flex gap-3 text-[10px] font-mono tracking-widest">
            <span className="text-emerald-500/80 cursor-help" title={userMode === "NOVICE" ? "月均線：代表過去一個月多數人的平均買進成本" : ""}>SMA 20 {userMode === "NOVICE" && "[?]"}</span>
            <span className="text-sky-500/80 cursor-help" title={userMode === "NOVICE" ? "布林通道：統計學上的股價正常波動範圍" : ""}>BB 20,2 {userMode === "NOVICE" && "[?]"}</span>
            {userMode === "VETERAN" && <span className="text-teal-500/80">VOL</span>}
          </div>
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        <div className={`grid grid-cols-1 ${igMode ? 'gap-4' : 'md:grid-cols-12 gap-6'}`}>
          <div className={`${igMode ? 'col-span-1' : 'md:col-span-6'} space-y-4`}>
             <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
               {/* 【完美整合 B】事件雷達 */}
               <h3 className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-widest mb-3 flex items-center gap-2"><span>📡</span> {t.fundDiag}</h3>
               <p className="text-slate-300 text-sm leading-relaxed font-light">
                 {aiLoading ? <span className="animate-pulse text-slate-500">Retrieving macro data & events...</span> : aiReport?.fundamentalSentiment || aiErrorMsg || "等待分析..."}
               </p>
             </div>
             <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-800">
               <div className="flex justify-between items-center mb-3">
                 <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{t.sysDiag}</h3>
                 {aiReport && <span className={`text-[10px] px-2 py-0.5 rounded-sm border ${(aiReport?.trendStatus || "").includes("多") || (aiReport?.trendStatus || "").includes("Bullish") ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" : "bg-rose-950/30 text-rose-400 border-rose-900/50"}`}>{aiReport?.trendStatus}</span>}
               </div>
               <p className="text-slate-300 text-sm leading-relaxed font-light">
                 {aiLoading ? <span className="animate-pulse text-slate-500">Analyzing patterns...</span> : aiReport?.diagnosis || aiErrorMsg || "等待分析..."}
               </p>
             </div>
          </div>

          <div className={`${igMode ? 'col-span-1' : 'md:col-span-6'} bg-slate-900/50 p-6 rounded-xl border border-slate-800 flex flex-col justify-between`}>
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">{t.action}</h3>
                {aiReport && <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-sm border border-slate-700">Win Rate: {aiReport?.winRateEstimate || "-"}</span>}
             </div>
             
             {aiLoading ? <p className="text-slate-500 text-sm animate-pulse">Calculating optimal entry vectors...</p> : aiReport ? (
               <div className="space-y-5 text-sm font-light">
                 <div className="border-l-2 border-slate-600 pl-4 py-1 bg-slate-800/20 rounded-r-md">
                   <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.entry}</span>
                   <span className="text-slate-200 font-medium">{aiReport?.actionPlan?.entry || "..."}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div className="border-l-2 border-rose-900/50 pl-4 py-2 bg-rose-950/10 rounded-r-md">
                     <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.stop}</span>
                     <span className="text-rose-400 font-mono text-lg">{aiReport?.actionPlan?.stopLoss || "-"}</span>
                   </div>
                   <div className="border-l-2 border-emerald-900/50 pl-4 py-2 bg-emerald-950/10 rounded-r-md">
                     <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">{t.target}</span>
                     <span className="text-emerald-400 font-mono text-lg">{aiReport?.actionPlan?.target || "-"}</span>
                   </div>
                 </div>
               </div>
             ) : <p className="text-slate-600 text-sm font-light">Awaiting parameters.</p>}
          </div>
        </div>

        {/* 【完美整合 C】AI 飆股掃描器 (Daily Top Picks - Paywall) */}
        {!igMode && (
          <div className="mt-8 border border-amber-900/40 bg-gradient-to-br from-slate-900 to-amber-950/10 rounded-xl p-6 relative overflow-hidden group transition-all duration-500">
            <h3 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>⚡ AI Daily Top Picks</span>
              {!isProUser && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-[4px] border border-amber-500/30">PRO ONLY</span>}
            </h3>
            
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-500 ${!isProUser ? 'blur-md opacity-40 select-none' : ''}`}>
              {/* 模擬的 Pro 資料卡片 */}
              {[
                { t: "MSTR", w: "High", d: "比特幣強勢突破，帶量站上均線" },
                { t: "2317", w: "High", d: "外資連買三日，法說會行情啟動" },
                { t: "TSLA", w: "Medium", d: "底部乖離過大，醞釀短線強彈" }
              ].map((pick, idx) => (
                <div key={idx} className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-200 font-bold">{pick.t}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/50">Win: {pick.w}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-light">{pick.d}</p>
                </div>
              ))}
            </div>

            {!isProUser && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm rounded-xl transition-all">
                 <p className="text-amber-400 mb-4 font-medium tracking-wide flex items-center gap-2 text-sm shadow-black drop-shadow-md">🔒 解鎖今日 3 檔高勝率飆股</p>
                 <button onClick={() => setShowPaywall(true)} className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-900 px-8 py-2.5 rounded-md text-sm font-bold transition-all shadow-[0_0_20px_rgba(217,119,6,0.3)] hover:shadow-[0_0_30px_rgba(217,119,6,0.6)] transform hover:-translate-y-0.5">
                   升級 Pro 立即觀看
                 </button>
              </div>
            )}
          </div>
        )}

      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <button onClick={() => setIgMode(!igMode)} className="bg-slate-800 border border-slate-700 text-slate-300 px-5 py-2.5 rounded-full shadow-xl hover:bg-slate-700 transition-all text-xs tracking-wider uppercase">
          {igMode ? 'Exit Snapshot' : 'IG Snapshot Mode'}
        </button>
      </div>

      <style jsx global>{`
        @keyframes scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
      `}</style>
    </main>
  );
}