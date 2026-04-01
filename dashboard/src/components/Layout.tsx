import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="md:ml-52 ml-0 pt-14 md:pt-0 p-8">
        <Outlet />
      </main>
    </div>
  )
}
