import React from 'react';

export const PageIntro: React.FC<{ eyebrow: string; title: string; description: string }> = ({ eyebrow, title, description }) => (
  <header className="page-intro">
    <p className="theme-eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p>{description}</p>
  </header>
);
