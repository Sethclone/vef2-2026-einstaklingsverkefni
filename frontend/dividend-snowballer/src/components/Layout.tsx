import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="app-shell">
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="brand">
            <span className="brand-icon">❄</span>
            Dividend Snowballer
          </Link>
          {!isHome && (
            <nav className="breadcrumb-nav">
              <Link to="/">Portfolios</Link>
            </nav>
          )}
        </div>
      </header>
      <main className="main-content">{children}</main>
      <footer className="footer">
        <p>Dividend Snowballer</p>
      </footer>
    </div>
  )
}
