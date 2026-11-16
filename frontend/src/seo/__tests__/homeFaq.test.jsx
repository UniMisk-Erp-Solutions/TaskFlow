import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { screen } from '@testing-library/react';

import Home from '../../landing/pages/Home';
import { HOME_FAQS } from '../homeFaqs.js';
import { ALL_FAQS, FAQ_GROUPS, faqPath } from '../faqContent.js';
import Faq from '../../landing/pages/Faq';
import FaqQuestion from '../../landing/pages/FaqQuestion';

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
    expect(html.indexOf('home-faq-heading')).toBeLessThan(html.indexOf('Bring clarity to your team'));
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
  it('lists 20 to 30 questions, each one a link to its own page', () => {
    expect(ALL_FAQS.length).toBeGreaterThanOrEqual(20);
    expect(ALL_FAQS.length).toBeLessThanOrEqual(30);
    expect(new Set(ALL_FAQS.map((f) => f.q)).size).toBe(ALL_FAQS.length);
    const { container } = render(<MemoryRouter><Faq /></MemoryRouter>);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('section[aria-labelledby^="faq-group-"]')).toHaveLength(FAQ_GROUPS.length);
    const links = container.querySelectorAll('a[href^="/faq/"]');
    expect(links).toHaveLength(ALL_FAQS.length);
    ALL_FAQS.forEach((f, i) => {
      expect(links[i].textContent).toContain(f.q);
      expect(links[i].getAttribute('href')).toBe(faqPath(f));
    });
  });

  it('gives every question a unique page address', () => {
    expect(new Set(ALL_FAQS.map((f) => f.slug)).size).toBe(ALL_FAQS.length);
    ALL_FAQS.forEach((f) => expect(f.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it('has at least 1,500 words of answers on the page', () => {
    const words = ALL_FAQS.reduce((sum, f) => sum + f.a.trim().split(/\s+/).length, 0);
    expect(words).toBeGreaterThanOrEqual(1500);
  });

  it('includes every home page question', () => {
    HOME_FAQS.forEach((f) => expect(ALL_FAQS).toContain(f));
  });
});

describe('FAQ question page', () => {
  it('shows one question with its full answer and a back button to the list', () => {
    const item = ALL_FAQS[1];
    const { container } = render(<MemoryRouter><FaqQuestion slug={item.slug} /></MemoryRouter>);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('h1').textContent).toBe(item.q);
    expect(container.textContent).toContain(item.a);
    const back = screen.getByRole('link', { name: /back to all questions/i });
    expect(back.getAttribute('href')).toBe('/faq');
    // the other questions from the same topic are offered as links, not repeated in full
    const group = FAQ_GROUPS.find((g) => g.title === item.group);
    expect(container.querySelectorAll('aside a')).toHaveLength(group.items.length - 1);
  });
});
