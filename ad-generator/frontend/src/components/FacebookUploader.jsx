import React, { useState } from 'react'
import { Upload, CheckCircle, XCircle, RefreshCw, Facebook, ChevronRight, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAdStore } from '../store/adStore'
import { pushAdsDraft, getFacebookAdSets } from '../lib/api'

// Detect FB token expiry and return a helpful message
function fbErrorMessage(msg) {
  if (/session has expired|access token/i.test(msg)) {
    return 'Facebook token expired — go to Settings and paste a new token from developers.facebook.com/tools/explorer'
  }
  return msg
}

function appendUtm(url, utmConfig) {
  if (!url) return url
  try {
    const u = new URL(url)
    if (utmConfig.source)   u.searchParams.set('utm_source', utmConfig.source)
    if (utmConfig.medium)   u.searchParams.set('utm_medium', utmConfig.medium)
    if (utmConfig.campaign) u.searchParams.set('utm_campaign', utmConfig.campaign)
    if (utmConfig.content)  u.searchParams.set('utm_content', utmConfig.content)
    return u.toString()
  } catch {
    return url
  }
}

export default function FacebookUploader() {
  const {
    campaign, setCampaign,
    variations, selectedVariations,
    brandContext,
    uploadResults, setUploadResults,
    isUploading, setIsUploading,
    setActiveTab,
    utmConfig,
  } = useAdStore()

  const [adSets, setAdSets]         = useState([])
  const [loadingAdSets, setLoadingAdSets] = useState(false)
  const [progress, setProgress]     = useState({ done: 0, total: 0 })

  const toUpload = selectedVariations.length > 0
    ? variations.filter((v) => selectedVariations.includes(v.id))
    : variations

  const loadAdSets = async () => {
    if (!campaign.adAccountId) {
      toast.error('Enter your Ad Account ID first')
      return
    }
    setLoadingAdSets(true)
    try {
      const data = await getFacebookAdSets(campaign.adAccountId)
      setAdSets(data.adSets || [])
      if (data.adSets?.length) toast.success(`Found ${data.adSets.length} ad sets`)
    } catch (err) {
      toast.error(fbErrorMessage(err.message), { duration: 6000 })
    } finally {
      setLoadingAdSets(false)
    }
  }

  const handleUpload = async () => {
    if (!toUpload.length) {
      toast.error('No variations to upload. Generate some first.')
      return
    }

    setIsUploading(true)
    setProgress({ done: 0, total: toUpload.length })
    setUploadResults([])

    try {
      // Upload in batches of 10
      const batchSize = 10
      const allResults = []

      for (let i = 0; i < toUpload.length; i += batchSize) {
        const batch = toUpload.slice(i, i + batchSize)
        const utmLandingUrl = appendUtm(brandContext.landingPageUrl, utmConfig)
        const data = await pushAdsDraft({
          adAccountId: campaign.adAccountId || undefined,
          adSetId:     campaign.adSetId     || undefined,
          pageId:      campaign.pageId      || undefined,
          variations:  batch.map((v) => ({ ...v, landingPageUrl: utmLandingUrl })),
        })
        allResults.push(...(data.results || []))
        setProgress({ done: Math.min(i + batchSize, toUpload.length), total: toUpload.length })
      }

      setUploadResults(allResults)
      const successes = allResults.filter((r) => r.success).length
      toast.success(`${successes} ads pushed to Facebook as drafts!`)
    } catch (err) {
      toast.error(fbErrorMessage(err.message), { duration: 6000 })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Push to Facebook</h2>
        <p className="text-gray-400 mt-1">
          Upload your ad variations as paused drafts to your Facebook Ad Account.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="space-y-4">
          {/* API keys notice */}
          {(!campaign.adAccountId) && (
            <div className="card border-yellow-800/50 bg-yellow-900/10">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-yellow-300 font-semibold">Demo Mode</p>
                  <p className="text-yellow-400/70 mt-0.5">
                    Without a Facebook Access Token in your backend <code>.env</code>, uploads will return mock Ad IDs.
                    Add your credentials to <code>ad-generator/backend/.env</code> to go live.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="card space-y-4">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Facebook size={16} className="text-blue-500" />
              Facebook Campaign Config
            </h3>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Ad Account ID</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="act_123456789"
                  value={campaign.adAccountId}
                  onChange={(e) => setCampaign({ adAccountId: e.target.value })}
                />
                <button
                  className="btn-secondary flex-shrink-0"
                  onClick={loadAdSets}
                  disabled={loadingAdSets}
                >
                  {loadingAdSets ? <RefreshCw size={14} className="animate-spin" /> : 'Load'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Ad Set</label>
              {adSets.length > 0 ? (
                <select
                  className="input"
                  value={campaign.adSetId}
                  onChange={(e) => setCampaign({ adSetId: e.target.value })}
                >
                  <option value="">Select an ad set…</option>
                  {adSets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  placeholder="Enter Ad Set ID manually"
                  value={campaign.adSetId}
                  onChange={(e) => setCampaign({ adSetId: e.target.value })}
                />
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Facebook Page ID</label>
              <input
                className="input"
                placeholder="123456789"
                value={campaign.pageId}
                onChange={(e) => setCampaign({ pageId: e.target.value })}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3">Upload Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Variations to upload</span>
                <span className="text-white font-semibold">{toUpload.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Selected</span>
                <span className="text-white">{selectedVariations.length || 'All'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className="text-yellow-400">Will upload as PAUSED</span>
              </div>
              {brandContext.landingPageUrl && (utmConfig.source || utmConfig.medium || utmConfig.campaign) && (
                <div className="pt-2 border-t border-gray-800">
                  <p className="text-gray-500 text-xs mb-1">Landing URL (with UTM)</p>
                  <p className="text-gray-400 text-xs font-mono break-all leading-relaxed">
                    {appendUtm(brandContext.landingPageUrl, utmConfig)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload button */}
          {isUploading ? (
            <div className="card space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Uploading…</span>
                <span className="text-white">{progress.done} / {progress.total}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                  className="bg-brand-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">Respecting Facebook rate limits (100ms/request)</p>
            </div>
          ) : (
            <button
              className="btn-primary w-full justify-center"
              onClick={handleUpload}
              disabled={toUpload.length === 0}
            >
              <Upload size={16} />
              Push {toUpload.length} Ads to Facebook
            </button>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3">Upload Results</h3>

            {uploadResults.length === 0 ? (
              <div className="text-center py-12">
                <Facebook size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Results will appear here after upload</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {uploadResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${
                    r.success ? 'bg-green-900/20 border border-green-900/40' : 'bg-red-900/20 border border-red-900/40'
                  }`}>
                    {r.success
                      ? <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                      : <XCircle size={16} className="text-red-400 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0 text-xs">
                      <p className={r.success ? 'text-green-300' : 'text-red-300'}>
                        {r.success ? `Ad created: ${r.facebookAdId}` : r.error}
                      </p>
                      <p className="text-gray-500 truncate">Variation: {r.variationId}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploadResults.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between text-sm">
                <span className="text-gray-400">
                  {uploadResults.filter((r) => r.success).length} success ·{' '}
                  {uploadResults.filter((r) => !r.success).length} failed
                </span>
                <button
                  className="text-brand-400 hover:text-brand-300 transition-colors font-medium"
                  onClick={() => setActiveTab('dashboard')}
                >
                  View Dashboard →
                </button>
              </div>
            )}
          </div>

          {/* Next steps guide */}
          <div className="card">
            <h3 className="font-semibold text-white text-sm mb-3">After Uploading</h3>
            <ol className="space-y-2 text-xs text-gray-400">
              {[
                'All ads are uploaded as PAUSED — review them in Ads Manager',
                'Assign a budget to your ad set if you haven\'t already',
                'Select your winning creatives and set them to ACTIVE',
                'Monitor performance in the Dashboard tab below',
                'Kill low performers (CTR < 1%) after 2-3 days',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-500 flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
