import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useStore } from '../../state/store';
import { Icon } from '../ui/Icon';

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme, mode, setMode, storageOk } = useStore();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app">
      <header className="topbar no-print">
        <button
          className="btn btn-icon btn-ghost nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <Icon name="menu" />
        </button>
        <NavLink to="/" className="brand" onClick={() => setNavOpen(false)}>
          <span className="brand-mark">C</span>
          <span>Career Studio</span>
        </NavLink>

        <nav className={`nav ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)}>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/profile">Career Profile</NavLink>
          <NavLink to="/portfolio">Portfolio</NavLink>
          <NavLink to="/assets">Assets</NavLink>
          <NavLink to="/pdf">PDF Studio</NavLink>
        </nav>

        <span className="spacer" />

        {!storageOk && (
          <span className="badge badge-partial" title="Projects will not persist after you close the tab.">
            Storage off
          </span>
        )}

        <div className="seg" role="group" aria-label="Editor mode">
          <button className={mode === 'simple' ? 'active' : ''} onClick={() => setMode('simple')}>Simple</button>
          <button className={mode === 'advanced' ? 'active' : ''} onClick={() => setMode('advanced')}>Advanced</button>
        </div>

        <button className="btn btn-icon btn-ghost" onClick={toggleTheme} aria-label="Toggle colour theme" title="Toggle theme">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </header>

      <main>{children}</main>
    </div>
  );
}
