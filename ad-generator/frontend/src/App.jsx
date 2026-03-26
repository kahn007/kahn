import React from 'react'
import { Zap, Search, Wand2, LayoutGrid, Upload, BarChart3, Settings, Globe } from 'lucide-react'
import { useAdStore } from './store/adStore'
import ResearchPanel from './components/ResearchPanel'
import CopyGenerator from './components/CopyGenerator'
import VariationManager from './components/VariationManager'
import FacebookUploader from './components/FacebookUploader'
import TrackingDashboard from './components/TrackingDashboard'
import CampaignSettings from './components/CampaignSettings'
import LandingPageGenerator from './components/LandingPageGenerator'

const TABS = [
  { id: 'research',   label: 'Research',    icon: Search },
  { id: 'generate',   label: 'Generate Copy', icon: Wand2 },
  { id: 'variations', label: 'Variations',  icon: LayoutGrid },
  { id: 'upload',     label: 'Push to FB',  icon: Upload },
  { id: 'dashboard',  label: 'Dashboard',   icon: BarChart3 },
  { id: 'landing',    label: 'Landing Pages', icon: Globe },
  { id: 'settings',   label: 'Settings',    icon: Settings },
]

export default function App() {
  const { activeTab, setActiveTab, variations, selectedVariations } = useAdStore()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center glow">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-none">Brayne AI</h1>
              <p className="text-xs text-gray-500 leading-none mt-0.5">Ad Generator</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`tab ${activeTab === id ? 'tab-active' : 'tab-inactive'}`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
                {id === 'variations' && variations.length > 0 && (
                  <span className="bg-white/20 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                    {variations.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://www.brayneai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              brayneai.com ↗
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">
        {activeTab === 'research'   && <ResearchPanel />}
        {activeTab === 'generate'   && <CopyGenerator />}
        {activeTab === 'variations' && <VariationManager />}
        {activeTab === 'upload'     && <FacebookUploader />}
        {activeTab === 'dashboard'  && <TrackingDashboard />}
        {activeTab === 'landing'    && <LandingPageGenerator />}
        {activeTab === 'settings'   && <CampaignSettings />}
      </main>
    </div>
  )
}
