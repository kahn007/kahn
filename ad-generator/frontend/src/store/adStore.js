import { create } from 'zustand'

export const useAdStore = create((set, get) => ({
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

  // ── Research insights ─────────────────────────────────────────
  insights: [],
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

  setInsights: (insights) => set({ insights }),
  setIsResearching: (v) => set({ isResearching: v }),

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
}))
