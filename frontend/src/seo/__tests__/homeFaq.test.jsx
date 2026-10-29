import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Home from '../../landing/pages/Home';
import { HOME_FAQS } from '../homeFaqs.js';
import { ALL_FAQS, FAQ_GROUPS } from '../faqContent.js';
import Faq from '../../landing/pages/Faq';

describe('home page FAQ', () => {
  it('renders every question as a heading with its answer in the page, after the features and before the final call to action', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>);
    const section = container.querySelector('section[aria-labelledby="home-faq-heading"]');
    expect(section).not.toBeNull();
    expect(section.querySelector('h2#home-faq-heading, #home-faq-heading').textContent).toBe('Frequently asked questions');

    const items = section.querySelectorAll('details');
    expect(items.length).toBe(HOME_FAQS.length);
    HOME_FAQS.forEach((f, i) => {
      expect(items[i].querySelector('summary h3').textContent).toBe(f.q);
      expect(items[i].textContent).toContain(f.a); // present in the DOM even while collapsed
    });

    const html = container.innerHTML;
    expect(html.indexOf('Everything teams need')).toBeLessThan(html.indexOf('home-faq-heading'));
    expect(html.indexOf('home-faq-heading')).toBeLessThan(html.indexOf('Bring calm to your team'));
  });

  it('shows only five questions on the home page, with a Show more button that leads to the FAQ page', () => {
    expect(HOME_FAQS).toHaveLength(5);
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>);
    const link = [...container.querySelectorAll('a')].find((a) => /show more questions/i.test(a.textContent));
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/faq');
  });

  it('has unique questions and no empty answers', () => {
    expect(new Set(HOME_FAQS.map((f) => f.q)).size).toBe(HOME_FAQS.length);
    HOME_FAQS.forEach((f) => expect(f.a.length).toBeGreaterThan(30));
  });
});

describe('FAQ page', () => {
  it('lists 20 to 30 questions, every one with its answer in the page', () => {
    expect(ALL_FAQS.length).toBeGreaterThanOrEqual(20);
    expect(ALL_FAQS.length).toBeLessThanOrEqual(30);
    expect(new Set(ALL_FAQS.map((f) => f.q)).size).toBe(ALL_FAQS.length);
    const { container } = render(<MemoryRouter><Faq /></MemoryRouter>);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('section[aria-labelledby^="faq-group-"]')).toHaveLength(FAQ_GROUPS.length);
    const items = container.querySelectorAll('details');
    expect(items).toHaveLength(ALL_FAQS.length);
    ALL_FAQS.forEach((f, i) => {
      expect(items[i].querySelector('summary h3').textContent).toBe(f.q);
      expect(items[i].textContent).toContain(f.a);
    });
  });

  it('has at least 1,500 words of answers on the page', () => {
    const words = ALL_FAQS.reduce((sum, f) => sum + f.a.trim().split(/\s+/).length, 0);
    expect(words).toBeGreaterThanOrEqual(1500);
  });

  it('includes every home page question', () => {
    HOME_FAQS.forEach((f) => expect(ALL_FAQS).toContain(f));
  });
});
