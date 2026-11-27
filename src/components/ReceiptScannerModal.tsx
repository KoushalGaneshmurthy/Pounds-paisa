import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Camera, Check, Trash2, Loader2, AlertCircle } from 'lucide-react';
import {
  ExpenseCategory,
  ExpenseItem,
  OtherSubCategory,
  PaymentMethod,
  UniversityScope,
  UniversitySubCategory,
  WeekNumber,
} from '../types/expense';
import {
  OTHER_SUBCATEGORIES,
  PAYMENT_METHODS,
  UNIVERSITY_SUBCATEGORIES,
} from '../data/initialData';
import { formatGBP, formatINR } from '../utils/formatters';
import { fetchDailyGbpToInrRate } from '../utils/fxRate';

interface ExtractedLineItem {
  name: string;
  priceGBP: number;
}

interface ScannedReceiptResponse {
  storeName?: string;
  location?: string;
  title?: string;
  date?: string;
  totalGBP?: number;
  category?: string;
  subCategory?: string;
  paymentMethod?: string;
  itemsSummary?: string;
  items?: ExtractedLineItem[];
}

interface ReceiptScannerModalProps {
  isOpen: boolean;
  supermarkets: string[];
  currentRate: number;
  onAddSupermarket: (name: string) => void;
  onSaveExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onClose: () => void;
}

function inferWeekFromDate(dateIso: string): WeekNumber {
  const parts = dateIso.split('-');
  const day = parseInt(parts[2] || '1', 10);
  if (Number.isNaN(day) || day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

async function compressImageToBase64(
  file: File
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => {
        // Fallback: send raw dataUrl if browser cannot decode format (e.g., some HEIC files)
        const base64 = dataUrl.split(',')[1] || '';
        resolve({
          base64,
          mimeType: file.type || 'image/jpeg',
          previewUrl: dataUrl,
        });
      };
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ base64, mimeType: file.type || 'image/jpeg', previewUrl: dataUrl });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = outUrl.split(',')[1] || '';
        resolve({ base64, mimeType: 'image/jpeg', previewUrl: outUrl });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  supermarkets,
  currentRate,
  onAddSupermarket,
  onSaveExpense,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [hasScannedResult, setHasScannedResult] = useState(false);

  // Extracted & editable fields
  const [title, setTitle] = useState('');
  const [merchant, setMerchant] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('groceries');
  const [subCategory, setSubCategory] = useState<OtherSubCategory>('dining_coffee');
  const [universityScope, setUniversityScope] = useState<UniversityScope>('monthly');
  const [universitySubCategory, setUniversitySubCategory] =
    useState<UniversitySubCategory>('books_printing');
  const [amountGBP, setAmountGBP] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Monzo Debit');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [week, setWeek] = useState<WeekNumber>(() =>
    inferWeekFromDate(new Date().toISOString().slice(0, 10))
  );
  const [items, setItems] = useState<ExtractedLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [dayRate, setDayRate] = useState(currentRate);

  useEffect(() => {
    if (!isOpen) return;
    setPreviewUrl('');
    setScanning(false);
    setScanError('');
    setHasScannedResult(false);
    setItems([]);
    setDayRate(currentRate);
  }, [isOpen, currentRate]);

  useEffect(() => {
    if (!isOpen || !hasScannedResult || !date) return;
    let cancelled = false;
    fetchDailyGbpToInrRate(date).then((res) => {
      if (!cancelled && res) {
        setDayRate(res.rate);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasScannedResult, date]);

  if (!isOpen) return null;

  const processReceiptFile = async (file: File) => {
    setScanError('');
    setScanning(true);
    setHasScannedResult(false);

    try {
      const { base64, mimeType, previewUrl: url } = await compressImageToBase64(file);
      setPreviewUrl(url);

      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          knownSupermarkets: supermarkets,
        }),
      });

      const payload = (await response.json()) as {
        receipt?: ScannedReceiptResponse;
        error?: string;
      };

      if (!response.ok || !payload.receipt) {
        throw new Error(payload.error || 'Failed to scan receipt.');
      }

      const r = payload.receipt;
      const validCat: ExpenseCategory =
        r.category === 'travel' || r.category === 'others' || r.category === 'university'
          ? r.category
          : 'groceries';

      const validSub: OtherSubCategory = OTHER_SUBCATEGORIES.some((s) => s.id === r.subCategory)
        ? (r.subCategory as OtherSubCategory)
        : 'dining_coffee';

      const validUniSub: UniversitySubCategory = UNIVERSITY_SUBCATEGORIES.some(
        (u) => u.id === r.subCategory
      )
        ? (r.subCategory as UniversitySubCategory)
        : 'books_printing';

      const validPay: PaymentMethod = PAYMENT_METHODS.includes(r.paymentMethod as PaymentMethod)
        ? (r.paymentMethod as PaymentMethod)
        : 'Monzo Debit';

      const extractedDate =
        r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
          ? r.date
          : new Date().toISOString().slice(0, 10);

      const extractedItems = Array.isArray(r.items)
        ? r.items.filter((i) => i && typeof i.name === 'string')
        : [];

      setCategory(validCat);
      setSubCategory(validSub);
      setUniversitySubCategory(validUniSub);
      setUniversityScope(validUniSub === 'tuition_fees' || validUniSub === 'visa_ihs' ? 'separate' : 'monthly');
      setMerchant(r.storeName?.trim() || '');
      setLocation(r.location?.trim() || '');
      setTitle(r.title?.trim() || `${r.storeName || 'Receipt'} Purchase`);
      setAmountGBP(
        typeof r.totalGBP === 'number' && r.totalGBP > 0 ? r.totalGBP.toFixed(2) : ''
      );
      setPaymentMethod(validPay);
      setDate(extractedDate);
      setWeek(inferWeekFromDate(extractedDate));
      setItems(extractedItems);
      setNotes(
        r.itemsSummary?.trim() ||
          extractedItems
            .slice(0, 6)
            .map((i) => i.name)
            .join(', ')
      );
      setHasScannedResult(true);
    } catch (err: unknown) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Could not scan this receipt photo. Please try again.'
      );
    } finally {
      setScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processReceiptFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processReceiptFile(file);
    }
  };

  const handleRemoveLineItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
    setNotes(
      updated
        .slice(0, 6)
        .map((i) => i.name)
        .join(', ')
    );
  };

  const parsedAmount = parseFloat(amountGBP) || 0;

  const isNewSupermarket =
    category === 'groceries' &&
    merchant.trim().length > 0 &&
    !supermarkets.some((s) => s.toLowerCase() === merchant.trim().toLowerCase());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !merchant.trim() || parsedAmount <= 0) {
      setScanError('Please ensure store, title, and a valid pound amount are filled.');
      return;
    }

    if (isNewSupermarket) {
      onAddSupermarket(merchant.trim());
    }

    onSaveExpense({
      title: merchant.trim() || 'Receipt Purchase',
      merchant: merchant.trim(),
      location: '',
      category,
      subCategory: undefined,
      amountGBP: Math.round(parsedAmount * 100) / 100,
      paymentMethod: 'Monzo Debit',
      week: inferWeekFromDate(date),
      date,
      notes: notes.trim() || undefined,
      rateAtEntry: dayRate > 0 ? dayRate : undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-scanner-title"
    >
      <div className="w-full max-w-3xl rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 id="receipt-scanner-title" className="font-display text-lg font-bold text-slate-900">
              Receipt Photo Scanner
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload any grocery, store, or travel receipt photo to auto-extract items, total, date & store
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt scanner"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Step 1: Upload / Scanning Area */}
        {!hasScannedResult && (
          <div className="mt-5 space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center"
            >
              {scanning ? (
                <div className="space-y-3 flex flex-col items-center">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Uploading receipt preview"
                      className="h-32 w-24 rounded-lg object-cover border border-slate-200"
                    />
                  )}
                  <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Reading your receipt...
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Extracting store name, date, itemized products, and pound total
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-700">
                    <Camera className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    Drop a UK receipt photo here, or upload from device
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-md">
                    Works with long supermarket, store, or travel ticket photos
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Choose Receipt Photo
                  </button>
                </>
              )}
            </div>

            {scanError && (
              <div
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{scanError}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Extracted Receipt & Save */}
        {hasScannedResult && (
          <form onSubmit={handleSave} className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Left: Receipt Image Preview & Line Items */}
            <div className="md:col-span-5 space-y-4">
              {previewUrl && (
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <img
                    src={previewUrl}
                    alt="Scanned receipt"
                    className="max-h-64 w-full object-contain bg-slate-900/5"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-t border-slate-200 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Scan Different Photo
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Extracted Items ({items.length})
                  </span>
                  <span className="font-mono-num text-xs font-semibold text-slate-700">
                    {formatGBP(items.reduce((s, i) => s + (i.priceGBP || 0), 0))}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No individual line items extracted—you can still edit the summary and save.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-200/70 pr-1">
                    {items.map((item, idx) => (
                      <div
                        key={`${item.name}-${idx}`}
                        className="flex items-center justify-between gap-2 py-1.5 text-xs"
                      >
                        <span className="text-slate-700 truncate">{item.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-num text-slate-900 font-medium">
                            {formatGBP(item.priceGBP || 0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            aria-label={`Remove ${item.name}`}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Editable Expense Form */}
            <div className="md:col-span-7 space-y-3.5">
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
                {(
                  [
                    { id: 'groceries', label: 'Groceries' },
                    { id: 'travel', label: 'Travel' },
                    { id: 'university', label: 'University' },
                    { id: 'others', label: 'Others' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      category === cat.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {category === 'university' || category === 'others'
                    ? 'Expense Name'
                    : category === 'groceries'
                      ? 'Store / Supermarket'
                      : 'Where / Place'}
                </label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder={
                    category === 'university'
                      ? 'e.g. Tuition fee, Library printing'
                      : category === 'groceries'
                        ? 'e.g. Supermarket name'
                        : 'e.g. TfL, Pret'
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                  required
                />
                {isNewSupermarket && (
                  <p className="mt-1 text-[11px] font-medium text-teal-800">
                    New store — will be added to My Supermarkets
                  </p>
                )}
              </div>

              {category !== 'university' && category !== 'travel' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Items Bought
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Bread, milk, snacks"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Total (£ GBP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountGBP}
                    onChange={(e) => setAmountGBP(e.target.value)}
                    className="font-mono-num h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
                    required
                  />
                  {parsedAmount > 0 && dayRate > 0 && (
                    <p className="font-mono-num mt-1 text-[11px] text-slate-500">
                      {formatINR(parsedAmount, dayRate)} (@ ₹{dayRate.toFixed(2)})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              {scanError && (
                <p className="text-xs font-medium text-rose-700" role="alert">
                  {scanError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save Receipt Expense
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
