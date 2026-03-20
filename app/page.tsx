"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, CrosshairMode, ColorType } from "lightweight-charts";

// ==========================================
// 1. 核心演算法：自動計算布林通道 (Bollinger Bands)
// ==========================================
function calculateBollingerBands(data: any[], period = 20, multiplier = 2) {
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
// 2. 模擬數據生成
// ==========================================
function generateMockData() {
  let initialDate = new Date(2023, 0, 1).getTime();
  let basePrice = 150;
  const data = [];
  for (let i = 0; i < 200; i++) {
    const time = (initialDate + i * 24 * 60 * 60 * 1000) / 1000;
    const open = basePrice + (Math.random() - 0.5) * 5;
    const close = open + (Math.random() - 0.5) * 5;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    data.push({ time: time as any, open, high, low, close });
    basePrice = close;
  }
  return data;
}

// ==========================================
// 3. 儀表板主結構與圖表渲染
// ==========================================
export default function AutoInvestDashboard() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#D1D5DB' },
      grid: { vertLines: { color: '#374151' }, horzLines: { color: '#374151' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true },
    });

    const mockKLineData = generateMockData();
    const { upperBand, lowerBand, movingAverage } = calculateBollingerBands(mockKLineData);

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981', downColor: '#EF4444', borderVisible: false,
      wickUpColor: '#10B981', wickDownColor: '#EF4444',
    });
    candlestickSeries.setData(mockKLineData);

    const upperSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1 });
    upperSeries.setData(upperBand);

    const lowerSeries = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.5)', lineWidth: 1 });
    lowerSeries.setData(lowerBand);

    const smaSeries = chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.8)', lineWidth: 2 });
    smaSeries.setData(movingAverage);

    const handleResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [isClient]);

  if (!isClient) return <div className="min-h-screen bg-gray-900" />;

  return (
    <main className="min-h-screen bg-gray-900 p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center border-b border-gray-700 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Auto-Invest Pro</h1>
            <p className="text-sm text-gray-400 mt-1">AI 智能投資儀表板</p>
          </div>
          <div className="flex gap-4">
            <input type="text" placeholder="輸入股票代碼 (例: AAPL)" className="bg-gray-800 border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500" />
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium">AI 分析</button>
          </div>
        </header>

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-4 left-4 z-10 flex gap-3 text-xs font-mono">
            <span className="bg-gray-900/80 px-2 py-1 rounded text-green-400">SMA 20</span>
            <span className="bg-gray-900/80 px-2 py-1 rounded text-blue-400">BB (20, 2)</span>
          </div>
          <div ref={chartContainerRef} className="w-full h-[500px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
             <h3 className="text-lg font-semibold mb-2">技術面診斷</h3><p className="text-gray-400 text-sm">等待 AI 數據注入...</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
             <h3 className="text-lg font-semibold mb-2">籌碼與基本面</h3><p className="text-gray-400 text-sm">等待 API 數據對接...</p>
          </div>
          <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800">
             <h3 className="text-lg font-semibold mb-2 text-blue-400">💡 具體行動建議</h3><p className="text-blue-200/70 text-sm">輸入代碼以獲取目標達成路徑...</p>
          </div>
        </div>
      </div>
    </main>
  );
}