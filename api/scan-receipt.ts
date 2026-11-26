import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

// Vercel Serverless Function for Receipt Scanning
export default async function handler(req: any, res: any) {
  // Allow POST requests only
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Missing GEMINI_API_KEY in server environment. Please set this in your Vercel Project Settings.',
      });
    }

    const { imageBase64, mimeType, knownSupermarkets } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Please upload a receipt image.' });
    }

    const validMime =
      typeof mimeType === 'string' && mimeType.startsWith('image/')
        ? mimeType
        : 'image/jpeg';

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const storeListText =
      Array.isArray(knownSupermarkets) && knownSupermarkets.length > 0
        ? knownSupermarkets.join(', ')
        : "Aldi, Lidl, Tesco, Sainsbury's, Asda, Indian / Asian Mart";

    const todayIso = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are a specialist UK student receipt parser.
The user is an Indian student living in the UK tracking their weekly and monthly expenses.
Your task is to analyze the uploaded receipt image (supermarket receipt, restaurant bill, transport ticket, coffee shop receipt, university book shop, etc.) and extract structured expense details.

Rules:
1. Category must be strictly one of: 'groceries', 'travel', 'university', 'others'.
   - Supermarket items, food shops, Asian mart: 'groceries'
   - Tube, train, bus, Uber, coach tickets: 'travel'
   - Books, course materials, visa fees: 'university'
   - Eating out, coffee, clothes, toiletries, subscriptions: 'others'
2. Store name: Identify the brand or merchant cleanly (e.g., "Tesco Express", "Lidl", "TfL Oyster", "Pret A Manger"). If it matches or is close to one of the user's known stores (${storeListText}), prefer the exact brand name.
3. Total amount: Find the final paid total in GBP (£). If only pence is visible, convert to decimal pounds (e.g. 345p -> 3.45). Do not guess or invent amounts; look for "TOTAL", "AMOUNT DUE", "CARD PAYMENT", etc.
4. Date: Extract the transaction date in YYYY-MM-DD format. If no date is found on the receipt, return "${todayIso}".
5. Payment method: Infer from receipt text: "Monzo Debit", "Revolut Card", "Niyo Forex (INR→GBP)", "Oyster / Contactless", or "Cash GBP". Default to "Monzo Debit" if unknown.
6. Sub-category for 'others': 'rent' | 'utilities_sim' | 'dining_coffee' | 'laundry_care' | 'subscriptions_forex'. For coffee/dining out, use 'dining_coffee'.
7. University sub-category for 'university': 'tuition_fees' | 'books_printing' | 'visa_ihs' | 'software_tech' | 'societies_events' | 'exams_grad'.
8. Items: Extract top line items if visible (name + price). Provide a concise human-readable itemsSummary (e.g. "Bread, Milk, Bananas & 3 more items").
9. Location: City or neighborhood if printed on receipt (e.g. "Coventry", "London Kings Cross", "Manchester"), or empty string if not visible.`;

    const modelsToTry = [
      'gemini-4-hydrogen',
      'gemini-4-carbon',
      'gemini-4-argon',
      'gemini-3.8-flash',
    ];

    let response: any = null;
    let lastError: any = null;

    const requestContents = [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              data: imageBase64,
              mimeType: validMime,
            },
          },
        ],
      },
    ];

    const requestConfig = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          storeName: { type: Type.STRING },
          location: { type: Type.STRING },
          title: { type: Type.STRING },
          date: { type: Type.STRING },
          totalGBP: { type: Type.NUMBER },
          category: {
            type: Type.STRING,
            enum: ['groceries', 'travel', 'university', 'others'],
          },
          subCategory: {
            type: Type.STRING,
            enum: [
              'rent',
              'utilities_sim',
              'dining_coffee',
              'laundry_care',
              'subscriptions_forex',
            ],
          },
          universityScope: {
            type: Type.STRING,
            enum: ['monthly', 'separate'],
          },
          universitySubCategory: {
            type: Type.STRING,
            enum: [
              'tuition_fees',
              'books_printing',
              'visa_ihs',
              'software_tech',
              'societies_events',
              'exams_grad',
            ],
          },
          paymentMethod: {
            type: Type.STRING,
            enum: [
              'Monzo Debit',
              'Revolut Card',
              'Niyo Forex (INR→GBP)',
              'Oyster / Contactless',
              'Cash GBP',
            ],
          },
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
        required: ['storeName', 'totalGBP', 'category', 'date'],
      },
    };

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: requestContents,
          config: requestConfig,
        });
        if (response && response.text) {
          break;
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`Model ${model} failed, trying next:`, modelErr?.message || modelErr);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Could not analyze this receipt photo.');
    }

    const parsedJson = JSON.parse(response.text?.trim() || '{}');
    if (Array.isArray(parsedJson.items)) {
      parsedJson.items = parsedJson.items.map((it: any) => ({
        name: it.name || 'Item',
        priceGBP: Number(it.priceGBP ?? it.price ?? 0),
      }));
    }
    return res.status(200).json({ receipt: parsedJson });
  } catch (err: any) {
    console.error('Scan receipt error:', err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('MISSING_API_KEY') || !process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on server.',
      });
    }
    if (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')) {
      return res.status(403).json({
        error: 'Invalid or unauthorized Gemini API key. Please check your Vercel Environment Variables.',
      });
    }
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({
        error: 'Gemini API rate limit reached. Please wait a moment and try again.',
      });
    }
    return res.status(500).json({
      error: 'Could not read this receipt clearly. Please try a clearer photo or enter manually.',
    });
  }
}
