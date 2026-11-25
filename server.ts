import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/scan-receipt', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType, knownSupermarkets } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        knownSupermarkets?: string[];
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Please upload a receipt image.' });
        return;
      }

      const validMime =
        typeof mimeType === 'string' && mimeType.startsWith('image/')
          ? mimeType
          : 'image/jpeg';

      const ai = getGeminiClient();

      const storeListText =
        Array.isArray(knownSupermarkets) && knownSupermarkets.length > 0
          ? knownSupermarkets.join(', ')
          : "Aldi, Lidl, Tesco, Sainsbury's, Asda, Indian / Asian Mart";

      const todayIso = new Date().toISOString().slice(0, 10);

      const prompt = `You are a UK student receipt scanner. Analyze this photo of a UK shopping, travel, or student expense receipt.
Extract:
1. storeName: The store/merchant name. If it matches a UK supermarket like ${storeListText}, use the clean standard name (e.g., "Tesco", "Aldi", "Lidl", "Sainsbury's", "Asda").
2. location: Branch, street, city, or UK postcode if shown on the receipt (empty string if not visible).
3. title: A short natural title for the expense (e.g., "Tesco Groceries", "Aldi Weekly Food", "Boots Toiletries", "Pret Lunch").
4. date: Receipt purchase date in YYYY-MM-DD format. If year is 2 digits like 22/11/26, convert to 2026-11-22. If unreadable, use ${todayIso}.
5. totalGBP: The final total paid in GBP (£) as a number.
6. category: One of "groceries", "travel", "others", or "university". Supermarkets/food shopping = "groceries"; trains/buses/Oyster/Uber = "travel"; university tuition, textbooks, library printing, society tickets, visa/IHS = "university"; rent, cafes/restaurants, pharmacy, laundry, gym, SIM = "others".
7. subCategory: If category is "others", pick one of "rent", "utilities_sim", "dining_coffee", "laundry_care", "subscriptions_forex". If category is "university", pick one of "tuition_fees", "books_printing", "visa_ihs", "software_tech", "societies_events", "exams_grad". Otherwise empty string.
8. paymentMethod: One of "Monzo Debit", "Revolut Card", "Niyo Forex (INR→GBP)", "Oyster / Contactless", "Cash GBP". Choose "Cash GBP" if receipt says CASH, "Oyster / Contactless" if contactless/Apple Pay/TfL, otherwise "Monzo Debit".
9. items: List of purchased line items with clean human-readable names and GBP price. Ignore subtotal/VAT/Clubcard summary lines.
10. itemsSummary: A concise comma-separated summary of the main items bought (max 120 characters).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: validMime,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              storeName: { type: Type.STRING },
              location: { type: Type.STRING },
              title: { type: Type.STRING },
              date: { type: Type.STRING },
              totalGBP: { type: Type.NUMBER },
              category: { type: Type.STRING },
              subCategory: { type: Type.STRING },
              paymentMethod: { type: Type.STRING },
              itemsSummary: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    priceGBP: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty response for this receipt.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({ receipt: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'MISSING_API_KEY') {
        res.status(500).json({
          error:
            'Gemini API key is not configured. Please check your key in the Settings > Secrets panel.',
        });
        return;
      }
      if (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
        res.status(403).json({
          error:
            'Invalid or unauthorized Gemini API key. Please check your API key in Settings > Secrets.',
        });
        return;
      }
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({
          error: 'Rate limit reached on Gemini API. Please wait a moment and try again.',
        });
        return;
      }
      console.error('Receipt scan error:', err);
      res.status(500).json({
        error: 'Could not read this receipt clearly. Please try a clearer photo or enter manually.',
      });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pounds & Paisa server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
