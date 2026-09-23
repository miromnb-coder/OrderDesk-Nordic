import { PilotButton } from "@/components/PilotButton";

export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="OrderDesk home">
        OrderDesk
      </a>

      <nav className="desktop-nav" aria-label="Primary navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#visma-net">Visma Net</a>
        <a href="#security">Security</a>
        <a href="#pricing">Pricing</a>
      </nav>

      <div className="header-actions">
        <span className="login-placeholder" aria-disabled="true" title="Product login is not part of this marketing site">
          Log in
        </span>
        <PilotButton className="button button-dark button-compact">Book a demo</PilotButton>
      </div>

      <details className="mobile-menu">
        <summary aria-label="Open navigation">Menu</summary>
        <div className="mobile-menu-panel">
          <a href="#how-it-works">How it works</a>
          <a href="#visma-net">Visma Net</a>
          <a href="#security">Security</a>
          <a href="#pricing">Pricing</a>
          <span className="login-placeholder" aria-disabled="true">Log in</span>
          <PilotButton className="button button-dark button-compact">Book a demo</PilotButton>
        </div>
      </details>
    </header>
  );
}
