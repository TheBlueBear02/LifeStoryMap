import { Link, useLocation } from 'react-router-dom'

function SidebarMenu() {
  const location = useLocation()

  return (
    <div className="sidebar-menu">
      <nav className="sidebar-nav">
        <Link
          to="/"
          className={`sidebar-nav-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </Link>
      </nav>
    </div>
  )
}

export default SidebarMenu
