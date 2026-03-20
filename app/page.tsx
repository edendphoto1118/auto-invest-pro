"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, ColorType, Time } from "lightweight-charts";
import { fetchStockData } from "./actions";

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ==========================================
// 1. 核心演算法：自動計算布林通道 (Bollinger Bands)
// ==========================================
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

// ==========================================
// 2. 儀表板主結構與圖表渲染
// ==========================================
export default function AutoInvestDashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  
  // 狀態管理 (Data State)
  const [market, setMarket] = useState<"US" | "TW">("US"); // 新增：市場選擇狀態
  const [tickerInput, setTickerInput] = useState("AAPL");
  const [currentTicker, setCurrentTicker] = useState("AAPL");
  const [stockData, setStockData] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setIsClient(true);
    handleSearch("AAPL"); 
  }, []);

  // 觸發資料抓取 (加入自動補全邏輯)
  const handleSearch = async (targetTicker: string) => {
    if (!targetTicker) return;
    setIsLoading(true);
    setErrorMsg("");
    
    let finalTicker = targetTicker.trim().toUpperCase();
    
    // 防呆機制：如果選台股，且用戶沒有自己打 .TW，系統自動補上
    if (market === "TW" && !finalTicker.includes(".")) {
      finalTicker += ".TW";
    }
    
    const result = await fetchStockData(finalTicker);
    
    if (result.success && result.data) {
      setStockData(result.data);
      setCurrentTicker(finalTicker);
    } else {
      setErrorMsg(result.error || "發生未知錯誤，請確認代碼是否正確");
    }
    setIsLoading(false);
  };

  // 監聽數據變化並重新渲染圖表
  useEffect(() => {
    if (!isClient || !chartContainerRef.current || stockData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#D1D5DB' },
      grid: { vertLines: { color: '#374151' }, horzLines: { color: '#374151' } },
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

    const upperSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1 });
    upperSeries.setData(upperBand);

    const lowerSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1 });
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
    <main className="min-h-screen bg-gray-900 p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 頂部控制列 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-700 pb-4 gap-4">
          <div className="mb-2 md:mb-0">
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Auto-Invest Pro
              {isLoading && <span className="text-sm bg-blue-600/20 text-blue-400 px-2 py-1 rounded animate-pulse">抓取數據中...</span>}
            </h1>
            <p className="text-sm text-gray-400 mt-1">AI 智能投資儀表板 - 目前標的：<span className="text-blue-400 font-mono">{currentTicker}</span></p>
          </div>
          
          <div className="flex flex-col items-end gap-3 w-full md:w-auto">
            {/* 新增：市場切換開關 (Segmented Control) */}
            <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 w-full md:w-auto">
              <button
                onClick={() => { setMarket("US"); setTickerInput(""); }}
                className={`flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  market === "US" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                🇺🇸 美股
              </button>
              <button
                onClick={() => { setMarket("TW"); setTickerInput(""); }}
                className={`flex-1 md:flex-none px-6 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  market === "TW" ? "bg-blue-600 text-white shadow-md" : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                🇹🇼 台股
              </button>
            </div>

            {/* 搜尋列 */}
            <div className="flex gap-2 w-full md:w-auto">
              <input 
                type="text" 
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(tickerInput)}
                // 動態提示字元，依照選擇的市場改變
                placeholder={market === "US" ? "輸入美股代碼 (例: NVDA)" : "輸入台股股號 (例: 2330)"} 
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500 w-full md:w-64 uppercase transition-colors" 
              />
              <button 
                onClick={() => handleSearch(tickerInput)}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded-lg font-medium transition-all shadow-md whitespace-nowrap"
              >
                分析
              </button>
            </div>
            {errorMsg && <span className="text-red-400 text-sm">{errorMsg}</span>}
          </div>
        </header>

        {/* 圖表渲染區 */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-4 left-4 z-10 flex gap-3 text-xs font-mono">
            <span className="bg-gray-900/80 px-2 py-1 rounded text-green-400 shadow backdrop-blur-sm">SMA 20</span>
            <span className="bg-gray-900/80 px-2 py-1 rounded text-blue-400 shadow backdrop-blur-sm">BB (20, 2)</span>
          </div>
          <div ref={chartContainerRef} className="w-full h-[500px]" />
        </div>

        {/* AI 資訊區 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
             <h3 className="text-lg font-semibold mb-2">技術面診斷</h3>
             <p className="text-gray-400 text-sm">請點擊上方按鈕載入目標，準備進行 AI 運算...</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
             <h3 className="text-lg font-semibold mb-2">近期高低點</h3>
             {stockData.length > 0 ? (
               <div className="text-sm text-gray-300 space-y-2 mt-4">
                 <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span>最新收盤價</span>
                    <span className="text-white font-mono font-medium">{stockData[stockData.length - 1].close}</span>
                 </div>
                 <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span>數據區間</span>
                    <span className="text-white font-mono">{stockData.length} 個交易日</span>
                 </div>
               </div>
             ) : (
               <p className="text-gray-400 text-sm">等待數據載入...</p>
             )}
          </div>
          <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
             <h3 className="text-lg font-semibold mb-2 text-blue-400 relative z-10">💡 具體行動建議</h3>
             <p className="text-blue-200/70 text-sm relative z-10">即將導入 LLM 模型進行策略生成...</p>
          </div>
        </div>
      </div>
    </main>
  );
}