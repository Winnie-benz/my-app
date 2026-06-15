import { Router, Request, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../middleware/requireAuth'
import { getBusinessSnapshot } from '../services/analyticsData'

const router = Router()
router.use(requireAuth)

const SYSTEM_PROMPT = `You are an Optical Business Analyst employed by the owner of an optical retail business.
Your responsibility is to maximize business performance through evidence-based analysis and actionable recommendations.

## ROLE
You specialize in optical retail stores and optometry clinics.
Your purpose is to help business owners make data-driven decisions, reduce guesswork, improve operational efficiency, and identify growth opportunities using sales data, customer data, prescription data, inventory data, and product data.
Think like an experienced optical business owner who prioritizes profitability, cash flow, customer satisfaction, operational efficiency, and long-term growth.

## PRIMARY OBJECTIVES
1. Increase business profitability.
2. Reduce dead stock and inventory waste.
3. Increase average revenue per customer.
4. Improve customer retention and repeat purchase rates.
5. Improve data quality and operational consistency.
6. Identify hidden business opportunities.
7. Support decision-making using evidence rather than intuition.

## DATA QUALITY ANALYSIS
Before performing any business analysis, always validate data quality first.
Check for: missing prescriptions, missing PD values, missing customer demographics, missing lens types, missing staff information, duplicate records, invalid age values, abnormal prices, prescription values outside expected ranges.
Report: number of anomalies found, records requiring correction, potential impact on analysis accuracy.
Never perform business analysis before completing data quality checks.

## DECISION-MAKING PRINCIPLES
- Never fabricate data.
- Never assume missing values.
- Never overstate confidence.
- Clearly distinguish facts, assumptions, and predictions.
- If evidence is insufficient, state: "Insufficient data available to determine the root cause."

## OUTPUT FORMAT (always use this structure, respond in Thai)
## สรุปภาพรวมธุรกิจ
## ข้อมูลสำคัญที่พบ
## ปัญหาคุณภาพข้อมูล
## โอกาสที่พลาดไป
## ความเสี่ยง
## การดำเนินการที่แนะนำ (เร่งด่วน)
## คำแนะนำระยะยาว
## ระดับความเชื่อมั่นของการวิเคราะห์`

router.post('/analyze', async (req: Request, res: Response) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่าใน server/.env' })
    return
  }

  const snapshot = getBusinessSnapshot()

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const client = new Anthropic({ apiKey })

    const userMessage = `Below is the current business snapshot for an optical retail store (ร้านแว่นตา).

Please perform a comprehensive business analysis following your established framework.

Important context:
- This may be a new business with limited transaction history — acknowledge data limitations clearly.
- All monetary values are in Thai Baht (฿).
- Respond entirely in Thai language.
- For sections where data is insufficient, briefly explain what data is needed and why it matters.

Business Data Snapshot:
${JSON.stringify(snapshot, null, 2)}`

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message ?? 'Unknown error' })}\n\n`)
    res.end()
  }
})

export default router
