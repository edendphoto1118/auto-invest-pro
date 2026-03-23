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
    return { success: true, data: chartData };
  } catch (error) {
    return { success: false, error: "無法取得資料，請確認代碼是否正確" };
  }
}

// ==========================================
// 注入 AI 分析大腦 (Gemini API Native Fetch)
// ==========================================
export async function generateAIReport(ticker: string, technicalData: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "[V6] Vercel 後台找不到金鑰" };
  }

  const prompt = `
你是一位以「風險控管與盈虧比」為核心的頂級量化交易員。
目標受眾：資金有限，目標為「3年內資產翻倍」的投資人。
目前分析標的：${ticker}

【最新客觀數據】
- 最新收盤價：${technicalData.lastClose}
- 20日均線(SMA)：${technicalData.sma}
- 布林通道上軌：${technicalData.upper}
- 布林通道下軌：${technicalData.lower}
- 近五日收盤價趨勢：${technicalData.recentTrend}

【核心任務】
請根據上述數據，給出冷靜、無情、極具實戰價值的交易計畫。
請務必輸出符合以下 JSON 格式的內容：

{
  "trendStatus": "多頭強勢 / 空頭弱勢 / 盤整震盪 / 乖離過大風險區 (4選1)",
  "winRateEstimate": "高 (適合建倉) / 中 (適合試單) / 低 (嚴格觀望)",
  "diagnosis": "用一句話精準點出目前的技術面位階與隱患。",
  "actionPlan": {
    "entry": "具體的建議進場價位區間或條件",
    "stopLoss": "具體的停損防守價位",
    "target": "短中期的停利目標價位"
  }
}
`;

  try {
    // 【真相解藥】使用清單中確實存在的次世代模型 gemini-2.5-flash
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
    
    if (result.error) {
      return { 
        success: false, 
        error: `[V6] Google 攔截: ${result.error.message}` 
      };
    }

    const aiText = result.candidates[0].content.parts[0].text;
    const cleanJsonString = aiText.replace(/```json\n?|\n?```/g, '').trim();
    const parsedData = JSON.parse(cleanJsonString);

    return { success: true, data: parsedData };
  } catch (error: any) {
    return { success: false, error: `[V6] 系統解析異常: ${error.message}` };
  }
}