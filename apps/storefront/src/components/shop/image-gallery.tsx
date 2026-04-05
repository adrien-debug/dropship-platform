'use client';

import Image from 'next/image';
import { useState } from 'react';

function EmptyImage({ label }: { label: string }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--dashboard-card)] p-6 text-center"
      role="img"
      aria-label={label}
    >
      <span className="text-sm text-[var(--dashboard-text-ghost)]">No image</span>
    </div>
  );
}

export function ImageGallery({
  alt,
  imageUrls,
}: {
  alt: string;
  imageUrls: string[];
}) {
  const hasUrls = imageUrls.length > 0;
  const urls = hasUrls ? imageUrls : [];
  const [index, setIndex] = useState(0);
  const safeIndex = hasUrls ? Math.min(index, urls.length - 1) : 0;
  const main = hasUrls ? urls[safeIndex] : null;

  if (!hasUrls) {
    return (
      <div
        className="relative aspect-square w-full overflow-hidden rounded-[var(--dashboard-radius-card)] border border-[var(--dashboard-border)]"
        style={{ boxShadow: 'var(--dashboard-shadow-md)' }}
      >
        <EmptyImage label={alt} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-[var(--dashboard-radius-card)] border border-[var(--dashboard-border)] bg-[var(--dashboard-card)]"
        style={{ boxShadow: 'var(--dashboard-shadow-md)' }}
      >
        {main ? (
          <Image
            src={main}
            alt={alt}
            fill
            className="object-contain p-4"
            sizes="(min-width: 1024px) 50vw, 100vw"
            unoptimized
            priority
          />
        ) : (
          <EmptyImage label={alt} />
        )}
      </div>
      {urls.length > 1 ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {urls.map((url, i) => (
            <li key={`${url}-${i}`}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={`relative aspect-square w-full overflow-hidden rounded-[var(--dashboard-radius-input)] border bg-[var(--dashboard-card-2)] transition-[box-shadow,border-color] ${
                  i === safeIndex
                    ? 'border-[var(--dashboard-accent)] ring-2 ring-[var(--dashboard-accent-ring)]'
                    : 'border-[var(--dashboard-border)] hover:border-[var(--dashboard-border-mid)]'
                }`}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="120px"
                  unoptimized
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
