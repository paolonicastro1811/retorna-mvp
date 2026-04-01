// ============================================================
// Layout Generator — AI generates restaurant table map from description
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

// Lazy init — dotenv override must run before this is called
let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const SYSTEM_PROMPT = `Sei un designer di interni per ristoranti. L'utente descriverà il suo ristorante e tu devi generare un layout di tavoli in formato JSON.

REGOLE:
- Ogni tavolo ha: tableNumber, seats, label (opzionale, es. "Janela", "Terraço"), posX (0-100), posY (0-100), width, height
- posX e posY sono percentuali della mappa (0=sinistra/alto, 100=destra/basso)
- width e height sono percentuali (tavolo da 2: ~8x8, da 4: ~10x10, da 6: ~12x10, da 8: ~14x10)
- Distribuisci i tavoli in modo realistico rispettando la descrizione
- Lascia corridoi tra i tavoli (almeno 3-5 unità di distanza)
- Tavoli vicino alla finestra vanno ai bordi (posX~5 o posX~85)
- Tavoli al centro vanno a posX~30-70
- Tavoli in fondo vanno a posY alto (70-90)
- Tavoli all'ingresso vanno a posY basso (5-25)
- La forma della sala influenza la distribuzione

RISPONDI SOLO con JSON valido, niente altro testo. Formato:
{
  "roomShape": "rectangular|square|L-shaped|narrow|wide",
  "roomDescription": "breve descrizione in PT-BR",
  "tables": [
    { "tableNumber": 1, "seats": 2, "label": "Janela", "posX": 5, "posY": 10, "width": 8, "height": 8 }
  ]
}`;

export interface GeneratedTable {
  tableNumber: number;
  seats: number;
  label?: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
}

export interface GeneratedLayout {
  roomShape: string;
  roomDescription: string;
  tables: GeneratedTable[];
}

export async function generateLayout(
  description: string
): Promise<GeneratedLayout> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: description }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON");
  }

  const layout: GeneratedLayout = JSON.parse(jsonMatch[0]);

  // Validate
  if (!layout.tables || !Array.isArray(layout.tables) || layout.tables.length === 0) {
    throw new Error("AI returned empty table layout");
  }

  // Clamp values to valid ranges
  for (const t of layout.tables) {
    t.posX = Math.max(0, Math.min(100, t.posX));
    t.posY = Math.max(0, Math.min(100, t.posY));
    t.width = Math.max(5, Math.min(20, t.width));
    t.height = Math.max(5, Math.min(20, t.height));
    t.seats = Math.max(1, Math.min(20, t.seats));
  }

  return layout;
}
