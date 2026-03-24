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
const MONTHLY_PRO_CODE = "EDEN2026"; 

export default function AutoInvestDashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isProUser, setIsProUser] = useState(false); 
  const [showPaywall, setShowPaywall] = useState(false);
  const [inputCode, setInputCode] = useState("");

  const [market, setMarket] = useState<"US" | "TW">("US");
  const [tickerInput, setTickerInput] = useState("2330");
  const [currentTicker, setCurrentTicker] = useState("2330.TW");
  const [stockData, setStockData] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReportData | null>(null);
  const [aiError, setAiError] = useState("");
  
  const [typedDiagnosis, setTypedDiagnosis] = useState("");
  const [igMode, setIgMode] = useState(false);

  useEffect(() => { setIsClient(true); executeSearch("2330.TW"); }, []);

  useEffect(() => {
    if (aiReport && !aiLoading) {
      setTypedDiagnosis("");
      let i = 0;
      const text = aiReport.diagnosis;
      const timer = setInterval(() => {
        setTypedDiagnosis(text.substring(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(timer);
      }, 20);
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
      setIsProUser(true); setShowPaywall(false);
    } else {
      alert("Invalid Access Code.");
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
        else setAiError(aiResult.error || "Processing failed.");
      }
    } else { setErrorMsg(result.error || "Data retrieval failed."); }
    setIsLoading(false); setAiLoading(false);
  };

  useEffect(() => {
    if (!isClient || !chartContainerRef.current || stockData.length === 0) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0F172A' }, textColor: '#94A3B8' },
      grid: { vertLines: { color: '#1E293B', style: 1 }, horzLines: { color: '#1E293B', style: 1 } },
      crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: '#334155' }, timeScale: { borderColor: '#334155', timeVisible: true },
    });
    const candlestickSeries = chart.addCandlestickSeries({ upColor: '#10B981', downColor: '#F43F5E', borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#F43F5E' });
    candlestickSeries.setData(stockData);
    const { upperBand, lowerBand, movingAverage } = calculateBollingerBands(stockData);
    chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.3)', lineWidth: 1 }).setData(upperBand);
    chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.3)', lineWidth: 1 }).setData(lowerBand);
    chart.addLineSeries({ color: 'rgba(234, 179, 8, 0.7)', lineWidth: 2 }).setData(movingAverage);
    chart.timeScale().fitContent();
    
    const handleResize = () => { if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [isClient, stockData]);

  if (!isClient) return <div className="min-h-screen bg-slate-950" />;

  return (
    <main className={`min-h-screen bg-slate-950 p-4 md:p-8 text-slate-200 font-sans tracking-wide transition-all ${igMode ? 'max-w-md mx-auto border border-slate-800 rounded-xl pb-20 mt-10 shadow-2xl' : ''}`}>
      
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4 transition-all">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-8 relative">
            <h2 className="text-xl font-medium text-slate-100 mb-2 tracking-tight">Access Restricted</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">Upgrade to Pro to unlock advanced AI quantitative analysis and global market data.</p>
            
            <a href="https://edenphoto6.gumroad.com/l/spgiui" target="_blank" className="block w-full text-center bg-slate-100 hover:bg-white text-slate-900 font-medium py-3 rounded-md transition-colors text-sm mb-6">
              Subscribe to Pro
            </a>

            <div className="relative border-t border-slate-800 pt-6">
              <label className="text-xs text-slate-500 mb-2 block uppercase tracking-widest">Enter Access Code</label>
              <div className="flex gap-2">
                <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} placeholder="Code" className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-4 py-2 text-sm uppercase focus:border-slate-600 outline-none transition-colors text-slate-300" />
                <button onClick={handleUnlock} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors text-slate-300">Verify</button>
              </div>
            </div>
            
            <button onClick={() => setShowPaywall(false)} className="w-full text-center text-slate-500 hover:text-slate-400 text-xs mt-6 transition-colors">Return to free version</button>
          </div>
        </div>
      )}

      <div className={`${igMode ? 'space-y-4' : 'max-w-6xl mx-auto space-y-6'}`}>
        
        <header className={`flex flex-col md:flex-row justify-between items-start md:items-end pb-6 gap-4 ${igMode ? 'hidden' : ''}`}>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-slate-100 flex items-center gap-3">
              Auto-Invest<span className="font-semibold">Pro</span>
              {isProUser && <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-sm border border-emerald-900/50 uppercase tracking-wider">Active</span>}
            </h1>
            <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest">Quantitative AI Dashboard</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            <div className="flex bg-slate-900 rounded-md p-1 w-full md:w-auto border border-slate-800">
              <button onClick={() => { setMarket("US"); setTickerInput(""); }} className={`flex-1 px-6 py-1.5 text-xs tracking-wider rounded-sm transition-colors ${market === "US" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}>US</button>
              <button onClick={() => { setMarket("TW"); setTickerInput(""); }} className={`flex-1 px-6 py-1.5 text-xs tracking-wider rounded-sm transition-colors ${market === "TW" ? "bg-slate-800 text-slate-200" : "text-slate-500 hover:text-slate-300"}`}>TW</button>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input type="text" value={tickerInput} onChange={(e) => setTickerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()} placeholder={market === "US" ? "Ticker (e.g. NVDA)" : "Ticker (e.g. 2330)"} className="bg-slate-900 border border-slate-800 rounded-md px-4 py-2 text-sm focus:outline-none focus:border-slate-600 w-full md:w-48 uppercase text-slate-200 placeholder-slate-600 transition-colors" />
              <button onClick={handleSearchClick} disabled={isLoading || aiLoading} className="bg-slate-200 hover:bg-white text-slate-900 px-6 py-2 rounded-md text-sm font-medium transition-colors">Analyze</button>
            </div>
          </div>
        </header>

        {igMode && (
          <div className="text-left pt-6 pb-2 px-2 border-b border-slate-800">
            <h2 className="text-3xl font-light text-slate-100">{currentTicker}</h2>
            <p className="text-xs text-emerald-400/80 mt-1 uppercase tracking-widest">AI Market Diagnosis</p>
          </div>
        )}

        <div className={`bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden relative ${igMode ? 'h-[280px]' : 'h-[450px]'}`}>
          {isLoading && <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-transparent via-slate-800/20 to-transparent h-full w-full animate-[scan_2s_ease-in-out_infinite]" />}
          <div className="absolute top-4 left-4 z-10 flex gap-3 text-[10px] font-mono tracking-widest">
            <span className="text-emerald-500/80">SMA 20</span>
            <span className="text-sky-500/80">BB 20,2</span>
          </div>
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        <div className={`grid grid-cols-1 ${igMode ? 'gap-4' : 'md:grid-cols-12 gap-6'}`}>
          <div className={`${igMode ? 'col-span-1' : 'md:col-span-5'} bg-slate-900/50 p-6 rounded-xl border border-slate-800`}>
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">System Diagnosis</h3>
               {aiReport && <span className={`text-[10px] px-2 py-0.5 rounded-sm border ${aiReport.trendStatus.includes("多") ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" : "bg-rose-950/30 text-rose-400 border-rose-900/50"}`}>{aiReport.trendStatus}</span>}
             </div>
             <p className="text-slate-300 text-sm leading-loose min-h-[80px] font-light">
               {aiLoading ? <span className="animate-pulse text-slate-500">Awaiting neural network response...</span> : aiError ? <span className="text-rose-400">{aiError}</span> : typedDiagnosis || "Input ticker to initialize."}
             </p>
          </div>

          <div className={`${igMode ? 'col-span-1' : 'md:col-span-7'} bg-slate-900/50 p-6 rounded-xl border border-slate-800 flex flex-col justify-between`}>
             <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Action Protocol</h3>
             {aiLoading ? <p className="text-slate-500 text-sm animate-pulse">Calculating optimal entry vectors...</p> : aiReport ? (
               <div className="space-y-4 text-sm font-light">
                 <div className="border-l-2 border-slate-700 pl-4 py-1">
                   <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Entry Strategy</span>
                   <span className="text-slate-200">{aiReport.actionPlan.entry}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-6 pt-2">
                   <div className="border-l-2 border-rose-900/50 pl-4 py-1">
                     <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Strict Stop-Loss</span>
                     <span className="text-rose-400 font-mono">{aiReport.actionPlan.stopLoss}</span>
                   </div>
                   <div className="border-l-2 border-emerald-900/50 pl-4 py-1">
                     <span className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">Target Take-Profit</span>
                     <span className="text-emerald-400 font-mono">{aiReport.actionPlan.target}</span>
                   </div>
                 </div>
               </div>
             ) : <p className="text-slate-600 text-sm font-light">Awaiting parameters.</p>}
          </div>
        </div>

        {!igMode && (
          <a href="YOUR_AFFILIATE_LINK_HERE" target="_blank" className="block mt-8 p-5 rounded-xl border border-slate-800/60 bg-slate-900/30 hover:bg-slate-900/80 transition-all group">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Partner Offer</p>
                <h4 className="text-sm text-slate-300 font-light">Open a premium brokerage account to execute these strategies with zero commissions.</h4>
              </div>
              <span className="text-slate-600 group-hover:text-slate-300 transition-colors text-xl font-light">→</span>
            </div>
          </a>
        )}
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <button onClick={() => setIgMode(!igMode)} className="bg-slate-800 border border-slate-700 text-slate-300 px-5 py-2.5 rounded-full shadow-xl hover:bg-slate-700 transition-all text-xs tracking-wider uppercase">
          {igMode ? 'Exit Snapshot' : 'IG Snapshot Mode'}
        </button>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </main>
  );
}