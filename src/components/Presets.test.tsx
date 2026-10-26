import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Presets from './Presets.tsx';
import { presets } from '../utils/presets.ts';

describe('Presets component', () => {
    it('renders all preset buttons', () => {
        render(<Presets setInputText={vi.fn()} />);

        expect(screen.getByRole('button', { name: /Load E-Commerce Incident/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Load Hibernate N\+1 Scenario/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Load Clean Batch Query/i })).toBeInTheDocument();
    });

    it('loads e-commerce incident preset when clicked', () => {
        const setInputText = vi.fn();
        render(<Presets setInputText={setInputText} />);

        fireEvent.click(screen.getByRole('button', { name: /Load E-Commerce Incident/i }));
        expect(setInputText).toHaveBeenCalledWith(presets.ecommerceIncident);
    });

    it('loads hibernate N+1 preset when clicked', () => {
        const setInputText = vi.fn();
        render(<Presets setInputText={setInputText} />);

        fireEvent.click(screen.getByRole('button', { name: /Load Hibernate N\+1 Scenario/i }));
        expect(setInputText).toHaveBeenCalledWith(presets.hibernateNPlusOne);
    });

    it('loads clean batch preset when clicked', () => {
        const setInputText = vi.fn();
        render(<Presets setInputText={setInputText} />);

        fireEvent.click(screen.getByRole('button', { name: /Load Clean Batch Query/i }));
        expect(setInputText).toHaveBeenCalledWith(presets.cleanBatch);
    });
});
