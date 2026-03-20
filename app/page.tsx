"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, ColorType, Time } from "lightweight-charts";
import { fetchStockData } from "./actions"; // 引入我們剛建好的後台引擎

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
  const [tickerInput, setTickerInput] = useState("AAPL");
  const [currentTicker, setCurrentTicker] = useState("AAPL");
  const [stockData, setStockData] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 確保只在客戶端渲染
  useEffect(() => {
    setIsClient(true);
    handleSearch("AAPL"); // 初始載入蘋果公司股票
  }, []);

  // 觸發資料抓取
  const handleSearch = async (targetTicker: string) => {
    if (!targetTicker) return;
    setIsLoading(true);
    setErrorMsg("");
    
    const result = await fetchStockData(targetTicker);
    
    if (result.success && result.data) {
      setStockData(result.data);
      setCurrentTicker(targetTicker.toUpperCase());
    } else {
      setErrorMsg(result.error || "發生未知錯誤");
    }
    setIsLoading(false);
  };

  // 監聽數據變化並重新渲染圖表 (完全銷毀再重建，確保無記憶體洩漏與殘影)
  useEffect(() => {
    if (!isClient || !chartContainerRef.current || stockData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#D1D5DB' },
      grid: { vertLines: { color: '#374151' }, horzLines: { color: '#374151' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true },
    });

    // 繪製 K 線圖
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981', downColor: '#EF4444', borderVisible: false,
      wickUpColor: '#10B981', wickDownColor: '#EF4444',
    });
    candlestickSeries.setData(stockData);

    // 運算並繪製技術指標
    const { upperBand, lowerBand, movingAverage } = calculateBollingerBands(stockData);

    const upperSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1 });
    upperSeries.setData(upperBand);

    const lowerSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1 });
    lowerSeries.setData(lowerBand);

    const smaSeries = chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.8)', lineWidth: 2 });
    smaSeries.setData(movingAverage);

    // 自適應與畫面聚焦
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
  }, [isClient, stockData]); // 依賴陣列加入 stockData，當數據更新時觸發重繪

  if (!isClient) return <div className="min-h-screen bg-gray-900" />;

  return (
    <main className="min-h-screen bg-gray-900 p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 頂部控制列 */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-700 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Auto-Invest Pro
              {isLoading && <span className="text-sm bg-blue-600/20 text-blue-400 px-2 py-1 rounded animate-pulse">抓取數據中...</span>}
            </h1>
            <p className="text-sm text-gray-400 mt-1">AI 智能投資儀表板 - 目前標的：{currentTicker}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2 w-full md:w-auto">
              <input 
                type="text" 
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(tickerInput)}
                placeholder="輸入代碼 (例: NVDA, 2330.TW)" 
                className="bg-gray-800 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500 w-full md:w-64 uppercase" 
              />
              <button 
                onClick={() => handleSearch(tickerInput)}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium transition-colors whitespace-nowrap"
              >
                載入圖表
              </button>
            </div>
            {errorMsg && <span className="text-red-400 text-sm">{errorMsg}</span>}
          </div>
        </header>

        {/* 圖表渲染區 */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-4 left-4 z-10 flex gap-3 text-xs font-mono">
            <span className="bg-gray-900/80 px-2 py-1 rounded text-green-400 shadow">SMA 20</span>
            <span className="bg-gray-900/80 px-2 py-1 rounded text-blue-400 shadow">BB (20, 2)</span>
          </div>
          <div ref={chartContainerRef} className="w-full h-[500px]" />
        </div>

        {/* AI 資訊區 (預留) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
             <h3 className="text-lg font-semibold mb-2">技術面診斷</h3><p className="text-gray-400 text-sm">請點擊上方按鈕載入目標，準備進行 AI 運算...</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
             <h3 className="text-lg font-semibold mb-2">近期高低點</h3>
             {stockData.length > 0 ? (
               <div className="text-sm text-gray-300 space-y-1">
                 <p>最新收盤: <span className="text-white font-mono">{stockData[stockData.length - 1].close}</span></p>
                 <p>數據筆數: <span className="text-white font-mono">{stockData.length}</span> 個交易日</p>
               </div>
             ) : (
               <p className="text-gray-400 text-sm">等待數據載入...</p>
             )}
          </div>
          <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800">
             <h3 className="text-lg font-semibold mb-2 text-blue-400">💡 具體行動建議</h3><p className="text-blue-200/70 text-sm">即將導入 LLM 模型進行策略生成...</p>
          </div>
        </div>
      </div>
    </main>
  );
}