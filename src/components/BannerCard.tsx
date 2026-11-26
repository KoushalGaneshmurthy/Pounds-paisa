import React, { useState } from 'react';
import { formatGBP, formatINR } from '../utils/formatters';

interface BannerCardProps {
  imageSrc: string;
  imageAlt: string;
  sectionIndex: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryAmountGBP: number;
  secondaryLabel?: string;
  secondaryAmountGBP?: number;
  limitLabel: string;
  limitAmountGBP: number;
  statusText: string;
  statusTone: 'good' | 'warn' | 'alert';
  showInr: boolean;
  gbpToInrRate: number;
  actionButton?: React.ReactNode;
}

export const BannerCard: React.FC<BannerCardProps> = ({
  imageSrc,
  imageAlt,
  sectionIndex,
  title,
  subtitle,
  primaryLabel,
  primaryAmountGBP,
  secondaryLabel,
  secondaryAmountGBP,
  limitLabel,
  limitAmountGBP,
  statusText,
  statusTone,
  showInr,
  gbpToInrRate,
  actionButton,
}) => {
  const [imgError, setImgError] = useState(false);

  const statusColorClass =
    statusTone === 'good'
      ? 'text-emerald-300'
      : statusTone === 'warn'
        ? 'text-amber-300'
        : 'text-rose-300';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900">
      {!imgError ? (
        <img
          src={imageSrc}
          alt={imageAlt}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950" />
      )}

      {/* Measured contrast scrim for WCAG AA legibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/75 to-slate-950/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/30" />

      <div className="relative z-10 flex flex-col justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-end">
        <div className="max-w-xl space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
            <span>{sectionIndex}</span>
            <span aria-hidden="true">·</span>
            <span className={statusColorClass}>{statusText}</span>
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl [text-wrap:balance]">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-slate-200/90 max-w-lg">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end lg:gap-8">
          <div className={`grid ${secondaryLabel ? 'grid-cols-3' : 'grid-cols-2'} gap-5 sm:gap-7`}>
            <div>
              <p className="text-xs text-slate-300">{primaryLabel}</p>
              <p className="font-mono-num mt-1 text-xl font-semibold text-white sm:text-2xl">
                {formatGBP(primaryAmountGBP)}
              </p>
              {showInr && gbpToInrRate > 0 && (
                <p className="font-mono-num text-xs text-slate-300/85">
                  {formatINR(primaryAmountGBP, gbpToInrRate)}
                </p>
              )}
            </div>

            {secondaryLabel && typeof secondaryAmountGBP === 'number' && (
              <div>
                <p className="text-xs text-slate-300">{secondaryLabel}</p>
                <p className="font-mono-num mt-1 text-xl font-semibold text-white sm:text-2xl">
                  {formatGBP(secondaryAmountGBP)}
                </p>
                {showInr && gbpToInrRate > 0 && (
                  <p className="font-mono-num text-xs text-slate-300/85">
                    {formatINR(secondaryAmountGBP, gbpToInrRate)}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="text-xs text-slate-300">{limitLabel}</p>
              <p className="font-mono-num mt-1 text-xl font-semibold text-emerald-300 sm:text-2xl">
                {formatGBP(limitAmountGBP)}
              </p>
              {showInr && gbpToInrRate > 0 && (
                <p className="font-mono-num text-xs text-slate-300/85">
                  {formatINR(limitAmountGBP, gbpToInrRate)}
                </p>
              )}
            </div>
          </div>

          {actionButton && <div className="shrink-0">{actionButton}</div>}
        </div>
      </div>
    </div>
  );
};
