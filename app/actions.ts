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
    
    const chartData: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
    const seenTimes = new Set<string>(); // 【防護 1】建立日期過濾器，解決重複日期導致的黑屏

    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null && quotes.open[i] !== null) {
        const date = new Date(timestamps[i] * 1000);
        const timeStr = date.toISOString().split('T')[0];
        
        // 只允許沒出現過的日期進入陣列
        if (!seenTimes.has(timeStr)) {
          seenTimes.add(timeStr);
          chartData.push({
            time: timeStr,
            open: Number(quotes.open[i].toFixed(2)),
            high: Number(quotes.high[i].toFixed(2)),
            low: Number(quotes.low[i].toFixed(2)),
            close: Number(quotes.close[i].toFixed(2)),
            volume: quotes.volume && quotes.volume[i] ? quotes.volume[i] : 0 
          });
        }
      }
    }

    // 【防護 2】強制依照時間先後排序，徹底根絕圖表亂序當機
    chartData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    if (chartData.length >= 2) {
      const current = chartData[chartData.length - 1];
      const previous = chartData[chartData.length - 2];
      const change = current.close - previous.close;
      const changePercent = (change / previous.close) * 100;

      return { 
        success: true, 
        data: chartData,
        quote: {
          price: current.close.toFixed(2),
          change: change.toFixed(2),
          changePercent: changePercent.toFixed(2)
        }
      };
    }
    throw new Error('Not enough data to calculate trend');
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "無法取得資料" };
  }
}

export async function generateAIReport(ticker: string, technicalData: Record<string, string | number>, lang: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "Vercel 後台找不到金鑰" };

  const prompt = `
你是一位華爾街頂級量化交易員與產業分析師。分析標的：${ticker}。
回覆語言必須是：${lang === 'EN' ? 'English' : '繁體中文'}。

【系統最高級別警告】
請絕對精確識別該代碼（${ticker}）對應的真實企業或 ETF 屬性。若為台股 2330 必須知道是半導體代工，006208 為台股大盤市值型 ETF。絕不允許將科技股誤認為傳產股，或產生任何幻覺。

【最新技術面與量價數據】
- 最新收盤價：${technicalData.lastClose}
- 20日均線(SMA)：${technicalData.sma}
- 布林通道上軌：${technicalData.upper}
- 布林通道下軌：${technicalData.lower}
- 近五日收盤價趨勢：${technicalData.recentTrend}
- 今日成交量狀態：${technicalData.volumeTrend}

【核心任務】
請根據上述真實數據，結合該標的的「真實產業基本面/籌碼面」認知，給出嚴謹的交易計畫。
請務必輸出符合以下 JSON 格式的內容，不要包含 Markdown 語法：

{
  "trendStatus": "${lang === 'EN' ? 'Bullish / Bearish / Ranging / Overextended' : '多頭強勢 / 空頭弱勢 / 盤整震盪 / 乖離過大風險區 (4選1)'}",
  "winRateEstimate": "${lang === 'EN' ? 'High / Medium / Low' : '高 (適合建倉) / 中 (適合試單) / 低 (嚴格觀望)'}",
  "fundamentalSentiment": "用一句話精準總結該標的（請帶入該產業或ETF的真實屬性）近期的『基本面/籌碼面』綜合判定。",
  "diagnosis": "用一句話精準點出目前的『技術面與量價結構』位階與隱患。",
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
    let parsedData = JSON.parse(cleanJsonString);

    // 【防護 3】強制補齊 AI 漏掉的屬性，防止前台 React 讀取不到而白屏
    parsedData = {
      trendStatus: parsedData.trendStatus || "運算中...",
      winRateEstimate: parsedData.winRateEstimate || "-",
      fundamentalSentiment: parsedData.fundamentalSentiment || "缺乏足夠資訊判定。",
      diagnosis: parsedData.diagnosis || "技術面訊號微弱。",
      actionPlan: {
        entry: parsedData.actionPlan?.entry || "觀望",
        stopLoss: parsedData.actionPlan?.stopLoss || "-",
        target: parsedData.actionPlan?.target || "-"
      }
    };

    return { success: true, data: parsedData };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "系統解析異常" };
  }
}