import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EventImage, normalizeCategoryToSlug } from '@/components/Events/EventImage';

// next/image needs heavy plumbing in jsdom (loader resolution, srcset
// generation). Stub it to a plain <img> so we can assert on the props
// that flow through. We test EventImage's RESOLUTION logic, not next/image
// itself — those are covered by the framework's own tests.
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // Forward most props to a plain <img> so DOM assertions work.
    const {
      src,
      alt,
      sizes,
      placeholder,
      blurDataURL,
      fill,
      width,
      height,
      priority,
      loading,
      fetchPriority,
      ...rest
    } = props;
    return (
      <img
        src={String(src)}
        alt={String(alt ?? '')}
        sizes={typeof sizes === 'string' ? sizes : undefined}
        data-placeholder={placeholder ? String(placeholder) : undefined}
        data-blurdataurl={blurDataURL ? 'present' : undefined}
        data-fill={fill ? 'true' : undefined}
        data-priority={priority ? 'true' : undefined}
        width={typeof width === 'number' ? width : undefined}
        height={typeof height === 'number' ? height : undefined}
        loading={typeof loading === 'string' ? (loading as 'lazy' | 'eager') : undefined}
        fetchPriority={typeof fetchPriority === 'string' ? (fetchPriority as 'high' | 'auto' | 'low') : undefined}
        {...rest}
      />
    );
  },
}));

function getImg(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector('img');
}

// ─── normalizeCategoryToSlug ────────────────────────────────────────

describe('normalizeCategoryToSlug', () => {
  it('returns sonstiges for null/undefined/empty', () => {
    expect(normalizeCategoryToSlug(null)).toBe('sonstiges');
    expect(normalizeCategoryToSlug(undefined)).toBe('sonstiges');
    expect(normalizeCategoryToSlug('')).toBe('sonstiges');
  });

  it('transliterates German umlauts and sharp s', () => {
    expect(normalizeCategoryToSlug('Märkte & Feste')).toBe('maerkte-feste');
    expect(normalizeCategoryToSlug('Kultur & Bühne')).toBe('kultur-buehne');
    expect(normalizeCategoryToSlug('Wein & Kulinarik')).toBe('wein-kulinarik');
    expect(normalizeCategoryToSlug('Spaß & Spiel')).toBe('spass-spiel');
  });

  it('collapses ampersands and whitespace to single dashes', () => {
    expect(normalizeCategoryToSlug('Sport & Bewegung')).toBe('sport-bewegung');
    expect(normalizeCategoryToSlug('Familie & Kinder')).toBe('familie-kinder');
    // Multiple spaces collapse cleanly.
    expect(normalizeCategoryToSlug('Foo   Bar')).toBe('foo-bar');
  });

  it('trims leading/trailing dashes', () => {
    expect(normalizeCategoryToSlug('-Hello-')).toBe('hello');
    expect(normalizeCategoryToSlug(' & Test')).toBe('test');
  });

  it('strips characters outside [a-z0-9-]', () => {
    expect(normalizeCategoryToSlug('Hello?!@#World')).toBe('helloworld');
  });
});

// ─── EventImage rendering — RSC-pure, no onError fallback chain ─────

describe('EventImage (Server Component)', () => {
  it('renders primary URL when src is a usable http URL', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/photo.jpg"
        category="Musik"
        title="Test"
        sizes="240px"
        alt="Test"
      />,
    );
    const img = getImg(container);
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://example.com/photo.jpg');
  });

  it('falls back to category image when src is null (server-side resolution)', () => {
    const { container } = render(
      <EventImage src={null} category="Sport" title="Test" sizes="200px" />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('src')).toMatch(/^\/images\/categories\/sport-\d{1,2}\.jpg$/);
  });

  it('falls back to category image when src is empty string', () => {
    const { container } = render(
      <EventImage src="" category="Kultur" title="Test" sizes="200px" />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('src')).toMatch(/^\/images\/categories\/kultur-\d{1,2}\.jpg$/);
  });

  it('uses fallbackCategory when category is missing', () => {
    const { container } = render(
      <EventImage src={null} fallbackCategory="Musik" title="Test" sizes="200px" />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('src')).toMatch(/^\/images\/categories\/musik-\d{1,2}\.jpg$/);
  });

  it('falls back to default-N for unknown category', () => {
    const { container } = render(
      <EventImage src={null} category="UnknownCat" title="Test" sizes="200px" />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('src')).toMatch(/^\/images\/categories\/default-\d{1,2}\.jpg$/);
  });

  it('renders the blur placeholder data URL for remote images', () => {
    const { container } = render(
      <EventImage src="https://example.com/photo.jpg" sizes="240px" />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('data-placeholder')).toBe('blur');
    expect(img!.getAttribute('data-blurdataurl')).toBe('present');
  });

  it('skips the blur placeholder for local /images/ paths', () => {
    const { container } = render(
      <EventImage src={null} category="Musik" title="A" sizes="240px" />,
    );
    const img = getImg(container);
    // Local fallback path — blur is wasted bytes here.
    expect(img!.getAttribute('data-placeholder')).toBe('empty');
  });

  it('applies preload=true via priority prop on next/image (LCP candidate)', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/photo.jpg"
        sizes="240px"
        preload
      />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('data-priority')).toBe('true');
  });

  it('passes fetchPriority through to next/image', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/photo.jpg"
        sizes="240px"
        fetchPriority="high"
      />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('fetchpriority')).toBe('high');
  });

  it('defaults to fill=true (renders wrapper div)', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/photo.jpg"
        sizes="240px"
        wrapperClassName="w-full h-full"
      />,
    );
    // Wrapper exists when fill mode is active.
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.classList.contains('relative')).toBe(true);
    expect(wrapper.classList.contains('overflow-hidden')).toBe(true);
    const img = getImg(container);
    expect(img!.getAttribute('data-fill')).toBe('true');
  });

  it('supports fixed width/height via discriminated-union prop', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/photo.jpg"
        sizes="240px"
        fill={false}
        width={240}
        height={160}
      />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('width')).toBe('240');
    expect(img!.getAttribute('height')).toBe('160');
    expect(img!.getAttribute('data-fill')).toBeNull();
  });

  it('forwards sizes attribute', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/photo.jpg"
        sizes="(max-width: 640px) 50vw, 25vw"
      />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('sizes')).toBe('(max-width: 640px) 50vw, 25vw');
  });

  it('renders the optional gradient overlay when requested', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/photo.jpg"
        sizes="240px"
        showGradientOverlay
      />,
    );
    // The overlay div has these gradient classes.
    const overlay = container.querySelector('.bg-gradient-to-t');
    expect(overlay).not.toBeNull();
  });

  it('emits skeleton shimmer when showSkeleton=true', () => {
    const { container } = render(
      <EventImage src="https://example.com/photo.jpg" sizes="240px" showSkeleton />,
    );
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton).not.toBeNull();
  });
});
