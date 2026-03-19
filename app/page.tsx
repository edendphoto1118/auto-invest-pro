'use client';

import { useState } from 'react';
import { LineChart, Search, Target, TrendingUp, AlertCircle, BookOpen, DollarSign, Newspaper, UserCheck } from 'lucide-react';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [goal, setGoal] = useState('steady');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleAnalyze = () => {
    if (!ticker) return;
    setIsAnalyzing(true);
    // 模擬 API 呼叫與 AI 分析延遲
    setTimeout(() => {
      setIsAnalyzing(false);
      setShowResults(true);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 標題區 */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-indigo-900">AI 智能投資儀表板</h1>
          <p className="text-gray-500">取代繁瑣的技術分析，一鍵獲取全方位決策建議</p>
        </div>

        {/* 控制面板 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Search size={16} /> 輸入股票代碼 (例: AAPL, 2330.TW)
            </label>
            <input 
              type="text" 
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
              placeholder="輸入代碼..."
            />
          </div>

          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
              <Target size={16} /> 設定財務目標
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="goal" checked={goal === 'steady'} onChange={() => setGoal('steady')} className="text-indigo-600" />
                <span>穩定配息抗通膨</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="goal" checked={goal === 'aggressive'} onChange={() => setGoal('aggressive')} className="text-indigo-600" />
                <span>3年內資產翻倍 (高風險)</span>
              </label>
            </div>
          </div>

          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition disabled:bg-indigo-300"
          >
            {isAnalyzing ? 'AI 分析中...' : '一鍵生成分析報告'}
          </button>
        </div>

        {/* 分析結果區塊 */}
        {showResults && (
          <div className="space-y-6 animate-fade-in">
            
            {/* 圖表與技術自動標記區 (模擬) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><LineChart className="text-indigo-600"/> 智能 K 線與技術標記</h2>
                <div className="flex gap-2 text-sm text-gray-500">
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">已標記: 布林通道</span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded">已標記: 短期下跌壓力線</span>
                </div>
              </div>
              <div className="w-full h-80 bg-gray-900 rounded-lg flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-700">
                <p>此處將整合 Lightweight Charts 套件，直接繪製 {ticker} 的圖表與指標</p>
              </div>
            </div>

            {/* 四大面向分析 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoCard title="基本面" icon={<BookOpen size={20} className="text-blue-500"/>} status="良好" content="本益比處於歷史低位，營收連續三季成長 15%。" />
              <InfoCard title="籌碼面" icon={<UserCheck size={20} className="text-purple-500"/>} status="中性" content="外資連三日小幅賣超，但投信進場護盤，散戶持股比例下降。" />
              <InfoCard title="技術面" icon={<TrendingUp size={20} className="text-green-500"/>} status="偏多" content="股價突破布林通道中軌，MACD 剛出現黃金交叉。" />
              <InfoCard title="消息面" icon={<Newspaper size={20} className="text-orange-500"/>} status="利多" content="最新法說會上調全年財測，AI 相關產品線佔比提升。" />
            </div>

            {/* 目標建議與替代方案 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2 bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
                  <Target size={20} /> 針對您「{goal === 'steady' ? '穩定配息' : '3年翻倍'}」目標的 AI 建議
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  基於目前的技術與基本面，此標的{goal === 'steady' ? '波動較大，可能不完全符合極度穩定的配息需求，建議搭配金融股降低 Beta 值。' : '具備爆發潛力，若跌破季線 (約 $120) 需嚴格停損。預估若達成目標，需經歷至少兩次 20% 以上的回檔，請做好心理準備。'}
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertCircle size={20} className="text-amber-500"/> 推薦更優選項
                </h3>
                <p className="text-sm text-gray-600 mb-3">若您追求該產業板塊的成長，以下標的目前技術型態更佳：</p>
                <ul className="space-y-2">
                  <li className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                    <span className="font-bold">NVDA</span>
                    <span className="text-sm text-green-600">+ 動能強勁</span>
                  </li>
                  <li className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                    <span className="font-bold">AMD</span>
                    <span className="text-sm text-blue-600">+ 估值較低</span>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// 輔助 UI 元件
function InfoCard({ title, icon, status, content }: { title: string, icon: any, status: string, content: string }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold flex items-center gap-2 text-gray-800">{icon} {title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
          status === '良好' || status === '偏多' || status === '利多' ? 'bg-green-100 text-green-700' : 
          status === '中性' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
        }`}>{status}</span>
      </div>
      <p className="text-sm text-gray-600">{content}</p>
    </div>
  );
}
