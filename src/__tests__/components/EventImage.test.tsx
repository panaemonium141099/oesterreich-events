import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EventImage } from '@/components/Events/EventImage';

// Helper: find the <img> element (or null for placeholder)
function getImg(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector('img');
}

describe('EventImage', () => {
  it('starts with primary URL when src is provided', () => {
    const { container } = render(
      <EventImage src="https://example.com/photo.jpg" category="Musik" title="Test" />,
    );
    const img = getImg(container);
    expect(img).not.toBeNull();
    expect(img!.src).toBe('https://example.com/photo.jpg');
  });

  it('starts with category fallback when src is null', () => {
    const { container } = render(
      <EventImage src={null} category="Sport" title="Test" />,
    );
    const img = getImg(container);
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toMatch(/\/images\/categories\/sport-\d\.jpg$/);
  });

  it('starts with category fallback when src is empty string', () => {
    const { container } = render(
      <EventImage src="" category="Kultur" title="Test" />,
    );
    const img = getImg(container);
    expect(img!.getAttribute('src')).toMatch(/\/images\/categories\/kultur-\d\.jpg$/);
  });

  it('falls back to category image on first error', () => {
    const { container } = render(
      <EventImage src="https://broken.com/img.jpg" category="Musik" title="Seed" />,
    );
    const img = getImg(container);
    expect(img!.src).toBe('https://broken.com/img.jpg');

    // Simulate load error
    act(() => {
      fireEvent.error(img!);
    });

    expect(img!.getAttribute('src')).toMatch(/\/images\/categories\/musik-\d\.jpg$/);
  });

  it('falls back to generic fallback on second error', () => {
    const { container } = render(
      <EventImage src="https://broken.com/img.jpg" category="Musik" title="Seed" />,
    );
    const img = getImg(container);

    // First error -> category fallback
    act(() => { fireEvent.error(img!); });
    expect(img!.getAttribute('src')).toMatch(/\/musik-/);

    // Second error -> generic fallback
    act(() => { fireEvent.error(img!); });
    expect(img!.getAttribute('src')).toBe('/images/categories/default-1.jpg');
  });

  it('shows placeholder after all fallbacks fail (no broken browser icon)', () => {
    const { container } = render(
      <EventImage src="https://broken.com/img.jpg" category="Musik" title="Seed" />,
    );
    const img = getImg(container);

    // Three errors: primary -> category -> generic -> placeholder
    act(() => { fireEvent.error(img!); }); // -> category
    act(() => { fireEvent.error(img!); }); // -> generic
    act(() => { fireEvent.error(img!); }); // -> placeholder

    // No <img> should remain — placeholder is a div with role="img"
    const imgAfter = getImg(container);
    expect(imgAfter).toBeNull();

    const placeholder = container.querySelector('[role="img"]');
    expect(placeholder).not.toBeNull();
  });

  it('does not loop endlessly on errors', () => {
    const { container } = render(
      <EventImage src="https://broken.com/img.jpg" category="Musik" title="Seed" />,
    );
    const img = getImg(container);

    // Fire many errors — should not crash or loop
    for (let i = 0; i < 10; i++) {
      const currentImg = getImg(container);
      if (!currentImg) break; // placeholder reached
      act(() => { fireEvent.error(currentImg); });
    }

    // Should have reached placeholder state
    const finalImg = getImg(container);
    expect(finalImg).toBeNull();
    const placeholder = container.querySelector('[role="img"]');
    expect(placeholder).not.toBeNull();
  });

  it('resets state when src prop changes', () => {
    const { container, rerender } = render(
      <EventImage src="https://first.com/img.jpg" category="Musik" title="A" />,
    );
    const img1 = getImg(container);
    expect(img1!.src).toBe('https://first.com/img.jpg');

    // Trigger error to move to fallback
    act(() => { fireEvent.error(img1!); });
    expect(img1!.getAttribute('src')).toMatch(/\/musik-/);

    // Change src prop — should reset to new primary
    rerender(
      <EventImage src="https://second.com/img.jpg" category="Musik" title="A" />,
    );
    const img2 = getImg(container);
    expect(img2).not.toBeNull();
    expect(img2!.src).toBe('https://second.com/img.jpg');
  });

  it('resets state when category prop changes', () => {
    const { container, rerender } = render(
      <EventImage src={null} category="Musik" title="Test" />,
    );
    const img1 = getImg(container);
    expect(img1!.getAttribute('src')).toMatch(/\/musik-/);

    rerender(
      <EventImage src={null} category="Sport" title="Test" />,
    );
    const img2 = getImg(container);
    expect(img2!.getAttribute('src')).toMatch(/\/sport-/);
  });

  it('resets from placeholder state when props change', () => {
    const { container, rerender } = render(
      <EventImage src="https://broken.com/img.jpg" category="Musik" title="Seed" />,
    );

    // Drive to placeholder
    const img = getImg(container);
    act(() => { fireEvent.error(img!); }); // -> category
    act(() => { fireEvent.error(getImg(container)!); }); // -> generic
    act(() => { fireEvent.error(getImg(container)!); }); // -> placeholder
    expect(getImg(container)).toBeNull();

    // Change props — should reset back to working state
    rerender(
      <EventImage src="https://working.com/photo.jpg" category="Sport" title="New" />,
    );
    const newImg = getImg(container);
    expect(newImg).not.toBeNull();
    expect(newImg!.src).toBe('https://working.com/photo.jpg');
  });

  it('sets referrerPolicy to no-referrer', () => {
    const { container } = render(
      <EventImage src="https://example.com/img.jpg" />,
    );
    const img = getImg(container);
    expect(img!.referrerPolicy).toBe('no-referrer');
  });

  it('applies custom className and wrapperClassName', () => {
    const { container } = render(
      <EventImage
        src="https://example.com/img.jpg"
        className="custom-img-class"
        wrapperClassName="custom-wrapper-class"
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.classList.contains('custom-wrapper-class')).toBe(true);
    const img = getImg(container);
    expect(img!.classList.contains('custom-img-class')).toBe(true);
  });
});
