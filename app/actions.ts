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
    return { success: false, error: "系統未設定 API Key" };
  }

  const prompt = `
你是一位頂級量化交易員。用戶的目標是「3年內資產翻倍」，這意味著你必須排除庸俗的建議，只給出高勝率、重風險控管的具體操作。
目前標的：${ticker}
最新技術面數據：
- 最新收盤價：${technicalData.lastClose}
- 20日均線(SMA)：${technicalData.sma}
- 布林通道上軌：${technicalData.upper}
- 布林通道下軌：${technicalData.lower}

請根據布林通道與均線的相對位置，給出極度簡潔的判斷。
強制以 JSON 格式輸出，絕對不要包含 Markdown 語法或任何其他文字，格式如下：
{
  "diagnosis": "用一句話精準點出目前的技術面位階（例如：價格跌破下軌，超賣訊號浮現 / 價格緊貼上軌，追高動能耗竭）。",
  "action": "針對『3年翻倍』目標，給出具體資金配置建議（例如：切勿追高，等待回測 20ma 再佈局 20% 資金 / 左側建倉時機，可投入 10% 試單）。"
}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const result = await response.json();
    const aiText = result.candidates[0].content.parts[0].text;
    
    const cleanJsonString = aiText.replace(/```json\n?|\n?```/g, '').trim();
    const parsedData = JSON.parse(cleanJsonString);

    return { success: true, data: parsedData };
  } catch (error) {
    console.error("AI Error:", error);
    return { success: false, error: "AI 運算超載，請稍後再試。" };
  }
}