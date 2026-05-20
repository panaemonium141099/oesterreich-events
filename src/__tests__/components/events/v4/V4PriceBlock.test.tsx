import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4PriceBlock } from '@/components/Events/v4/V4PriceBlock';

describe('V4PriceBlock', () => {
  it('renders the € symbol for "EUR"-formatted price_text (Eventfrog / wien-ticket / ntry / eventfinder)', () => {
    render(<V4PriceBlock priceText="15.00 EUR"/>);
    expect(screen.getByText('€ 15.00')).toBeInTheDocument();
    expect(screen.getByText('Eintritt')).toBeInTheDocument();
    // No raw "EUR" leaks through
    expect(screen.queryByText(/EUR/)).toBeNull();
  });

  it('renders the € symbol for "Euro" word suffix', () => {
    render(<V4PriceBlock priceText="22.50 Euro"/>);
    expect(screen.getByText('€ 22.50')).toBeInTheDocument();
    expect(screen.queryByText(/Euro/)).toBeNull();
  });

  it('still renders the € symbol when source already used it', () => {
    render(<V4PriceBlock priceText="9.00 €"/>);
    expect(screen.getByText('€ 9.00')).toBeInTheDocument();
  });

  it('parses ranges with EUR suffix into a labelled "€ X – € Y" row', () => {
    render(<V4PriceBlock priceText="10.00 - 25.00 EUR"/>);
    expect(screen.getByText('€ 10.00 – € 25.00')).toBeInTheDocument();
    expect(screen.getByText('Eintritt')).toBeInTheDocument();
  });

  it('parses ranges with € suffix the same way', () => {
    render(<V4PriceBlock priceText="5.00 – 50.00 €"/>);
    expect(screen.getByText('€ 5.00 – € 50.00')).toBeInTheDocument();
  });

  it('treats priceTier=gratis as a no-op (the free badge already conveys it)', () => {
    const { container } = render(<V4PriceBlock priceTier="gratis" priceText="0.00 EUR"/>);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when no price info is available', () => {
    const { container } = render(<V4PriceBlock/>);
    expect(container.firstChild).toBeNull();
  });

  it('falls back to numeric range when priceText is missing', () => {
    render(<V4PriceBlock priceMin={10} priceMax={25}/>);
    expect(screen.getByText('€ 10 – € 25')).toBeInTheDocument();
  });

  it('renders unparseable chunks verbatim ("Auf Anfrage" etc.)', () => {
    render(<V4PriceBlock priceText="Auf Anfrage"/>);
    expect(screen.getByText('Auf Anfrage')).toBeInTheDocument();
  });
});
