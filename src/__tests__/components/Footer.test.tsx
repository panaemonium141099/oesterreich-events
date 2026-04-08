import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Legal/Footer';

describe('Footer', () => {
  it('renders the copyright text', () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeDefined();
  });

  it('renders navigation links', () => {
    render(<Footer />);
    expect(screen.getByText('Blog')).toBeDefined();
    expect(screen.getByText('Impressum')).toBeDefined();
    expect(screen.getByText('Datenschutz')).toBeDefined();
    expect(screen.getByText('AGB')).toBeDefined();
    expect(screen.getByText('Datenquellen')).toBeDefined();
    expect(screen.getByText('Kontakt')).toBeDefined();
  });

  it('renders data attribution section with key sources', () => {
    render(<Footer />);
    const attribution = screen.getByTestId('data-attribution');
    expect(attribution).toBeDefined();
    expect(attribution.textContent).toContain('OpenStreetMap');
    expect(attribution.textContent).toContain('ODbL');
    expect(attribution.textContent).toContain('CC BY 4.0');
    expect(attribution.textContent).toContain('Mapbox');
    expect(attribution.textContent).toContain('Alle Quellen');
  });

  it('links to OSM copyright page', () => {
    render(<Footer />);
    const osmLink = screen.getByRole('link', { name: 'OpenStreetMap' });
    expect(osmLink).toBeDefined();
    expect(osmLink.getAttribute('href')).toBe('https://www.openstreetmap.org/copyright');
    expect(osmLink.getAttribute('target')).toBe('_blank');
    expect(osmLink.getAttribute('rel')).toContain('noopener');
  });

  it('links to ODbL license page', () => {
    render(<Footer />);
    const odbLink = screen.getByRole('link', { name: 'ODbL' });
    expect(odbLink).toBeDefined();
    expect(odbLink.getAttribute('href')).toBe('https://opendatacommons.org/licenses/odbl/1-0/');
    expect(odbLink.getAttribute('target')).toBe('_blank');
  });
});
