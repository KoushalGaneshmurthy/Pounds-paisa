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

      <div className="relative z-10 flex flex-col justify-between gap-5 p-5 sm:p-7 sm:gap-6">
        {/* Top Control Bar: Section Index + Tone Badge on Left, Action CTAs on Right */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 sm:pb-3.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300 min-w-0">
            <span className="shrink-0">{sectionIndex}</span>
            <span aria-hidden="true" className="shrink-0">·</span>
            <span className={`${statusColorClass} truncate`}>{statusText}</span>
          </div>

          {actionButton && <div className="shrink-0">{actionButton}</div>}
        </div>

        {/* Main Content Area: Title on Left, Roomy Uncluttered Stat Strip on Right */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-1.5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl [text-wrap:balance]">
              {title}
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-200/90 max-w-lg">
              {subtitle}
            </p>
          </div>

          {/* Metric Figures Strip — Dedicated Space, Zero Horizontal Collisions */}
          <div className="flex flex-wrap items-end gap-6 sm:gap-8 lg:gap-10 shrink-0">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 whitespace-nowrap">{primaryLabel}</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-white sm:text-2xl whitespace-nowrap">
                {formatGBP(primaryAmountGBP)}
              </p>
              {showInr && gbpToInrRate > 0 && (
                <p className="font-mono-num text-xs text-slate-300/85 whitespace-nowrap">
                  {formatINR(primaryAmountGBP, gbpToInrRate)}
                </p>
              )}
            </div>

            {secondaryLabel && typeof secondaryAmountGBP === 'number' && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 whitespace-nowrap">{secondaryLabel}</p>
                <p className="font-mono-num mt-1 text-xl font-bold text-white sm:text-2xl whitespace-nowrap">
                  {formatGBP(secondaryAmountGBP)}
                </p>
                {showInr && gbpToInrRate > 0 && (
                  <p className="font-mono-num text-xs text-slate-300/85 whitespace-nowrap">
                    {formatINR(secondaryAmountGBP, gbpToInrRate)}
                  </p>
                )}
              </div>
            )}

            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 whitespace-nowrap">{limitLabel}</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-emerald-300 sm:text-2xl whitespace-nowrap">
                {formatGBP(limitAmountGBP)}
              </p>
              {showInr && gbpToInrRate > 0 && (
                <p className="font-mono-num text-xs text-slate-300/85 whitespace-nowrap">
                  {formatINR(limitAmountGBP, gbpToInrRate)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
