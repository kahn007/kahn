import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAdStore = create(
  persist(
    (set, get) => ({
      // ── Campaign config ──────────────────────────────────────────
      campaign: {
        name: 'Brayne AI — Summer 2025',
        objective: 'CONVERSIONS',
        adAccountId: '',
        adSetId: '',
        pageId: '',
      },

      // ── Brand context ─────────────────────────────────────────────
      brandContext: {
        brandName: 'Brayne AI',
        website: 'www.brayneai.com',
        product: '',
        targetAudience: '',
        cta: 'Learn More',
        landingPageUrl: 'https://www.brayneai.com',
      },

      // ── Research library ──────────────────────────────────────────
      // Each session: { id, name, product, targetAudience, insights, createdAt }
      researchSessions: [],
      activeResearchId: null,   // which session feeds into Generate Copy
      isResearching: false,

      // ── Ad variations ─────────────────────────────────────────────
      variations: [],
      selectedVariations: [],
      isGenerating: false,

      // ── Upload state ──────────────────────────────────────────────
      uploadQueue: [],
      uploadResults: [],
      isUploading: false,

      // ── Analytics ─────────────────────────────────────────────────
      analytics: [],
      isLoadingAnalytics: false,

      // ── Active tab ────────────────────────────────────────────────
      activeTab: 'research',

      // ── Actions ───────────────────────────────────────────────────
      setCampaign: (updates) =>
        set((s) => ({ campaign: { ...s.campaign, ...updates } })),

      setBrandContext: (updates) =>
        set((s) => ({ brandContext: { ...s.brandContext, ...updates } })),

      // Research library actions
      saveResearchSession: (session) =>
        set((s) => {
          const exists = s.researchSessions.find((r) => r.id === session.id)
          const sessions = exists
            ? s.researchSessions.map((r) => (r.id === session.id ? session : r))
            : [session, ...s.researchSessions]
          return { researchSessions: sessions, activeResearchId: session.id }
        }),

      deleteResearchSession: (id) =>
        set((s) => {
          const sessions = s.researchSessions.filter((r) => r.id !== id)
          const activeId = s.activeResearchId === id
            ? (sessions[0]?.id || null)
            : s.activeResearchId
          return { researchSessions: sessions, activeResearchId: activeId }
        }),

      setActiveResearchId: (id) => set({ activeResearchId: id }),

      setIsResearching: (v) => set({ isResearching: v }),

      // Convenience: get the active session's insights
      getActiveInsights: () => {
        const s = get()
        const session = s.researchSessions.find((r) => r.id === s.activeResearchId)
        return session?.insights || null
      },

      addVariations: (vars) =>
        set((s) => ({ variations: [...s.variations, ...vars] })),

      setVariations: (variations) => set({ variations }),

      toggleSelectVariation: (id) =>
        set((s) => ({
          selectedVariations: s.selectedVariations.includes(id)
            ? s.selectedVariations.filter((x) => x !== id)
            : [...s.selectedVariations, id],
        })),

      selectAll: () =>
        set((s) => ({ selectedVariations: s.variations.map((v) => v.id) })),

      clearSelection: () => set({ selectedVariations: [] }),

      removeVariation: (id) =>
        set((s) => ({
          variations: s.variations.filter((v) => v.id !== id),
          selectedVariations: s.selectedVariations.filter((x) => x !== id),
        })),

      updateVariation: (id, updates) =>
        set((s) => ({
          variations: s.variations.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),

      setIsGenerating: (v) => set({ isGenerating: v }),

      setUploadResults: (results) => set({ uploadResults: results }),
      setIsUploading: (v) => set({ isUploading: v }),

      setAnalytics: (analytics) => set({ analytics }),
      setIsLoadingAnalytics: (v) => set({ isLoadingAnalytics: v }),

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'brayne-ai-store',
      partialize: (s) => ({
        campaign:          s.campaign,
        brandContext:      s.brandContext,
        researchSessions:  s.researchSessions,
        activeResearchId:  s.activeResearchId,
        variations:        s.variations,
        uploadResults:     s.uploadResults,
        activeTab:         s.activeTab,
      }),
    }
  )
)
