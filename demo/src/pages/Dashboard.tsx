import { useState, useEffect, Fragment, useMemo, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MetricTooltip } from '@/components/ui/metric-tooltip'
import { formatNumber, formatDate } from '@/lib/utils'
import { getDashboardStats, getKpiMatrix, getPosts, getPages, getPost } from '@/services/api'
import type { DashboardStats, KpiMatrixResponse } from '@/types'
import { KpiMatrix } from '@/components/KpiMatrix'
import {
  FileText,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  UserPlus,
  Clock,
  TrendingUp,
  Users,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronLeft,
  Play,
  MousePointer,
  Volume2,
  Video,
  ArrowUpDown,
} from 'lucide-react'

// Debounce hook for filter changes
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Skeleton components for loading states
function StatCardSkeleton() {
  return (
    <Card className="col-span-1 animate-pulse">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
        <div className="h-6 w-16 bg-muted rounded mt-2" />
      </CardContent>
    </Card>
  )
}

function MediaCardSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <div className="h-14 bg-muted" />
      <CardContent className="pt-4 space-y-4">
        <div className="h-10 w-24 bg-muted rounded mx-auto" />
        <div className="grid grid-cols-3 gap-2 pt-3 border-t">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="h-5 w-12 bg-muted rounded mx-auto" />
              <div className="h-3 w-10 bg-muted rounded mx-auto mt-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TableRowSkeleton() {
  return (
    <tr className="border-b animate-pulse">
      {Array.from({ length: 15 }).map((_, i) => (
        <td key={i} className="py-3 pr-3">
          <div className="h-4 w-full max-w-[60px] bg-muted rounded" />
        </td>
      ))}
    </tr>
  )
}

// Metric descriptions for tooltips
const METRIC_TOOLTIPS = {
  // Main statistics
  views: 'Total impressions - how many times the post appeared on screens',
  reach: 'Sum of per-post reach; a viewer may appear on multiple posts',
  clicks: 'Total clicks on the post (links, "see more", profile, photo clicks)',
  reactions: 'Total reactions (sum of all reaction types)',
  comments: 'Number of comments on the post',
  shares: 'Number of times the post was shared',
  saves: 'Number of times people saved the post',
  follows: 'Net new followers gained from this post',
  engRate: 'Engagement rate = (reactions + comments + shares) / impressions × 100',
  distribution: 'Distribution score relative to median reach',
  // Video metrics
  totalViews: '3-second+ video views (people who watched at least 3 seconds)',
  avgWatch: 'Average time each viewer watched',
  totalWatch: 'Cumulative watch time from all viewers combined',
  duration: 'Length of the video itself',
  organicViews: '3s+ views from non-paid distribution',
  paidViews: '3s+ views from boosted/paid distribution',
  complete97Organic: 'Views that watched 97%+ of the video from the beginning (organic)',
  complete97Paid: 'Views that watched 97%+ of the video from the beginning (paid)',
} as const

interface Page {
  id: string
  name: string
}

export interface Post {
  _id: string
  fb_post_id: string
  page_name: string
  media_type: string
  message: string
  created_time: string
  permalink_url: string
  metrics: {
    impressions: number
    reach: number
    reactions: number
    comments: number
    shares: number
    saves: number
    net_follows: number
    clicks: number
    avg_watch_time: number
    distribution: string
    // Video-specific metrics
    video_views: number
    video_views_organic: number
    video_views_paid: number
    video_complete_organic: number
    video_complete_paid: number
    video_length: number
    total_watch_time: number
    reactions_breakdown: Record<string, number>
  }
  analysis_status: string
  scoring_status: string
  scoring?: {
    total_score: number
    engagement_score: number
    consumption_score: number
    quality_views_bonus: number
    type_median: number
  }
  analysis?: {
    meta_category: string
    title_english: string
    video_summary: string
    visual_description: string
    core_message: string
    tone: string
    sentiment: string
    content_category: string
    target_audience: string
    call_to_action: string
    key_elements: string[]
    hashtags: string[]
  }
  comment_analysis?: {
    overall_vibe: string
    sentiment_breakdown: string
    top_3_arguments: string[]
    dominant_emotion: string
    controversial_points: string
    suspicious_activity: string
    comments_analyzed?: number
  }
  thumbnail_url?: string
}

const TIME_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'custom', label: 'Custom' },
]

// Feature flag to hide scoring from dashboard
const SHOW_SCORING = false

type SortField = 'created_time' | 'media_type' | 'category' | 'title' | 'impressions' | 'reach' | 'reactions' | 'comments' | 'shares' | 'saves' | 'net_follows' | 'avg_watch_time' | 'distribution' | 'engagement'
type SortOrder = 'asc' | 'desc'

// Sortable header component - defined outside Dashboard to avoid recreation on each render
function SortHeader({
  field,
  children,
  sortField,
  sortOrder,
  onSort
}: {
  field: SortField
  children: React.ReactNode
  sortField: SortField
  sortOrder: SortOrder
  onSort: (field: SortField) => void
}) {
  return (
    <th
      className="pb-3 pr-3 cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortOrder === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </th>
  )
}

export function Dashboard() {
  // URL params for shareable links
  const [searchParams] = useSearchParams()

  // Filter state
  const [selectedPage, setSelectedPage] = useState('all')
  const [selectedTime, setSelectedTime] = useState('30d')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // UI state
  const [expandedPost, setExpandedPost] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [sortField, setSortField] = useState<SortField>('created_time')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [shareToast, setShareToast] = useState<string | null>(null)
  const POSTS_PER_PAGE = 25

  // Check if we're viewing a single shared post
  const sharedPostId = searchParams.get('post')

  // Auto-expand post from URL param on initial load
  useEffect(() => {
    if (sharedPostId) {
      setExpandedPost(sharedPostId)
    }
  }, [sharedPostId])

  // Toggle collapsible section in mobile view
  const toggleSection = (postId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [`${postId}-${section}`]: !prev[`${postId}-${section}`]
    }))
  }

  // Share post URL
  const sharePost = async (postId: string, postTitle: string) => {
    const url = `${window.location.origin}${window.location.pathname}?post=${postId}`

    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: postTitle || 'Post Details',
          url: url
        })
        return
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setShareToast('Link copied!')
      setTimeout(() => setShareToast(null), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setShareToast('Link copied!')
      setTimeout(() => setShareToast(null), 2000)
    }
  }

  // Debounce filter changes to prevent rapid API calls
  const debouncedPage = useDebounce(selectedPage, 300)
  const debouncedTime = useDebounce(selectedTime, 300)
  const debouncedStartDate = useDebounce(startDate, 300)
  const debouncedEndDate = useDebounce(endDate, 300)

  // Build filter params for API calls
  const filterParams = useMemo(() => ({
    page_id: debouncedPage,
    time_filter: debouncedTime === 'custom' ? undefined : debouncedTime,
    start_date: debouncedTime === 'custom' ? debouncedStartDate : undefined,
    end_date: debouncedTime === 'custom' ? debouncedEndDate : undefined,
  }), [debouncedPage, debouncedTime, debouncedStartDate, debouncedEndDate])

  // Check if custom date range is complete (must be boolean for React Query)
  const isCustomDateComplete = debouncedTime !== 'custom' || Boolean(debouncedStartDate && debouncedEndDate)

  // Fetch pages (only once on mount)
  const { data: pagesData, isError: pagesFailed } = useQuery({
    queryKey: ['pages'],
    queryFn: getPages,
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
  const pages = (pagesData as { pages?: Page[] })?.pages || []

  // Fetch dashboard stats
  const { data: stats, isError: statsFailed, isLoading: statsLoading, isFetching: statsFetching } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats', filterParams],
    queryFn: () => getDashboardStats(filterParams),
    enabled: isCustomDateComplete,
  })

  // Fetch KPI matrix (28-day rolling benchmarks by type & category)
  const { data: kpiData, isError: kpiFailed, isLoading: kpiLoading } = useQuery<KpiMatrixResponse>({
    queryKey: ['kpiMatrix', selectedPage],
    queryFn: () => getKpiMatrix({ page_id: selectedPage }),
  })

  // Fetch posts with server-side sorting
  const { data: postsData, isError: postsFailed, isLoading: postsLoading, isFetching: postsFetching } = useQuery({
    queryKey: ['posts', filterParams, currentPage, sortField, sortOrder],
    queryFn: () => getPosts({
      ...filterParams,
      limit: POSTS_PER_PAGE,
      page: currentPage,
      sort_by: sortField,
      sort_order: sortOrder,
    }),
    enabled: isCustomDateComplete,
  })

  const posts = (postsData as { posts?: Post[] })?.posts || []
  const totalPosts = (postsData as { total?: number })?.total || 0
  const totalPages = (postsData as { pages?: number })?.pages || 1

  // Combined loading states
  const isInitialLoading = statsLoading || kpiLoading || postsLoading
  const isRefreshing = statsFetching || postsFetching

  // Track previous filter/sort values to detect changes
  const prevFiltersRef = useRef({ debouncedPage, debouncedTime, debouncedStartDate, debouncedEndDate, sortField, sortOrder })

  // Reset to page 1 when filters or sort changes (but not on initial render)
  useEffect(() => {
    const prev = prevFiltersRef.current
    const hasChanged =
      prev.debouncedPage !== debouncedPage ||
      prev.debouncedTime !== debouncedTime ||
      prev.debouncedStartDate !== debouncedStartDate ||
      prev.debouncedEndDate !== debouncedEndDate ||
      prev.sortField !== sortField ||
      prev.sortOrder !== sortOrder

    if (hasChanged && currentPage !== 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: only resets when filters change
      setCurrentPage(1)
    }

    prevFiltersRef.current = { debouncedPage, debouncedTime, debouncedStartDate, debouncedEndDate, sortField, sortOrder }
  }, [debouncedPage, debouncedTime, debouncedStartDate, debouncedEndDate, sortField, sortOrder, currentPage])

  // Handle column header click for sorting (now triggers server-side sort)
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }, [sortField])



  const getMediaTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      reel: '#325e75',
      video: '#325e75',
      photo: '#4c756a',
      status: '#625875',
      link: '#325e75',
    }
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-white"
        style={{ backgroundColor: colors[type] || '#6b7280' }}
      >
        {type}
      </span>
    )
  }

  // Calculate column count dynamically (added Page column)
  const columnCount = SHOW_SCORING ? 17 : 16

  const detail = useQuery({
    queryKey: ['post', sharedPostId],
    queryFn: () => getPost(sharedPostId!),
    enabled: Boolean(sharedPostId),
  })
  if (pagesFailed || statsFailed || kpiFailed || postsFailed || detail.isError) {
    return <p role="alert">The dashboard could not load its data. Refresh to try again.</p>
  }

  // Show skeleton loading on initial load
  if (isInitialLoading || (sharedPostId && detail.isLoading)) {
    return (
      <div className="space-y-6">
        {/* Filters skeleton - responsive */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-8 w-20 bg-muted rounded animate-pulse self-center sm:order-last" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex flex-wrap items-center gap-1 justify-center sm:justify-start">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-8 w-14 sm:w-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>

        {/* Stats skeleton - responsive */}
        <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Media cards skeleton - responsive */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <MediaCardSkeleton key={i} />
          ))}
        </div>

        {/* Posts skeleton - cards on mobile, table on desktop */}
        <Card>
          <CardContent className="pt-6">
            {/* Mobile: Card skeletons */}
            <div className="md:hidden space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-12 bg-muted rounded" />
                        <div className="h-4 w-20 bg-muted rounded" />
                      </div>
                      <div className="h-4 w-4 bg-muted rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-muted rounded mb-3" />
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-12 bg-muted rounded" />
                      <div className="h-4 w-12 bg-muted rounded" />
                      <div className="h-4 w-12 bg-muted rounded" />
                      <div className="h-4 w-10 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Desktop: Table skeleton */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <tbody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Shared Post View - Show only the specific post when accessed via share link
  if (sharedPostId) {
    const sharedPost = detail.data

    if (!sharedPost && !isRefreshing) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = window.location.pathname}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Button>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Post not found</p>
            </CardContent>
          </Card>
        </div>
      )
    }

    if (sharedPost) {
      const impressions = sharedPost.metrics?.impressions || 0
      const engagement = (sharedPost.metrics?.reactions || 0) + (sharedPost.metrics?.comments || 0) + (sharedPost.metrics?.shares || 0)
      const engRate = impressions > 0 ? ((engagement / impressions) * 100).toFixed(1) : '-'
      const isVideo = sharedPost.media_type === 'reel' || sharedPost.media_type === 'video'

      return (
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Share Toast */}
          {shareToast && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
              {shareToast}
            </div>
          )}

          {/* Header */}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = window.location.pathname}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Button>
          </div>

          {/* Post Card - Always Expanded */}
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Card Header: Type + Date + Page */}
              <div className="flex items-center gap-2 flex-wrap">
                {getMediaTypeBadge(sharedPost.media_type)}
                <span className="text-sm text-muted-foreground">{formatDate(sharedPost.created_time)}</span>
                {sharedPost.page_name && (
                  <span className="text-sm text-muted-foreground">• {sharedPost.page_name}</span>
                )}
              </div>

              {/* Title/Message */}
              <h1 className="text-lg font-semibold">
                {sharedPost.analysis?.title_english || sharedPost.message || 'No title'}
              </h1>

              {/* Thumbnail */}
              {sharedPost.thumbnail_url && (
                <a href={sharedPost.permalink_url || '#'} target="_blank" rel="noopener noreferrer">
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={sharedPost.thumbnail_url}
                      alt="Post preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                          <Play className="h-8 w-8 text-primary ml-1" />
                        </div>
                      </div>
                    )}
                  </div>
                </a>
              )}

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-xs">Views</span>
                  </div>
                  <div className="text-lg font-bold">{formatNumber(sharedPost.metrics?.impressions || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Heart className="h-4 w-4" />
                    <span className="text-xs">Reactions</span>
                  </div>
                  <div className="text-lg font-bold">{formatNumber(sharedPost.metrics?.reactions || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs">Comments</span>
                  </div>
                  <div className="text-lg font-bold">{formatNumber(sharedPost.metrics?.comments || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Engagement</span>
                  </div>
                  <div className="text-lg font-bold">{engRate}%</div>
                </div>
              </div>

              {/* More Stats */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span className="text-muted-foreground">Reach:</span>
                  <span className="font-medium">{formatNumber(sharedPost.metrics?.reach || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-orange-500" />
                  <span className="text-muted-foreground">Shares:</span>
                  <span className="font-medium">{formatNumber(sharedPost.metrics?.shares || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-yellow-500" />
                  <span className="text-muted-foreground">Saves:</span>
                  <span className="font-medium">{formatNumber(sharedPost.metrics?.saves || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-indigo-500" />
                  <span className="text-muted-foreground">Follows:</span>
                  <span className="font-medium">{sharedPost.metrics?.net_follows !== undefined ? formatNumber(sharedPost.metrics.net_follows) : '-'}</span>
                </div>
              </div>

              {/* Video metrics */}
              {isVideo && (
                <div className="grid grid-cols-2 gap-2 text-sm pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">Video Views:</span>
                    <span className="font-medium">{formatNumber(sharedPost.metrics?.video_views || 0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-cyan-500" />
                    <span className="text-muted-foreground">Avg Watch:</span>
                    <span className="font-medium">{sharedPost.metrics?.avg_watch_time?.toFixed(1) || 0}s</span>
                  </div>
                </div>
              )}

              {/* Analysis - Collapsible */}
              {sharedPost.analysis && (
                <div className="pt-3 border-t">
                  <button
                    onClick={() => toggleSection(sharedPost._id, 'analysis')}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Analysis
                    </h5>
                    {expandedSections[`${sharedPost._id}-analysis`] ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {expandedSections[`${sharedPost._id}-analysis`] && (
                    <div className="space-y-2 mt-3">
                      {sharedPost.analysis.video_summary && (
                        <p className="text-sm text-muted-foreground">{sharedPost.analysis.video_summary}</p>
                      )}
                      {sharedPost.analysis.visual_description && (
                        <p className="text-sm text-muted-foreground">{sharedPost.analysis.visual_description}</p>
                      )}
                      {sharedPost.analysis.core_message && (
                        <p className="text-sm text-muted-foreground"><strong>Core:</strong> {sharedPost.analysis.core_message}</p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {sharedPost.analysis.tone && <Badge variant="outline">{sharedPost.analysis.tone}</Badge>}
                        {sharedPost.analysis.sentiment && <Badge variant="outline">{sharedPost.analysis.sentiment}</Badge>}
                        {sharedPost.analysis.meta_category && <Badge variant="outline">{sharedPost.analysis.meta_category}</Badge>}
                        {sharedPost.analysis.target_audience && <Badge variant="secondary">{sharedPost.analysis.target_audience}</Badge>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Comment Analysis - Collapsible */}
              {sharedPost.comment_analysis && (
                <div className="pt-3 border-t">
                  <button
                    onClick={() => toggleSection(sharedPost._id, 'comments')}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h5 className="text-sm font-medium flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Comments ({sharedPost.comment_analysis.comments_analyzed || 0})
                    </h5>
                    {expandedSections[`${sharedPost._id}-comments`] ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {expandedSections[`${sharedPost._id}-comments`] && (
                    <div className="space-y-2 mt-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Overall Vibe:</span>
                        <p className="text-sm">{sharedPost.comment_analysis.overall_vibe}</p>
                      </div>
                      {sharedPost.comment_analysis.sentiment_breakdown && (
                        <div>
                          <span className="text-xs text-muted-foreground">Sentiment:</span>
                          <p className="text-sm">{sharedPost.comment_analysis.sentiment_breakdown}</p>
                        </div>
                      )}
                      {sharedPost.comment_analysis.dominant_emotion && (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                          {sharedPost.comment_analysis.dominant_emotion}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions Row */}
              <div className="flex items-center gap-4 pt-4 border-t">
                {sharedPost.permalink_url && (
                  <a
                    href={sharedPost.permalink_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Facebook
                  </a>
                )}
                <button
                  onClick={() => sharePost(sharedPost._id, sharedPost.analysis?.title_english || sharedPost.message || '')}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium ml-auto"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  return (
    <div className="space-y-6 relative">
      {/* Share Toast Notification */}
      {shareToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {shareToast}
        </div>
      )}

      {/* Refreshing overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-background/50 z-10 flex items-start justify-center pt-20">
          <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-lg border">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Updating...</span>
          </div>
        </div>
      )}

      {/* Page and date filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">



        {/* Filters Container */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          {/* Page Filter */}
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {pages.map((page) => (
              <Button
                key={page.id}
                variant={selectedPage === page.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPage(page.id)}
                className="text-xs sm:text-sm"
              >
                {page.name}
              </Button>
            ))}
          </div>

          {/* Time Filter */}
          <div className="flex flex-wrap items-center gap-1 justify-center sm:justify-start sm:border-l sm:pl-6">
            {TIME_FILTERS.map((filter) => (
              <Button
                key={filter.id}
                variant={selectedTime === filter.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTime(filter.id)}
                className="text-xs sm:text-sm px-2 sm:px-3"
              >
                {filter.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Range - Full width on mobile */}
          {selectedTime === 'custom' && (
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-full sm:w-auto rounded-md border border-input bg-background px-2 text-sm"
              />
              <span className="text-muted-foreground text-xs sm:text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-full sm:w-auto rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Top Stats Row - Main totals in compact cards */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10">
        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Posts</span>
            </div>
            <div className="text-lg font-bold mt-1">{stats?.total_posts || 0}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Impr.</span>
            </div>
            <div className="text-lg font-bold mt-1">{formatNumber(stats?.impressions || 0)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Viewers</span>
            </div>
            <div className="text-lg font-bold mt-1">{formatNumber(stats?.viewers || 0)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">React.</span>
            </div>
            <div className="text-lg font-bold mt-1">{formatNumber(stats?.reactions || 0)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Comm.</span>
            </div>
            <div className="text-lg font-bold mt-1">{formatNumber(stats?.comments || 0)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Shares</span>
            </div>
            <div className="text-lg font-bold mt-1">{formatNumber(stats?.shares || 0)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Saves</span>
            </div>
            <div className="text-lg font-bold mt-1">{formatNumber(stats?.saves || 0)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-indigo-500" />
              <span className="text-xs text-muted-foreground">Follows</span>
            </div>
            <div className="text-lg font-bold mt-1">+{formatNumber(stats?.net_follows || 0)}</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-500" />
              <span className="text-xs text-muted-foreground">Watch</span>
            </div>
            <div className="text-lg font-bold mt-1">{formatNumber(stats?.watch_time_hrs || 0)}h</div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Eng%</span>
            </div>
            <div className="text-lg font-bold mt-1">
              {stats?.avg_engagement !== undefined && stats.avg_engagement < 100
                ? `${stats.avg_engagement}%`
                : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Matrix - 28-day rolling benchmarks by type & category */}
      <KpiMatrix data={kpiData} isLoading={kpiLoading} />

      {/* Posts Section */}
      <Card>
        <CardContent className="pt-6">
          {/* Mobile: Post Cards */}
          <div className="md:hidden space-y-3">
            {posts.map((post) => {
              const impressions = post.metrics?.impressions || 0
              const engagement = (post.metrics?.reactions || 0) + (post.metrics?.comments || 0) + (post.metrics?.shares || 0)
              const engRate = impressions > 0 ? ((engagement / impressions) * 100).toFixed(1) : '-'
              const isExpanded = expandedPost === post._id
              const isVideo = post.media_type === 'reel' || post.media_type === 'video'

              return (
                <Card
                  key={post._id}
                  className={`cursor-pointer transition-colors ${isExpanded ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setExpandedPost(isExpanded ? null : post._id)}
                >
                  <CardContent className="p-4">
                    {/* Card Header: Type + Date + Page + Expand Icon */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getMediaTypeBadge(post.media_type)}
                        <span className="text-xs text-muted-foreground">{formatDate(post.created_time)}</span>
                        {post.page_name && (
                          <span className="text-xs text-muted-foreground">• {post.page_name}</span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>

                    {/* Title/Message */}
                    <p className="text-sm font-medium line-clamp-2 mb-3">
                      {post.analysis?.title_english || post.message || 'No title'}
                    </p>

                    {/* Key Metrics Row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatNumber(post.metrics?.impressions || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {formatNumber(post.metrics?.reactions || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {formatNumber(post.metrics?.comments || 0)}
                      </span>
                      <span className="font-medium text-foreground">{engRate}%</span>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-4" onClick={(e) => e.stopPropagation()}>
                        {/* Thumbnail */}
                        {post.thumbnail_url && (
                          <a href={post.permalink_url || '#'} target="_blank" rel="noopener noreferrer">
                            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                              <img
                                src={post.thumbnail_url}
                                alt="Post preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              {isVideo && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                    <Play className="h-6 w-6 text-primary ml-1" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </a>
                        )}

                        {/* All metrics in 2-col grid */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-blue-500" />
                            <span className="text-muted-foreground">Views:</span>
                            <span className="font-medium">{formatNumber(post.metrics?.impressions || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span className="text-muted-foreground">Reach:</span>
                            <span className="font-medium">{formatNumber(post.metrics?.reach || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-red-500" />
                            <span className="text-muted-foreground">Reactions:</span>
                            <span className="font-medium">{formatNumber(post.metrics?.reactions || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground">Comments:</span>
                            <span className="font-medium">{formatNumber(post.metrics?.comments || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Share2 className="h-4 w-4 text-orange-500" />
                            <span className="text-muted-foreground">Shares:</span>
                            <span className="font-medium">{formatNumber(post.metrics?.shares || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Bookmark className="h-4 w-4 text-yellow-500" />
                            <span className="text-muted-foreground">Saves:</span>
                            <span className="font-medium">{formatNumber(post.metrics?.saves || 0)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-indigo-500" />
                            <span className="text-muted-foreground">Follows:</span>
                            <span className="font-medium">{post.metrics?.net_follows !== undefined ? formatNumber(post.metrics.net_follows) : '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            <span className="text-muted-foreground">Eng:</span>
                            <span className="font-medium">{engRate}%</span>
                          </div>
                        </div>

                        {/* Video metrics */}
                        {isVideo && (
                          <div className="grid grid-cols-2 gap-2 text-sm pt-3 border-t">
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4 text-blue-500" />
                              <span className="text-muted-foreground">Views:</span>
                              <span className="font-medium">{formatNumber(post.metrics?.video_views || 0)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-cyan-500" />
                              <span className="text-muted-foreground">Avg:</span>
                              <span className="font-medium">{post.metrics?.avg_watch_time?.toFixed(1) || 0}s</span>
                            </div>
                          </div>
                        )}

                        {/* Analysis - Collapsible */}
                        {post.analysis && (
                          <div className="pt-3 border-t">
                            <button
                              onClick={() => toggleSection(post._id, 'analysis')}
                              className="flex items-center justify-between w-full text-left"
                            >
                              <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                ANALYSIS
                              </h5>
                              {expandedSections[`${post._id}-analysis`] ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {expandedSections[`${post._id}-analysis`] && (
                              <div className="space-y-2 mt-2">
                                {post.analysis.video_summary && (
                                  <p className="text-sm text-muted-foreground">{post.analysis.video_summary}</p>
                                )}
                                {post.analysis.visual_description && (
                                  <p className="text-sm text-muted-foreground">{post.analysis.visual_description}</p>
                                )}
                                {post.analysis.core_message && (
                                  <p className="text-sm text-muted-foreground"><strong>Core:</strong> {post.analysis.core_message}</p>
                                )}
                                <div className="flex flex-wrap gap-1">
                                  {post.analysis.tone && <Badge variant="outline" className="text-xs">{post.analysis.tone}</Badge>}
                                  {post.analysis.sentiment && <Badge variant="outline" className="text-xs">{post.analysis.sentiment}</Badge>}
                                  {post.analysis.meta_category && <Badge variant="outline" className="text-xs">{post.analysis.meta_category}</Badge>}
                                  {post.analysis.target_audience && <Badge variant="secondary" className="text-xs">{post.analysis.target_audience}</Badge>}
                                </div>
                                {post.analysis.key_elements && post.analysis.key_elements.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {post.analysis.key_elements.map((element, i) => (
                                      <Badge key={i} variant="outline" className="text-xs bg-muted/50">{element}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Comment Analysis - Collapsible */}
                        {post.comment_analysis && (
                          <div className="pt-3 border-t">
                            <button
                              onClick={() => toggleSection(post._id, 'comments')}
                              className="flex items-center justify-between w-full text-left"
                            >
                              <h5 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                COMMENTS ({post.comment_analysis.comments_analyzed || 0})
                              </h5>
                              {expandedSections[`${post._id}-comments`] ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {expandedSections[`${post._id}-comments`] && (
                              <div className="space-y-2 mt-2">
                                <div>
                                  <span className="text-xs text-muted-foreground">Overall Vibe:</span>
                                  <p className="text-sm">{post.comment_analysis.overall_vibe}</p>
                                </div>
                                {post.comment_analysis.sentiment_breakdown && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Sentiment:</span>
                                    <p className="text-sm">{post.comment_analysis.sentiment_breakdown}</p>
                                  </div>
                                )}
                                {post.comment_analysis.dominant_emotion && (
                                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
                                    {post.comment_analysis.dominant_emotion}
                                  </Badge>
                                )}
                                {post.comment_analysis.top_3_arguments && post.comment_analysis.top_3_arguments.length > 0 && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Top Arguments:</span>
                                    <ol className="list-decimal list-inside text-sm mt-1 space-y-1">
                                      {post.comment_analysis.top_3_arguments.map((arg, i) => (
                                        <li key={i}>{arg}</li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                {post.comment_analysis.controversial_points && (
                                  <div>
                                    <span className="text-xs text-muted-foreground">Controversial:</span>
                                    <p className="text-sm">{post.comment_analysis.controversial_points}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions Row */}
                        <div className="flex items-center gap-3 pt-2">
                          {/* Link to Facebook */}
                          {post.permalink_url && (
                            <a
                              href={post.permalink_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-primary text-sm font-medium"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View on Facebook
                            </a>
                          )}
                          {/* Share Button */}
                          <button
                            onClick={() => sharePost(post._id, post.analysis?.title_english || post.message || '')}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium ml-auto"
                          >
                            <Share2 className="h-4 w-4" />
                            Share
                          </button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left font-medium text-muted-foreground">
                  <SortHeader field="created_time" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Date</SortHeader>
                  <th className="pb-3 pr-3">Page</th>
                  <SortHeader field="media_type" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Type</SortHeader>
                  <SortHeader field="category" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Category</SortHeader>
                  <SortHeader field="title" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Title</SortHeader>
                  {SHOW_SCORING && <th className="pb-3 pr-3">Score</th>}
                  <SortHeader field="impressions" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Impr.</SortHeader>
                  <SortHeader field="reach" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Viewers</SortHeader>
                  <SortHeader field="reactions" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>React.</SortHeader>
                  <SortHeader field="comments" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Comm.</SortHeader>
                  <SortHeader field="shares" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Shares</SortHeader>
                  <SortHeader field="saves" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Saves</SortHeader>
                  <SortHeader field="net_follows" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Follows</SortHeader>
                  <SortHeader field="avg_watch_time" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Sec</SortHeader>
                  <SortHeader field="distribution" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Dist.</SortHeader>
                  <SortHeader field="engagement" sortField={sortField} sortOrder={sortOrder} onSort={handleSort}>Eng%</SortHeader>
                  <th className="pb-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const impressions = post.metrics?.impressions || 0
                  const engagement = (post.metrics?.reactions || 0) + (post.metrics?.comments || 0) + (post.metrics?.shares || 0)
                  const engagementRate = impressions > 0 ? ((engagement / impressions) * 100).toFixed(1) : '-'
                  const isExpanded = expandedPost === post._id
                  const isVideo = post.media_type === 'reel' || post.media_type === 'video'

                  return (
                    <Fragment key={post._id}>
                      <tr
                        className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-muted/30' : ''}`}
                        onClick={() => setExpandedPost(isExpanded ? null : post._id)}
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            {formatDate(post.created_time)}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[80px] truncate" title={post.page_name || ''}>
                          {post.page_name || '-'}
                        </td>
                        <td className="py-2 pr-3">
                          {getMediaTypeBadge(post.media_type)}
                        </td>
                        <td className="py-2 pr-3">
                          {post.analysis?.meta_category ? (
                            <Badge variant="outline" className="text-xs">
                              {post.analysis.meta_category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 max-w-[150px] truncate" title={post.analysis?.title_english || post.message}>
                          {post.analysis?.title_english || post.message || '-'}
                        </td>
                        {SHOW_SCORING && (
                          <td className="py-2 pr-3 font-semibold">
                            {post.scoring?.total_score !== undefined
                              ? post.scoring.total_score.toFixed(1)
                              : '-'}
                          </td>
                        )}
                        <td className="py-2 pr-3">
                          {formatNumber(post.metrics?.impressions || 0)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatNumber(post.metrics?.reach || 0)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatNumber(post.metrics?.reactions || 0)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatNumber(post.metrics?.comments || 0)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatNumber(post.metrics?.shares || 0)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatNumber(post.metrics?.saves || 0)}
                        </td>
                        <td className="py-2 pr-3">
                          {post.metrics?.net_follows !== undefined ? formatNumber(post.metrics.net_follows) : '-'}
                        </td>
                        <td className="py-2 pr-3">
                          {post.metrics?.avg_watch_time !== undefined
                            ? Math.round(post.metrics.avg_watch_time)
                            : '-'}
                        </td>
                        <td className="py-2 pr-3">
                          {post.metrics?.distribution || '-'}
                        </td>
                        <td className="py-2 pr-3">
                          {engagementRate !== '-' ? `${engagementRate}%` : '-'}
                        </td>
                        <td className="py-2" onClick={(e) => e.stopPropagation()}>
                          {post.permalink_url && (
                            <a
                              href={post.permalink_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={columnCount} className="p-4">
                            <div className="space-y-6">
                            {/* Row 1: Preview, Statistics, Analysis */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                              {/* Column 1: Preview */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Preview</h4>
                                <a
                                  href={post.permalink_url || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block border rounded-lg overflow-hidden bg-card hover:ring-2 hover:ring-primary transition-all"
                                >
                                  {post.thumbnail_url ? (
                                    <div className="relative aspect-video bg-muted">
                                      <img
                                        src={post.thumbnail_url}
                                        alt="Post preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none'
                                        }}
                                      />
                                      {isVideo && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                            <Play className="h-6 w-6 text-primary ml-1" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="aspect-video bg-muted flex items-center justify-center">
                                      <FileText className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="p-3">
                                    <div className="flex items-center gap-2 text-xs text-primary mb-2">
                                      <ExternalLink className="h-4 w-4" />
                                      <span>Open on Facebook</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {post.message || 'No message'}
                                    </p>
                                  </div>
                                </a>
                                {/* Share Button */}
                                <button
                                  onClick={() => sharePost(post._id, post.analysis?.title_english || post.message || '')}
                                  className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <Share2 className="h-4 w-4" />
                                  <span>Share Post</span>
                                </button>
                              </div>

                              {/* Column 2: All Statistics */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Statistics</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.views}>
                                      <Eye className="h-4 w-4 text-blue-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Views:</span>
                                    <span className="font-medium">{formatNumber(post.metrics?.impressions || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.reach}>
                                      <Users className="h-4 w-4 text-purple-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Reach:</span>
                                    <span className="font-medium">{formatNumber(post.metrics?.reach || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.clicks}>
                                      <MousePointer className="h-4 w-4 text-cyan-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Clicks:</span>
                                    <span className="font-medium">{formatNumber(post.metrics?.clicks || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.reactions}>
                                      <Heart className="h-4 w-4 text-red-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Reactions:</span>
                                    <span className="font-medium">{formatNumber(post.metrics?.reactions || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.comments}>
                                      <MessageCircle className="h-4 w-4 text-green-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Comments:</span>
                                    <span className="font-medium">{formatNumber(post.metrics?.comments || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.shares}>
                                      <Share2 className="h-4 w-4 text-orange-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Shares:</span>
                                    <span className="font-medium">{formatNumber(post.metrics?.shares || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.saves}>
                                      <Bookmark className="h-4 w-4 text-yellow-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Saves:</span>
                                    <span className="font-medium">{formatNumber(post.metrics?.saves || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.follows}>
                                      <UserPlus className="h-4 w-4 text-indigo-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Follows:</span>
                                    <span className="font-medium">{post.metrics?.net_follows !== undefined ? formatNumber(post.metrics.net_follows) : '-'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.engRate}>
                                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Eng Rate:</span>
                                    <span className="font-medium">{engagementRate !== '-' ? `${engagementRate}%` : '-'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MetricTooltip tooltip={METRIC_TOOLTIPS.distribution}>
                                      <Volume2 className="h-4 w-4 text-teal-500" />
                                    </MetricTooltip>
                                    <span className="text-muted-foreground">Dist:</span>
                                    <span className="font-medium">{post.metrics?.distribution || '-'}</span>
                                  </div>
                                </div>

                                {/* Reactions Breakdown */}
                                {post.metrics?.reactions_breakdown && Object.keys(post.metrics.reactions_breakdown).length > 0 && (
                                  <div className="mt-3 pt-3 border-t">
                                    <h5 className="font-medium text-xs text-muted-foreground mb-2">REACTIONS BREAKDOWN</h5>
                                    <div className="flex flex-wrap gap-2 text-sm">
                                      {Object.entries(post.metrics.reactions_breakdown).map(([type, count]) => (
                                        <div key={type} className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded">
                                          <span className="capitalize">{type}:</span>
                                          <span className="font-medium">{formatNumber(count)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Video-specific stats */}
                                {isVideo && (
                                  <div className="mt-3 pt-3 border-t">
                                    <h5 className="font-medium text-xs text-muted-foreground mb-2">VIDEO METRICS</h5>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.totalViews}>
                                          <Video className="h-4 w-4 text-blue-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">Total Views:</span>
                                        <span className="font-medium">{formatNumber(post.metrics?.video_views || 0)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.avgWatch}>
                                          <Clock className="h-4 w-4 text-cyan-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">Avg Watch:</span>
                                        <span className="font-medium">{post.metrics?.avg_watch_time?.toFixed(1) || 0}s</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.totalWatch}>
                                          <Clock className="h-4 w-4 text-teal-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">Total Watch:</span>
                                        <span className="font-medium">{post.metrics?.total_watch_time ? `${Math.round(post.metrics.total_watch_time / 3600)}h` : '-'}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.duration}>
                                          <Clock className="h-4 w-4 text-orange-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">Duration:</span>
                                        <span className="font-medium">{post.metrics?.video_length?.toFixed(0) || 0}s</span>
                                      </div>
                                    </div>
                                    {/* Video Views Breakdown */}
                                    <div className="grid grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t border-dashed">
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.organicViews}>
                                          <Volume2 className="h-4 w-4 text-green-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">Organic Views:</span>
                                        <span className="font-medium">{formatNumber(post.metrics?.video_views_organic || 0)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.paidViews}>
                                          <TrendingUp className="h-4 w-4 text-blue-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">Paid Views:</span>
                                        <span className="font-medium">{formatNumber(post.metrics?.video_views_paid || 0)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.complete97Organic}>
                                          <Eye className="h-4 w-4 text-emerald-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">97% Organic:</span>
                                        <span className="font-medium">{formatNumber(post.metrics?.video_complete_organic || 0)}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MetricTooltip tooltip={METRIC_TOOLTIPS.complete97Paid}>
                                          <Eye className="h-4 w-4 text-sky-500" />
                                        </MetricTooltip>
                                        <span className="text-muted-foreground">97% Paid:</span>
                                        <span className="font-medium">{formatNumber(post.metrics?.video_complete_paid || 0)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Scoring breakdown */}
                                {SHOW_SCORING && post.scoring && (
                                  <div className="mt-3 pt-3 border-t">
                                    <h5 className="font-medium text-xs text-muted-foreground mb-2">SCORE BREAKDOWN</h5>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Total:</span>
                                        <span className="ml-2 font-bold text-primary">{post.scoring.total_score?.toFixed(1)}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">vs Median:</span>
                                        <span className="ml-2 font-medium">
                                          {post.scoring.type_median && post.scoring.type_median > 0
                                            ? `${(post.scoring.total_score / post.scoring.type_median).toFixed(1)}x`
                                            : 'N/A'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Engagement:</span>
                                        <span className="ml-2 font-medium">{post.scoring.engagement_score?.toFixed(1)}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Consumption:</span>
                                        <span className="ml-2 font-medium">{post.scoring.consumption_score?.toFixed(1)}</span>
                                      </div>
                                      {post.scoring.quality_views_bonus > 0 && (
                                        <div>
                                          <span className="text-muted-foreground">3s Views:</span>
                                          <span className="ml-2 font-medium">+{post.scoring.quality_views_bonus?.toFixed(1)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Column 3: Analysis */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Analysis</h4>
                                {post.analysis ? (
                                  <div className="space-y-3 text-sm">
                                    {post.analysis.video_summary && (
                                      <div>
                                        <h5 className="font-medium text-xs text-muted-foreground mb-1">VIDEO SUMMARY</h5>
                                        <p className="text-foreground">{post.analysis.video_summary}</p>
                                      </div>
                                    )}
                                    {post.analysis.visual_description && (
                                      <div>
                                        <h5 className="font-medium text-xs text-muted-foreground mb-1">VISUAL DESCRIPTION</h5>
                                        <p className="text-foreground">{post.analysis.visual_description}</p>
                                      </div>
                                    )}
                                    {post.analysis.core_message && (
                                      <div>
                                        <h5 className="font-medium text-xs text-muted-foreground mb-1">CORE MESSAGE</h5>
                                        <p className="text-foreground">{post.analysis.core_message}</p>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-4 pt-2">
                                      {post.analysis.tone && (
                                        <div>
                                          <span className="text-muted-foreground">Tone:</span>
                                          <Badge variant="outline" className="ml-2">{post.analysis.tone}</Badge>
                                        </div>
                                      )}
                                      {post.analysis.sentiment && (
                                        <div>
                                          <span className="text-muted-foreground">Sentiment:</span>
                                          <Badge variant="outline" className="ml-2">{post.analysis.sentiment}</Badge>
                                        </div>
                                      )}
                                      {post.analysis.content_category && (
                                        <div>
                                          <span className="text-muted-foreground">Category:</span>
                                          <Badge variant="outline" className="ml-2">{post.analysis.content_category}</Badge>
                                        </div>
                                      )}
                                    </div>
                                    {(post.analysis.target_audience || post.analysis.call_to_action) && (
                                      <div className="flex flex-wrap gap-4 pt-2">
                                        {post.analysis.target_audience && (
                                          <div>
                                            <span className="text-muted-foreground">Target:</span>
                                            <Badge variant="secondary" className="ml-2">{post.analysis.target_audience}</Badge>
                                          </div>
                                        )}
                                        {post.analysis.call_to_action && (
                                          <div>
                                            <span className="text-muted-foreground">CTA:</span>
                                            <Badge variant="secondary" className="ml-2">{post.analysis.call_to_action}</Badge>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {post.analysis.key_elements && post.analysis.key_elements.length > 0 && (
                                      <div className="pt-2">
                                        <span className="text-muted-foreground text-xs">Key Elements:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {post.analysis.key_elements.map((element, i) => (
                                            <Badge key={i} variant="outline" className="text-xs bg-muted/50">
                                              {element}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {post.analysis.hashtags && post.analysis.hashtags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 pt-2">
                                        {post.analysis.hashtags.map((tag, i) => (
                                          <Badge key={i} variant="secondary" className="text-xs">
                                            #{tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-muted-foreground text-sm">No analysis available</p>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Comment Analysis - Full Width with Cards */}
                            {post.comment_analysis && (
                              <div className="border-t pt-4">
                                <h4 className="font-semibold text-sm flex items-center gap-2 mb-4">
                                  <MessageCircle className="h-4 w-4 text-green-500" />
                                  Comment Analysis
                                  <span className="text-xs text-muted-foreground font-normal">
                                    ({post.comment_analysis.comments_analyzed || 0} comments analyzed)
                                  </span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                  {/* Card 1: Overall Vibe & Emotion */}
                                  <div className="bg-card border rounded-lg p-4 space-y-3">
                                    <div>
                                      <h5 className="font-medium text-xs text-muted-foreground mb-2">OVERALL VIBE</h5>
                                      <p className="text-sm text-foreground">{post.comment_analysis.overall_vibe}</p>
                                    </div>
                                    {post.comment_analysis.dominant_emotion && (
                                      <div>
                                        <h5 className="font-medium text-xs text-muted-foreground mb-2">DOMINANT EMOTION</h5>
                                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                          {post.comment_analysis.dominant_emotion}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>

                                  {/* Card 2: Sentiment Breakdown */}
                                  <div className="bg-card border rounded-lg p-4">
                                    <h5 className="font-medium text-xs text-muted-foreground mb-2">SENTIMENT BREAKDOWN</h5>
                                    <p className="text-sm text-foreground">{post.comment_analysis.sentiment_breakdown}</p>
                                  </div>

                                  {/* Card 3: Top Arguments */}
                                  {post.comment_analysis.top_3_arguments && post.comment_analysis.top_3_arguments.length > 0 && (
                                    <div className="bg-card border rounded-lg p-4">
                                      <h5 className="font-medium text-xs text-muted-foreground mb-2">TOP ARGUMENTS</h5>
                                      <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                                        {post.comment_analysis.top_3_arguments.map((arg, i) => (
                                          <li key={i} className="leading-snug">{arg}</li>
                                        ))}
                                      </ol>
                                    </div>
                                  )}

                                  {/* Card 4: Controversial Points & Suspicious Activity */}
                                  <div className="bg-card border rounded-lg p-4 space-y-3">
                                    {post.comment_analysis.controversial_points && (
                                      <div>
                                        <h5 className="font-medium text-xs text-muted-foreground mb-2">CONTROVERSIAL POINTS</h5>
                                        <p className="text-sm text-foreground">{post.comment_analysis.controversial_points}</p>
                                      </div>
                                    )}
                                    {post.comment_analysis.suspicious_activity && post.comment_analysis.suspicious_activity !== 'None' && (
                                      <div>
                                        <h5 className="font-medium text-xs text-red-500 mb-2">⚠️ SUSPICIOUS ACTIVITY</h5>
                                        <p className="text-sm text-foreground">{post.comment_analysis.suspicious_activity}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {posts.length === 0 && !isRefreshing && (
            <div className="py-8 text-center text-muted-foreground">
              No posts found
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {((currentPage - 1) * POSTS_PER_PAGE) + 1} - {Math.min(currentPage * POSTS_PER_PAGE, totalPosts)} of {totalPosts} posts
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isRefreshing}
                  className="px-2 sm:px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-1">
                  {/* Show page numbers - fewer on mobile */}
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 3) {
                      pageNum = i + 1
                    } else if (currentPage <= 2) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 1) {
                      pageNum = totalPages - 2 + i
                    } else {
                      pageNum = currentPage - 1 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={isRefreshing}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                  {totalPages > 3 && currentPage < totalPages - 1 && (
                    <>
                      <span className="px-1 text-muted-foreground">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={isRefreshing}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isRefreshing}
                  className="px-2 sm:px-3"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
