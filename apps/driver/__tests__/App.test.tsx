/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders the application shell', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain('HaulPilot');
  expect(rendered).toContain('Application shell');
});
