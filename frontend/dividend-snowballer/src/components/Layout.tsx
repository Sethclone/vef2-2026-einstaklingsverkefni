import { Link, useLocation } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const isT212 = location.pathname === '/' || location.pathname.startsWith('/t212')
  const isSandbox = location.pathname.startsWith('/sandbox')

  return (
    <div className="app-shell">
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="brand">
            <span className="brand-icon">❄</span>
            Dividend Snowballer
          </Link>
          <nav className="breadcrumb-nav">
            <Link to="/" className={isT212 ? 'nav-active' : ''}>My Portfolio</Link>
            <Link to="/sandbox" className={isSandbox ? 'nav-active' : ''}>Sandbox</Link>
          </nav>
        </div>
      </header>
      <main className="main-content">{children}</main>
      <footer className="footer">
        <p>Dividend Snowballer</p>
      </footer>
    </div>
  )
}
