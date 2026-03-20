"use server";

export async function fetchStockData(ticker: string) {
  try {
    // 透過 Yahoo Finance 公開 API 抓取過去一年的日 K 線資料
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1y`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) throw new Error('Failed to fetch data');

    const data = await res.json();
    
    if (!data.chart.result || data.chart.result.length === 0) {
      throw new Error('No data found');
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    const chartData = [];

    // 將 Yahoo 的原始數據清洗並轉換為 lightweight-charts 要求的嚴格格式
    for (let i = 0; i < timestamps.length; i++) {
      // 過濾掉可能因休市造成的 null 壞資料
      if (quotes.close[i] !== null && quotes.open[i] !== null) {
        const date = new Date(timestamps[i] * 1000);
        const timeString = date.toISOString().split('T')[0]; // 轉換為 YYYY-MM-DD

        chartData.push({
          time: timeString,
          open: Number(quotes.open[i].toFixed(2)),
          high: Number(quotes.high[i].toFixed(2)),
          low: Number(quotes.low[i].toFixed(2)),
          close: Number(quotes.close[i].toFixed(2)),
        });
      }
    }

    return { success: true, data: chartData };
  } catch (error) {
    console.error("Fetch error:", error);
    return { 
      success: false, 
      error: "無法取得資料，請確認代碼是否正確 (台股請加 .TW，例如: 2330.TW)" 
    };
  }
}