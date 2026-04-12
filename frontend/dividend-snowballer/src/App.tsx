import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import PortfoliosPage from './pages/PortfoliosPage'
import PortfolioDetailPage from './pages/PortfolioDetailPage'
import SimulatePage from './pages/SimulatePage'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PortfoliosPage />} />
          <Route path="/portfolio/:id" element={<PortfolioDetailPage />} />
          <Route path="/portfolio/:id/simulate" element={<SimulatePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
