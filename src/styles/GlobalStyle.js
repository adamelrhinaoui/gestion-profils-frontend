// src/styles/GlobalStyle.js
import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background-color: #f9fafb;
    color: #111827;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  button, input {
    font-family: inherit;
  }
`;
