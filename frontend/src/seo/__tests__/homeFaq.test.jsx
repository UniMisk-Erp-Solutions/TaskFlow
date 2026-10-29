import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Home from '../../landing/pages/Home';
import { HOME_FAQS } from '../homeFaqs.js';

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

  it('has unique questions and no empty answers', () => {
    expect(new Set(HOME_FAQS.map((f) => f.q)).size).toBe(HOME_FAQS.length);
    HOME_FAQS.forEach((f) => expect(f.a.length).toBeGreaterThan(30));
  });
});
