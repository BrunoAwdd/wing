import { useEffect, useState } from "react";
import { MenuIcon } from "./icons";

const NAV_LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
  { href: "#seguranca", label: "Para escritórios" },
  { href: "#faq", label: "Perguntas frequentes" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${scrolled ? " site-header--scrolled" : ""}`} id="topo">
      <div className="container nav">
        <a className="nav-logo" href="#topo">
          Robbie
        </a>
        <ul className="nav-links">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
        </ul>
        <a className="btn btn-primary nav-cta-desktop" href="#cadastro">
          Testar gratuitamente
        </a>
        <button
          type="button"
          className="nav-menu-toggle"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <MenuIcon />
        </button>
      </div>
      {menuOpen && (
        <div className="container nav-mobile-panel nav-mobile-panel--open">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
          <a className="btn btn-primary btn-block" href="#cadastro" onClick={() => setMenuOpen(false)}>
            Testar gratuitamente
          </a>
        </div>
      )}
    </header>
  );
}
