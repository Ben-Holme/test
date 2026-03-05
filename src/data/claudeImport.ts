import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import type { Transaction, TransactionType } from '../types'

export interface ParsedTransaction {
  id: string
  datum: string
  beskrivning: string
  typ: TransactionType
  belopp: number // ex. VAT amount that booking rules will expand
  rader: { konto: number; debet: number; kredit: number }[]
  selected: boolean
}

const SYSTEM_PROMPT = `Du är en expert på svensk bokföring (BAS-kontoplanen) för Vantör Digital AB.
Du analyserar skärmbilder av kontoutdrag och extraherar transaktioner.

Tillgängliga transaktionstyper:
- faktura_ut: utgående faktura (försäljning, kund betalar)
- kvitto_se: inköpskvitto Sverige med 25% moms
- kvitto_eu_saas: EU/SaaS-tjänst (t.ex. Slack, GitHub, AWS, Spotify, Adobe)
- kvitto_eu_vara: EU-vara med omvänd skattskyldighet
- lön: löneutbetalning
- manuell: övrigt som inte passar ovan

Konton (BAS):
1510 – Kundfordringar, 1920 – Bankkonto, 2610 – Utgående moms 25%, 2640 – Ingående moms,
3001 – Försäljning tjänster SE 25%, 3004 – Försäljning EU, 3006 – Export,
4545 – Förvärvsmoms utl. tjänster, 5400 – Förbrukningsinventarier, 6570 – Licenser & SaaS

Bokföringsregler (rader = verifikationsrader):
- faktura_ut: Dr 1510 (belopp+25%moms) / Kr 3001 (belopp) + Kr 2610 (25%moms)
- kvitto_se: Dr 5400 (belopp) + Dr 2640 (25%moms) / Kr 1920 (belopp+moms)
- kvitto_eu_saas: Dr 6570 (belopp) + Dr 2640 (25%moms) / Kr 1920 (belopp) + Kr 4545 (25%moms)
- lön: Dr 7010 (belopp) / Kr 1920 (belopp)
- manuell: fyll rader manuellt

Returnera ENDAST giltig JSON utan markdown:
{
  "transaktioner": [
    {
      "datum": "YYYY-MM-DD",
      "beskrivning": "Motpart / ändamål",
      "typ": "kvitto_eu_saas",
      "belopp": 99.00,
      "rader": [
        { "konto": 6570, "debet": 99.00, "kredit": 0 },
        { "konto": 2640, "debet": 24.75, "kredit": 0 },
        { "konto": 1920, "debet": 0, "kredit": 99.00 },
        { "konto": 4545, "debet": 0, "kredit": 24.75 }
      ]
    }
  ]
}

Om du är osäker på typ, välj "manuell" och fyll rader med konto 1920 och motkonto 5400.
Ignorera interna överföringar och ränteposter om de inte är relevanta.`

export async function analyzeStatement(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
  apiKey: string
): Promise<ParsedTransaction[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          {
            type: 'text',
            text: 'Analysera detta kontoutdrag och extrahera alla transaktioner som JSON.',
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Inget textsvar från Claude')
  }

  // Strip potential markdown fences
  const raw = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(raw) as {
    transaktioner: {
      datum: string
      beskrivning: string
      typ: TransactionType
      belopp: number
      rader: { konto: number; debet: number; kredit: number }[]
    }[]
  }

  return parsed.transaktioner.map((t) => ({
    id: uuidv4(),
    datum: t.datum,
    beskrivning: t.beskrivning,
    typ: t.typ,
    belopp: t.belopp,
    rader: t.rader,
    selected: true,
  }))
}

export function toTransaction(p: ParsedTransaction): Transaction {
  return {
    id: p.id,
    datum: p.datum,
    beskrivning: p.beskrivning,
    typ: p.typ,
    status: 'utkast',
    rader: p.rader,
    bilagor: [],
  }
}
