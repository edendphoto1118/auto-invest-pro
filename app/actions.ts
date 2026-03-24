"use server";

export async function fetchStockData(ticker: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker.toUpperCase()}?interval=1d&range=1y`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch data');
    const data = await res.json();
    if (!data.chart.result || data.chart.result.length === 0) throw new Error('No data found');

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const chartData = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null && quotes.open[i] !== null) {
        const date = new Date(timestamps[i] * 1000);
        chartData.push({
          time: date.toISOString().split('T')[0],
          open: Number(quotes.open[i].toFixed(2)),
          high: Number(quotes.high[i].toFixed(2)),
          low: Number(quotes.low[i].toFixed(2)),
          close: Number(quotes.close[i].toFixed(2)),
        });
      }
    }

    // 【新增】高效榨取隱藏的即時報價與漲跌幅數據
    const meta = result.meta;
    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose;
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    return { 
      success: true, 
      data: chartData,
      quote: {
        price: currentPrice.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2)
      }
    };
  } catch (error) {
    return { success: false, error: "無法取得資料，請確認代碼是否正確" };
  }
}

// ==========================================
// 注入 AI 分析大腦 (Gemini API Native Fetch)
// ==========================================
export async function generateAIReport(ticker: string, technicalData: any, lang: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "Vercel 後台找不到金鑰" };
  }

  const prompt = `
你是一位頂級量化交易員。分析標的：${ticker}。
回覆語言必須是：${lang === 'EN' ? 'English' : '繁體中文'}。

【最新技術面數據】
- 最新收盤價：${technicalData.lastClose}
- 20日均線(SMA)：${technicalData.sma}
- 布林通道上軌：${technicalData.upper}
- 布林通道下軌：${technicalData.lower}
- 近五日收盤價趨勢：${technicalData.recentTrend}

【核心任務】
請根據上述數據，結合你對該標的（如科技權值股或大盤ETF）的總體經濟、基本面與籌碼面認知，給出交易計畫。
請務必輸出符合以下 JSON 格式的內容，不要包含 Markdown 語法：

{
  "trendStatus": "${lang === 'EN' ? 'Bullish / Bearish / Ranging / Overextended' : '多頭強勢 / 空頭弱勢 / 盤整震盪 / 乖離過大 (4選1)'}",
  "winRateEstimate": "${lang === 'EN' ? 'High / Medium / Low' : '高 (適合建倉) / 中 (適合試單) / 低 (嚴格觀望)'}",
  "fundamentalSentiment": "用一句話總結該標的近期的『基本面/籌碼面/消息面』綜合判定。",
  "diagnosis": "用一句話精準點出目前的『技術面』位階與隱患。",
  "actionPlan": {
    "entry": "具體的建議進場價位區間或條件",
    "stopLoss": "具體的停損防守價位",
    "target": "短中期的停利目標價位"
  }
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 } 
      })
    });

    const result = await response.json();
    if (result.error) return { success: false, error: `Google API Error: ${result.error.message}` };

    const aiText = result.candidates[0].content.parts[0].text;
    const cleanJsonString = aiText.replace(/```json\n?|\n?```/g, '').trim();
    const parsedData = JSON.parse(cleanJsonString);

    return { success: true, data: parsedData };
  } catch (error: any) {
    return { success: false, error: `系統解析異常: ${error.message}` };
  }
}