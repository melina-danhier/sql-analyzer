import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button.tsx';

describe('Button component', () => {
    it('renders with the given text', () => {
        render(<Button text="Analyze SQL" />);
        expect(screen.getByRole('button', { name: 'Analyze SQL' })).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();
        render(<Button text="Click me" onClick={handleClick} />);

        const button = screen.getByRole('button', { name: 'Click me' });
        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled and prevents click actions when disabled prop is true', () => {
        const handleClick = vi.fn();
        render(<Button text="Disabled Action" onClick={handleClick} disabled />);

        const button = screen.getByRole('button', { name: 'Disabled Action' });
        expect(button).toBeDisabled();

        fireEvent.click(button);
        expect(handleClick).not.toHaveBeenCalled();
    });

    it('applies the appropriate variant styling classes', () => {
        const { rerender } = render(<Button text="Danger Action" variant="danger" />);
        const button = screen.getByRole('button', { name: 'Danger Action' });
        expect(button.className).toContain('bg-button-neg');

        rerender(<Button text="Success Action" variant="success" />);
        expect(button.className).toContain('bg-button-pos');
    });
});
