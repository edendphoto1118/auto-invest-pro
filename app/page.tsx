"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, ColorType, Time } from "lightweight-charts";
import { fetchStockData, generateAIReport } from "./actions";

interface CandleData { time: Time; open: number; high: number; low: number; close: number; }
interface AIReportData { trendStatus: string; winRateEstimate: string; diagnosis: string; actionPlan: { entry: string; stopLoss: string; target: string; }; }

function calculateBollingerBands(data: CandleData[], period = 20, multiplier = 2) {
  const upperBand = []; const lowerBand = []; const movingAverage = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    const slice = data.slice(i - period + 1, i + 1);
    const sma = slice.reduce((acc, val) => acc + val.close, 0) / period;
    const variance = slice.reduce((acc, val) => acc + Math.pow(val.close - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);
    movingAverage.push({ time: data[i].time, value: sma });
    upperBand.push({ time: data[i].time, value: sma + sd * multiplier });
    lowerBand.push({ time: data[i].time, value: sma - sd * multiplier });
  }
  return { upperBand, lowerBand, movingAverage };
}

const FREE_TICKERS = ["AAPL", "2330.TW", "2330"];
// 【商業機密】你的付費解鎖碼，每個月可以手動來這裡改一次
const MONTHLY_PRO_CODE = "EDEN2026"; 

export default function AutoInvestDashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  
  const [isProUser, setIsProUser] = useState(false); 
  const [showPaywall, setShowPaywall] = useState(false);
  const [inputCode, setInputCode] = useState(""); // 解鎖碼輸入狀態

  const [market, setMarket] = useState<"US" | "TW">("US");
  const [tickerInput, setTickerInput] = useState("2330");
  const [currentTicker, setCurrentTicker] = useState("2330.TW");
  const [stockData, setStockData] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReportData | null>(null);
  const [aiError, setAiError] = useState("");
  
  // 打字機特效狀態
  const [typedDiagnosis, setTypedDiagnosis] = useState("");
  const [igMode, setIgMode] = useState(false); // IG 截圖模式

  useEffect(() => { setIsClient(true); executeSearch("2330.TW"); }, []);

  // 打字機特效邏輯
  useEffect(() => {
    if (aiReport && !aiLoading) {
      setTypedDiagnosis("");
      let i = 0;
      const text = aiReport.diagnosis;
      const timer = setInterval(() => {
        setTypedDiagnosis(text.substring(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(timer);
      }, 30); // 打字速度
      return () => clearInterval(timer);
    }
  }, [aiReport, aiLoading]);

  const handleSearchClick = () => {
    if (!tickerInput) return;
    let target = tickerInput.trim().toUpperCase();
    if (market === "TW" && !target.includes(".")) target += ".TW";

    if (!isProUser && !FREE_TICKERS.includes(target)) {
      setShowPaywall(true); return; 
    }
    setShowPaywall(false); executeSearch(target);
  };

  const handleUnlock = () => {
    if (inputCode.trim().toUpperCase() === MONTHLY_PRO_CODE) {
      setIsProUser(true); setShowPaywall(false); alert("解鎖成功！歡迎使用 Pro 版權限。");
    } else {
      alert("解鎖碼錯誤或已過期！請確認您的訂閱狀態。");
    }
  };

  const executeSearch = async (finalTicker: string) => {
    setIsLoading(true); setAiLoading(true); setErrorMsg(""); setAiError(""); setAiReport(null);
    const result = await fetchStockData(finalTicker);
    
    if (result.success && result.data) {
      setStockData(result.data); setCurrentTicker(finalTicker);
      const { upperBand, lowerBand, movingAverage } = calculateBollingerBands(result.data);
      if (movingAverage.length > 0) {
        const lastClose = result.data[result.data.length - 1].close;
        const recent5Days = result.data.slice(-5).map(d => d.close).join(" -> ");
        const aiResult = await generateAIReport(finalTicker, {
          lastClose, sma: movingAverage[movingAverage.length - 1].value.toFixed(2), 
          upper: upperBand[upperBand.length - 1].value.toFixed(2), 
          lower: lowerBand[lowerBand.length - 1].value.toFixed(2), recentTrend: recent5Days
        });
        if (aiResult.success) setAiReport(aiResult.data);
        else setAiError(aiResult.error || "運算失敗，請稍後再試。");
      }
    } else { setErrorMsg(result.error || "發生未知錯誤"); }
    setIsLoading(false); setAiLoading(false);
  };

  useEffect(() => {
    if (!isClient || !chartContainerRef.current || stockData.length === 0) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#D1D5DB' },
      grid: { vertLines: { color: '#374151', style: 1 }, horzLines: { color: '#374151', style: 1 } },
      crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: '#374151' }, timeScale: { borderColor: '#374151', timeVisible: true },
    });
    const candlestickSeries = chart.addCandlestickSeries({ upColor: '#10B981', downColor: '#EF4444', borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#EF4444' });
    candlestickSeries.setData(stockData);
    const { upperBand, lowerBand, movingAverage } = calculateBollingerBands(stockData);
    chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1 }).setData(upperBand);
    chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1 }).setData(lowerBand);
    chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.8)', lineWidth: 2 }).setData(movingAverage);
    chart.timeScale().fitContent();
    
    const handleResize = () => { if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [isClient, stockData]);

  if (!isClient) return <div className="min-h-screen bg-gray-900" />;

  return (
    <main className={`min-h-screen bg-gray-900 p-4 md:p-8 text-white font-sans transition-all ${igMode ? 'max-w-md mx-auto border-4 border-gray-800 rounded-3xl pb-20 mt-10 shadow-2xl scale-105' : ''}`}>
      
      {/* 付費牆 + 解鎖碼輸入 (MVP 商業模式) */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/90 backdrop-blur-md p-4 transition-all">
          <div className="bg-gray-800 border border-yellow-500/30 rounded-2xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <h2 className="text-2xl font-bold text-center text-white mb-2">解鎖 Auto-Invest Pro</h2>
            <p className="text-gray-400 text-center text-sm mb-6">免費版僅提供 AAPL 與 台積電 (2330)。<br/>升級解鎖全球股市 AI 量化策略。</p>
            
            <a href="https://edenphoto6.gumroad.com/l/spgiui" target="_blank" className="block w-full text-center bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-gray-900 font-bold py-3 rounded-lg transition-all shadow-lg mb-4">
  💳 獲取本月解鎖碼 (NT$ 299)
</a>

            <div className="relative mt-6 border-t border-gray-700 pt-6">
              <label className="text-xs text-gray-400 mb-2 block">已訂閱？輸入 Email 收到的解鎖碼：</label>
              <div className="flex gap-2">
                <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} placeholder="例如: EDEN2026" className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-sm uppercase tracking-widest focus:border-yellow-500 outline-none" />
                <button onClick={handleUnlock} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-bold transition-colors">解鎖</button>
              </div>
            </div>
            
            <button onClick={() => setShowPaywall(false)} className="w-full text-center text-gray-500 hover:text-gray-300 text-sm mt-6 transition-colors">先不用，我繼續看免費標的</button>
          </div>
        </div>
      )}

      {/* 儀表板主體 */}
      <div className={`${igMode ? 'space-y-4' : 'max-w-7xl mx-auto space-y-6'}`}>
        
        {/* 頂部 Header */}
        <header className={`flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-700 pb-4 gap-4 ${igMode ? 'hidden' : ''}`}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Auto-Invest Pro
              {isProUser && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">PRO</span>}
            </h1>
            <p className="text-sm text-gray-400 mt-1">首席量化交易儀表板</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex bg-gray-800 rounded-lg p-1 w-full md:w-auto">
              <button onClick={() => { setMarket("US"); setTickerInput(""); }} className={`flex-1 px-6 py-1.5 text-sm font-medium rounded-md ${market === "US" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-700"}`}>🇺🇸 美股</button>
              <button onClick={() => { setMarket("TW"); setTickerInput(""); }} className={`flex-1 px-6 py-1.5 text-sm font-medium rounded-md ${market === "TW" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-700"}`}>🇹🇼 台股</button>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="text" value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()} placeholder={market === "US" ? "輸入美股 (例: NVDA)" : "輸入台股 (例: 2330)"} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 w-full md:w-64 uppercase" />
              <button onClick={handleSearchClick} disabled={isLoading || aiLoading} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium shadow-md">分析</button>
            </div>
          </div>
        </header>

        {/* IG 模式專屬 Header */}
        {igMode && (
          <div className="text-center pt-4 pb-2">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">{currentTicker}</h2>
            <p className="text-xs text-gray-500">Auto-Invest Pro AI 診斷</p>
          </div>
        )}

        {/* 圖表渲染區 (含雷達掃描特效) */}
        <div className={`bg-gray-800 border border-gray-700 rounded-xl overflow-hidden relative shadow-2xl ${igMode ? 'h-[300px]' : 'h-[500px]'}`}>
          {isLoading && <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-transparent via-blue-500/10 to-transparent h-full w-full animate-[scan_2s_ease-in-out_infinite]" />}
          <div className="absolute top-4 left-4 z-10 flex gap-2 text-xs font-mono">
            <span className="bg-gray-900/80 px-2 py-1 rounded text-green-400">SMA 20</span>
            <span className="bg-gray-900/80 px-2 py-1 rounded text-blue-400">BB (20, 2)</span>
          </div>
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        {/* AI 戰術卡片區 */}
        <div className={`grid grid-cols-1 ${igMode ? 'gap-4' : 'md:grid-cols-3 gap-6'}`}>
          {/* 核心診斷 (打字機特效) */}
          <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-lg">
             <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-3">
               <h3 className="text-md font-semibold text-gray-100">AI 位階診斷</h3>
               {aiReport && <span className={`text-xs px-2 py-1 rounded font-bold ${aiReport.trendStatus.includes("多") ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>{aiReport.trendStatus}</span>}
             </div>
             <p className="text-gray-300 text-sm leading-relaxed min-h-[60px]">
               {aiLoading ? <span className="animate-pulse text-blue-400">▍神經網路運算中...</span> : aiError ? <span className="text-red-400">{aiError}</span> : typedDiagnosis || "等待數據注入。"}
             </p>
          </div>

          {/* 實戰劇本 */}
          <div className={`${igMode ? 'col-span-1' : 'md:col-span-2'} bg-blue-900/20 p-5 rounded-xl border border-blue-800/50 relative overflow-hidden`}>
             <h3 className="text-md font-semibold text-blue-400 border-b border-blue-800/50 pb-2 mb-3">🎯 量化實戰劇本 (目標翻倍)</h3>
             {aiLoading ? <p className="text-blue-300/70 text-sm animate-pulse">生成具體點位中...</p> : aiReport ? (
               <div className="space-y-3 mt-2 text-sm">
                 <div className="bg-blue-950/50 p-2 rounded border border-blue-900 flex justify-between">
                   <span className="text-blue-300/70">進場策略</span>
                   <span className="text-blue-100 font-medium text-right w-2/3">{aiReport.actionPlan.entry}</span>
                 </div>
                 <div className="flex gap-2">
                   <div className="flex-1 bg-red-950/30 p-2 rounded border border-red-900/30 text-center">
                     <span className="block text-xs text-red-400/70 mb-1">嚴格停損</span>
                     <span className="text-red-200 font-mono font-bold">{aiReport.actionPlan.stopLoss}</span>
                   </div>
                   <div className="flex-1 bg-green-950/30 p-2 rounded border border-green-900/30 text-center">
                     <span className="block text-xs text-green-400/70 mb-1">目標停利</span>
                     <span className="text-green-200 font-mono font-bold">{aiReport.actionPlan.target}</span>
                   </div>
                 </div>
               </div>
             ) : <p className="text-blue-300/50 text-sm">等待輸入標的。</p>}
          </div>
        </div>

        {/* 原生廣告位 (聯盟行銷 - 你的被動收入印鈔機) */}
        {!igMode && (
          <a href="https://www.interactivebrokers.com/" target="_blank" className="block mt-6 bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 p-4 rounded-xl hover:border-blue-500/50 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <div className="flex justify-between items-center ml-2">
              <div>
                <p className="text-xs text-blue-400 font-bold mb-1">🤝 Auto-Invest Pro 專屬福利</p>
                <h4 className="text-sm text-gray-200 font-medium">使用專屬連結開立頂級美股帳戶，最高可領取 $1,000 美金迎新獎勵。</h4>
              </div>
              <span className="text-gray-500 group-hover:text-blue-400 transition-colors">➔</span>
            </div>
          </a>
        )}
      </div>

      {/* 浮動控制列 (截圖與模式切換) */}
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        <button onClick={() => setIgMode(!igMode)} className="bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-gray-700 transition-all font-bold text-sm flex items-center gap-2">
          {igMode ? '❌ 退出截圖' : '📱 IG 報牌截圖模式'}
        </button>
      </div>

      {/* Tailwind 自訂動畫定義 */}
      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </main>
  );
}