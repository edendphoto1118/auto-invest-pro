"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, ColorType, Time } from "lightweight-charts";
import { fetchStockData, generateAIReport } from "./actions";

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface AIReportData {
  trendStatus: string;
  winRateEstimate: string;
  diagnosis: string;
  actionPlan: {
    entry: string;
    stopLoss: string;
    target: string;
  };
}

function calculateBollingerBands(data: CandleData[], period = 20, multiplier = 2) {
  const upperBand = [];
  const lowerBand = [];
  const movingAverage = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, val) => acc + val.close, 0);
    const sma = sum / period;
    const variance = slice.reduce((acc, val) => acc + Math.pow(val.close - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);

    movingAverage.push({ time: data[i].time, value: sma });
    upperBand.push({ time: data[i].time, value: sma + sd * multiplier });
    lowerBand.push({ time: data[i].time, value: sma - sd * multiplier });
  }
  return { upperBand, lowerBand, movingAverage };
}

const FREE_TICKERS = ["AAPL", "2330.TW", "2330"]; 

export default function AutoInvestDashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  
  const [isProUser, setIsProUser] = useState(false); 
  const [showPaywall, setShowPaywall] = useState(false);

  const [market, setMarket] = useState<"US" | "TW">("US");
  const [tickerInput, setTickerInput] = useState("2330");
  const [currentTicker, setCurrentTicker] = useState("2330.TW");
  const [stockData, setStockData] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReportData | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    setIsClient(true);
    executeSearch("2330.TW"); 
  }, []);

  const handleSearchClick = () => {
    if (!tickerInput) return;
    
    let target = tickerInput.trim().toUpperCase();
    if (market === "TW" && !target.includes(".")) target += ".TW";

    if (!isProUser && !FREE_TICKERS.includes(target)) {
      setShowPaywall(true);
      return; 
    }

    setShowPaywall(false);
    executeSearch(target);
  };

  const executeSearch = async (finalTicker: string) => {
    setIsLoading(true);
    setAiLoading(true);
    setErrorMsg("");
    setAiError("");
    setAiReport(null);
    
    const result = await fetchStockData(finalTicker);
    
    if (result.success && result.data) {
      setStockData(result.data);
      setCurrentTicker(finalTicker);
      
      const { upperBand, lowerBand, movingAverage } = calculateBollingerBands(result.data);
      if (movingAverage.length > 0) {
        const lastClose = result.data[result.data.length - 1].close;
        const currentSMA = movingAverage[movingAverage.length - 1].value.toFixed(2);
        const currentUpper = upperBand[upperBand.length - 1].value.toFixed(2);
        const currentLower = lowerBand[lowerBand.length - 1].value.toFixed(2);
        
        // 抓取近五日趨勢供 AI 判斷動能
        const recent5Days = result.data.slice(-5).map(d => d.close).join(" -> ");
        
        const aiResult = await generateAIReport(finalTicker, {
          lastClose, sma: currentSMA, upper: currentUpper, lower: currentLower, recentTrend: recent5Days
        });

        if (aiResult.success) {
          setAiReport(aiResult.data);
        } else {
          setAiError(aiResult.error || "運算失敗，請稍後再試。");
        }
      }
    } else {
      setErrorMsg(result.error || "發生未知錯誤");
    }
    setIsLoading(false);
    setAiLoading(false);
  };

  useEffect(() => {
    if (!isClient || !chartContainerRef.current || stockData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#D1D5DB' },
      grid: { vertLines: { color: '#374151', style: 1 }, horzLines: { color: '#374151', style: 1 } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981', downColor: '#EF4444', borderVisible: false,
      wickUpColor: '#10B981', wickDownColor: '#EF4444',
    });
    candlestickSeries.setData(stockData);

    const { upperBand, lowerBand, movingAverage } = calculateBollingerBands(stockData);

    const upperSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1 });
    upperSeries.setData(upperBand);
    const lowerSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.4)', lineWidth: 1 });
    lowerSeries.setData(lowerBand);
    const smaSeries = chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.8)', lineWidth: 2 });
    smaSeries.setData(movingAverage);

    chart.timeScale().fitContent();
    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [isClient, stockData]);

  if (!isClient) return <div className="min-h-screen bg-gray-900" />;

  return (
    <main className="min-h-screen bg-gray-900 p-8 text-white font-sans relative">
      {/* 付費牆 */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-md p-4 transition-all">
          <div className="bg-gray-800 border border-yellow-500/30 rounded-2xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="flex justify-center mb-6">
              <span className="bg-yellow-500/20 text-yellow-400 p-3 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-center text-white mb-2">解鎖 Auto-Invest Pro</h2>
            <p className="text-gray-400 text-center text-sm mb-6">
              免費版僅提供 AAPL 與 台積電 (2330) 查詢。<br/>升級 Pro 即可解鎖全球股市 AI 量化策略。
            </p>
            <ul className="space-y-3 mb-8 text-sm text-gray-300">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 無限制查詢美股、台股代碼</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 解鎖具體進場、停損、停利點位</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 獨家勝率評估系統</li>
            </ul>
            <button onClick={() => alert("目前為展示模式，下一步我們將串接真實 Stripe 金流！")} className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-gray-900 font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-yellow-500/25">
              升級解鎖 (NT$ 299 / 月)
            </button>
            <button onClick={() => setShowPaywall(false)} className="w-full text-center text-gray-500 hover:text-gray-300 text-sm mt-4 transition-colors">
              先不用，我繼續看免費標的
            </button>
          </div>
        </div>
      )}

      {/* 儀表板主體 */}
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-700 pb-4 gap-4">
          <div className="mb-2 md:mb-0">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Auto-Invest Pro
              {isProUser && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/30">PRO</span>}
              {isLoading && <span className="text-sm bg-blue-600/20 text-blue-400 px-2 py-1 rounded animate-pulse">抓取數據中...</span>}
            </h1>
            <p className="text-sm text-gray-400 mt-1">AI 智能投資儀表板 - 目前標的：<span className="text-blue-400 font-mono">{currentTicker}</span></p>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 w-full md:w-auto">
              <button onClick={() => { setMarket("US"); setTickerInput(""); }} className={`flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${market === "US" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>
                🇺🇸 美股
              </button>
              <button onClick={() => { setMarket("TW"); setTickerInput(""); }} className={`flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${market === "TW" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}>
                🇹🇼 台股
              </button>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="text" value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()} placeholder={market === "US" ? "輸入美股代碼 (例: NVDA)" : "輸入台股股號 (例: 2330)"} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 w-full md:w-64 uppercase transition-colors" />
              <button onClick={handleSearchClick} disabled={isLoading || aiLoading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded-lg font-medium transition-all shadow-md whitespace-nowrap">
                分析
              </button>
            </div>
            {errorMsg && <span className="text-red-400 text-sm">{errorMsg}</span>}
          </div>
        </header>

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-4 left-4 z-10 flex gap-3 text-xs font-mono">
            <span className="bg-gray-900/80 px-2 py-1 rounded text-green-400 shadow backdrop-blur-sm">SMA 20</span>
            <span className="bg-gray-900/80 px-2 py-1 rounded text-blue-400 shadow backdrop-blur-sm">BB (20, 2)</span>
          </div>
          <div ref={chartContainerRef} className="w-full h-[500px]" />
        </div>

        {/* 升級後的實用儀表板 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 卡片 1：技術面核心診斷 */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
             <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-3">
               <h3 className="text-lg font-semibold text-gray-100">核心診斷</h3>
               {aiReport && (
                 <span className={`text-xs px-2 py-1 rounded font-bold ${aiReport.trendStatus.includes("多") ? "bg-green-900/50 text-green-400" : aiReport.trendStatus.includes("空") ? "bg-red-900/50 text-red-400" : "bg-yellow-900/50 text-yellow-400"}`}>
                   {aiReport.trendStatus}
                 </span>
               )}
             </div>
             <div className="flex-1">
               {aiLoading ? (
                 <p className="text-blue-400 text-sm animate-pulse">量化大腦解析中...</p>
               ) : aiError ? (
                 <p className="text-red-400 text-sm">{aiError}</p>
               ) : aiReport ? (
                 <p className="text-gray-300 text-sm leading-relaxed">{aiReport.diagnosis}</p>
               ) : (
                 <p className="text-gray-500 text-sm">等待輸入標的。</p>
               )}
             </div>
          </div>

          {/* 卡片 2：勝率與量化基準 */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col">
             <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-3">
               <h3 className="text-lg font-semibold text-gray-100">建倉勝率評估</h3>
               {aiReport && (
                 <span className={`text-xs px-2 py-1 rounded font-bold ${aiReport.winRateEstimate.includes("高") ? "bg-green-600 text-white" : aiReport.winRateEstimate.includes("中") ? "bg-yellow-600 text-white" : "bg-red-600 text-white"}`}>
                   {aiReport.winRateEstimate}
                 </span>
               )}
             </div>
             {stockData.length > 0 ? (
               <div className="text-sm text-gray-300 space-y-3">
                 <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded">
                    <span>最新收盤</span>
                    <span className="text-white font-mono font-medium text-base">{stockData[stockData.length - 1].close}</span>
                 </div>
                 {aiLoading ? (
                    <p className="text-blue-400 text-xs animate-pulse text-center mt-2">評估勝率中...</p>
                 ) : aiReport ? (
                    <p className="text-gray-400 text-xs text-center mt-2">基於當前位階與均線乖離率計算</p>
                 ) : null}
               </div>
             ) : (
               <p className="text-gray-500 text-sm mt-4">等待數據載入...</p>
             )}
          </div>

          {/* 卡片 3：具體行動計畫 (無腦執行區) */}
          <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800 shadow-lg relative overflow-hidden flex flex-col">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <h3 className="text-lg font-semibold mb-3 text-blue-400 relative z-10 border-b border-blue-800/50 pb-2">🎯 實戰交易劇本</h3>
             <div className="flex-1 relative z-10">
               {aiLoading ? (
                 <p className="text-blue-300/70 text-sm animate-pulse">生成具體點位中...</p>
               ) : aiError ? (
                 <p className="text-red-400 text-sm">無法生成計畫</p>
               ) : aiReport ? (
                 <div className="space-y-3 mt-2 text-sm">
                   <div className="bg-blue-950/50 p-2 rounded border border-blue-900">
                     <span className="block text-xs text-blue-300/70 mb-1">【進場策略】</span>
                     <span className="text-blue-100 font-medium">{aiReport.actionPlan.entry}</span>
                   </div>
                   <div className="flex gap-2">
                     <div className="flex-1 bg-red-950/30 p-2 rounded border border-red-900/30">
                       <span className="block text-xs text-red-400/70 mb-1">【嚴格停損】</span>
                       <span className="text-red-200 font-mono">{aiReport.actionPlan.stopLoss}</span>
                     </div>
                     <div className="flex-1 bg-green-950/30 p-2 rounded border border-green-900/30">
                       <span className="block text-xs text-green-400/70 mb-1">【目標停利】</span>
                       <span className="text-green-200 font-mono">{aiReport.actionPlan.target}</span>
                     </div>
                   </div>
                 </div>
               ) : (
                 <p className="text-blue-300/50 text-sm">等待輸入標的。</p>
               )}
             </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-50">
        <button 
          onClick={() => setIsProUser(!isProUser)}
          className="bg-gray-800 border border-gray-600 text-gray-400 text-xs px-3 py-1 rounded opacity-50 hover:opacity-100 transition-opacity"
        >
          測試模式：{isProUser ? "切換回免費用戶" : "一鍵解鎖 Pro"}
        </button>
      </div>
    </main>
  );
}