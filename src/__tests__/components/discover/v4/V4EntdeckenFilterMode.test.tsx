import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { V4EntdeckenFilterMode } from '@/components/Discover/v4/V4EntdeckenFilterMode';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, priority, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('V4EntdeckenFilterMode', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('fetches events on mount with active chip filters', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], total: 0 }),
    });
    render(<V4EntdeckenFilterMode activeChips={new Set(['tickets'])} sort="score" onChipsChange={vi.fn()} onSortChange={vi.fn()}/>);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/events/);
  });

  it('renders chips + sort row', () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], total: 0 }) });
    render(<V4EntdeckenFilterMode activeChips={new Set()} sort="score" onChipsChange={vi.fn()} onSortChange={vi.fn()}/>);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i })).toBeInTheDocument();
    expect(screen.getByText(/sortieren/i)).toBeInTheDocument();
  });

  it('shows empty-state on 0 results', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], total: 0 }) });
    render(<V4EntdeckenFilterMode activeChips={new Set()} sort="score" onChipsChange={vi.fn()} onSortChange={vi.fn()}/>);
    await waitFor(() => {
      expect(screen.getByText(/keine events passen/i)).toBeInTheDocument();
    });
  });
});
