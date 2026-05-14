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
});
