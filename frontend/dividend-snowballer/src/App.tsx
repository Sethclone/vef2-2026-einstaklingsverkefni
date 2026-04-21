import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import T212PortfolioPage from './pages/T212PortfolioPage'
import T212SimulatePage from './pages/T212SimulatePage'
import PortfoliosPage from './pages/PortfoliosPage'
import PortfolioDetailPage from './pages/PortfolioDetailPage'
import SimulatePage from './pages/SimulatePage'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<T212PortfolioPage />} />
          <Route path="/t212/simulate" element={<T212SimulatePage />} />
          <Route path="/sandbox" element={<PortfoliosPage />} />
          <Route path="/sandbox/portfolio/:id" element={<PortfolioDetailPage />} />
          <Route path="/sandbox/portfolio/:id/simulate" element={<SimulatePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
