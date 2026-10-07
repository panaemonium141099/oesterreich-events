import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EventDetailContent } from '@/components/Events/v4/V4EventDetailContent';

describe('V4EventDetailContent', () => {
  it('renders description heading + body', () => {
    render(<V4EventDetailContent description="Drei Sets, eine Bühne, kein Eintritt."/>);
    expect(screen.getByText(/worum geht.?s/i)).toBeInTheDocument();
    expect(screen.getByText(/drei sets/i)).toBeInTheDocument();
  });

  it('omits description block when description is null', () => {
    render(<V4EventDetailContent description={null}/>);
    expect(screen.queryByText(/worum geht.?s/i)).toBeNull();
  });

  it('renders tag chips when tags present', () => {
    render(<V4EventDetailContent description={null} tags={['rock','open-air']}/>);
    expect(screen.getByText('rock')).toBeInTheDocument();
    expect(screen.getByText('open-air')).toBeInTheDocument();
  });

  it('renders similar-events anchor when section present', () => {
    const { container } = render(<V4EventDetailContent description={null} hasSimilar/>);
    expect(container.querySelector('#similar-events')).toBeTruthy();
  });

  it('nennt die Dubletten-Quellen unter der Quelle, verlinkt mit nofollow', () => {
    render(
      <V4EventDetailContent
        description={null}
        sourceName="falter"
        sourceUrl="https://www.falter.at/event/1081199"
        alsoListedSources={[
          { label: 'partytimer', url: 'https://www.partytimer.at/events/1741099' },
          { label: 'wien-ticket', url: null },
        ]}
      />,
    );
    const line = screen.getByText(/auch gelistet bei/i);
    expect(line).toHaveTextContent('Auch gelistet bei: partytimer, wien-ticket');
    const link = screen.getByRole('link', { name: /partytimer/ });
    expect(link).toHaveAttribute('href', 'https://www.partytimer.at/events/1741099');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(link).toHaveAttribute('target', '_blank');
    // ohne URL: Name als Text, kein Link
    expect(screen.queryByRole('link', { name: /wien-ticket/ })).toBeNull();
    expect(screen.getByRole('link', { name: /falter/ })).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  });

  it('ohne Dubletten keine „Auch gelistet bei"-Zeile', () => {
    render(<V4EventDetailContent description={null} sourceName="falter" alsoListedSources={[]} />);
    expect(screen.getByText(/quelle:/i)).toBeInTheDocument();
    expect(screen.queryByText(/auch gelistet bei/i)).toBeNull();
  });

  it('Primary ohne Quelle: die Dubletten-Quellen stehen trotzdem da', () => {
    render(
      <V4EventDetailContent description={null} alsoListedSources={[{ label: 'partytimer', url: null }]} />,
    );
    expect(screen.queryByText(/quelle:/i)).toBeNull();
    expect(screen.getByText(/auch gelistet bei/i)).toHaveTextContent('partytimer');
  });
});
