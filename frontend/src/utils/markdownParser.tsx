import React from "react";
import ReactDOMServer from "react-dom/server";
import ReactMarkdown from "react-markdown";

/**
 * Robust Markdown to HTML converter using ReactMarkdown.
 * Renders markdown to static HTML string for Word insertion.
 */
export const parseMarkdown = (markdown: string): string => {
  if (!markdown) return "";
  return ReactDOMServer.renderToStaticMarkup(<ReactMarkdown>{markdown}</ReactMarkdown>);
};
