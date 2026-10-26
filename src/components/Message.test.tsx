import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Message from './Message.tsx';

describe('Message component', () => {
    it('renders nothing when status is null', () => {
        const { container } = render(<Message status={null} setStatus={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders warning message when status is inputNotValid', () => {
        render(<Message status="inputNotValid" setStatus={vi.fn()} />);
        expect(screen.getByText(/Input contains no valid SQL or Hibernate query!/i)).toBeInTheDocument();
    });

    it('renders warning message when status is emptyInput', () => {
        render(<Message status="emptyInput" setStatus={vi.fn()} />);
        expect(screen.getByText(/Log input cannot be empty/i)).toBeInTheDocument();
    });

    it('calls setStatus(null) when dismiss button is clicked', () => {
        const setStatus = vi.fn();
        render(<Message status="emptyInput" setStatus={setStatus} />);

        const dismissBtn = screen.getByRole('button', { name: /Dismiss message/i });
        fireEvent.click(dismissBtn);

        expect(setStatus).toHaveBeenCalledWith(null);
    });
});
