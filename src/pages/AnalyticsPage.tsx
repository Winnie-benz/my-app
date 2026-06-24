import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BrainCircuit, RefreshCw, AlertCircle } from 'lucide-react'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function AnalyticsPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [lastRun, setLastRun] = useState<Date | null>(null)

  async function runAnalysis() {
    setStatus('loading')
    setResult('')
    setErrorMsg('')

    try {
      const res = await fetch('/api/analytics/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) setResult(prev => prev + parsed.text)
          } catch (e: any) {
            if (e.message && !e.message.startsWith('JSON')) throw e
          }
        }
      }

      setStatus('done')
      setLastRun(new Date())
    } catch (e: any) {
      setErrorMsg(e.message ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ')
      setStatus('error')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <BrainCircuit size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">AI Business Analyst</h1>
            {lastRun && (
              <p className="text-xs text-slate-400">
                วิเคราะห์ล่าสุด {lastRun.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={runAnalysis}
          disabled={status === 'loading'}
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium
            hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
          {status === 'loading' ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ธุรกิจ'}
        </button>
      </div>

      {/* Idle state */}
      {status === 'idle' && (
        <div className="border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <BrainCircuit size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">กดปุ่ม "วิเคราะห์ธุรกิจ" เพื่อให้ AI วิเคราะห์ข้อมูลร้านทั้งหมด</p>
          <p className="text-xs text-slate-400 mt-1">ครอบคลุม: ยอดขาย, สต็อก, ลูกค้า, margin, และโอกาสที่พลาด</p>
        </div>
      )}

      {/* Loading streaming */}
      {status === 'loading' && result === '' && (
        <div className="border border-slate-200 rounded-2xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
            <RefreshCw size={16} className="animate-spin" />
            กำลังดึงข้อมูลและวิเคราะห์...
          </div>
        </div>
      )}

      {/* Streaming / done result */}
      {result && (
        <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">ผลการวิเคราะห์</span>
            {status === 'loading' && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                กำลังสรุป...
              </span>
            )}
          </div>
          <div className="px-6 py-5 prose prose-sm max-w-none
            prose-headings:font-semibold prose-headings:text-slate-900
            prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2 prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-1
            prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1
            prose-p:text-slate-700 prose-p:leading-relaxed
            prose-li:text-slate-700 prose-li:leading-relaxed
            prose-strong:text-slate-900
            prose-table:text-xs prose-th:bg-slate-50 prose-th:font-semibold prose-td:border-slate-200 prose-th:border-slate-200
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="border border-red-200 rounded-2xl p-5 bg-red-50 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">เกิดข้อผิดพลาด</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  )
}
