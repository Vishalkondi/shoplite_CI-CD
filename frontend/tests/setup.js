// Runs before every test file.
import '@testing-library/jest-dom/vitest'; // adds matchers like toBeInTheDocument()
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup(); // unmount components rendered by the previous test
  localStorage.clear(); // the cart is saved here; start every test empty
});

// jsdom does not implement scrolling; App calls it when switching views.
window.scrollTo = () => {};
