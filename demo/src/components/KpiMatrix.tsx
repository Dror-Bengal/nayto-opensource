import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'
import type { KpiMatrixResponse, KpiCategory, KpiMediaType, KpiCell } from '@/types'
import { Video, Image, Type, Eye, Users, MessageCircle, MousePointer } from 'lucide-react'

interface KpiMatrixProps {
  data?: KpiMatrixResponse
  isLoading?: boolean
}

// Media type configuration
const MEDIA_TYPES: { key: KpiMediaType; label: string; color: string; icon: typeof Video }[] = [
  { key: 'reel', label: 'Reels', color: '#325e75', icon: Video },
  { key: 'photo', label: 'Photos', color: '#4c756a', icon: Image },
  { key: 'status', label: 'Status', color: '#625875', icon: Type },
]

// Category configuration with colors
const CATEGORIES: { key: KpiCategory; label: string; shortLabel: string; color: string; bgColor: string }[] = [
  { key: 'Positive', label: 'Positive', shortLabel: 'Positive', color: '#16a34a', bgColor: 'bg-green-50' },
  { key: 'Negative', label: 'Negative', shortLabel: 'Negative', color: '#dc2626', bgColor: 'bg-red-50' },
  { key: 'Activation', label: 'Activation', shortLabel: 'Activation', color: '#2563eb', bgColor: 'bg-blue-50' },
  { key: 'Agenda Setting', label: 'Agenda Setting', shortLabel: 'Agenda', color: '#9333ea', bgColor: 'bg-purple-50' },
]

// Skeleton for loading state
function KpiMatrixSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded mt-1" />
            </div>
            <div className="h-6 w-28 bg-muted rounded" />
          </div>

          {/* Mobile skeleton */}
          <div className="md:hidden">
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 flex-1 bg-muted rounded" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-xl" />
              ))}
            </div>
          </div>

          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[100px_repeat(4,1fr)] gap-3">
              <div />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-muted rounded-lg" />
              ))}
            </div>
            {[1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-[100px_repeat(4,1fr)] gap-3 mt-3">
                <div className="h-24 bg-muted rounded-lg" />
                {[1, 2, 3, 4].map((cell) => (
                  <div key={cell} className="h-24 bg-muted rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Category tabs for mobile view
function CategoryTabs({
  active,
  onChange,
}: {
  active: KpiCategory
  onChange: (category: KpiCategory) => void
}) {
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onChange(cat.key)}
          className={`flex-1 min-w-[80px] px-2 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
            active === cat.key
              ? 'border-current'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          style={{ color: active === cat.key ? cat.color : undefined }}
        >
          {cat.shortLabel}
        </button>
      ))}
    </div>
  )
}

// Mobile KPI Card component
function MobileKpiCard({
  mediaType,
  cell,
  category,
}: {
  mediaType: typeof MEDIA_TYPES[0]
  cell: KpiCell | undefined
  category: KpiCategory
}) {
  const Icon = mediaType.icon
  const categoryConfig = CATEGORIES.find(c => c.key === category)

  const defaultCell: KpiCell = {
    count: 0,
    has_data: false,
    avg_impressions: null,
    avg_reach: null,
    avg_clicks: null,
    avg_comments: null,
    avg_engagement_rate: null,
    avg_distribution: null,
  }

  const data = cell ?? defaultCell

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      style={{ borderLeftWidth: '4px', borderLeftColor: categoryConfig?.color }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: mediaType.color }}
      >
        <div className="flex items-center gap-2 text-white">
          <Icon className="h-4 w-4" />
          <span className="font-medium text-sm">{mediaType.label}</span>
        </div>
        {data.has_data && (
          <Badge variant="secondary" className="bg-white/20 text-white text-xs px-2">
            {data.count}
          </Badge>
        )}
      </div>

      {/* Body */}
      {data.has_data ? (
        <div className="p-4">
          {/* Main metric */}
          <div className="text-center mb-3">
            <div className="text-3xl font-bold text-gray-900">
              {data.avg_engagement_rate?.toFixed(2) ?? '0.00'}%
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Engagement Rate</div>
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Eye className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs">{formatNumber(data.avg_impressions ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs">{formatNumber(data.avg_reach ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <MousePointer className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs">{formatNumber(data.avg_clicks ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600">
              <MessageCircle className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs">{data.avg_comments?.toFixed(1) ?? '0'}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-gray-400 text-sm">
          No data available
        </div>
      )}
    </div>
  )
}

// Desktop KPI Cell Card component
function DesktopKpiCell({
  cell,
  category,
  mediaColor,
}: {
  cell: KpiCell | undefined
  category: KpiCategory
  mediaColor: string
}) {
  const categoryConfig = CATEGORIES.find(c => c.key === category)

  const defaultCell: KpiCell = {
    count: 0,
    has_data: false,
    avg_impressions: null,
    avg_reach: null,
    avg_clicks: null,
    avg_comments: null,
    avg_engagement_rate: null,
    avg_distribution: null,
  }

  const data = cell ?? defaultCell

  if (!data.has_data) {
    return (
      <div
        className={`rounded-xl p-3 ${categoryConfig?.bgColor} opacity-60 flex items-center justify-center min-h-[100px] border border-gray-100`}
      >
        <span className="text-xs text-gray-400">No data</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow min-h-[100px]`}
      style={{ borderTopWidth: '3px', borderTopColor: categoryConfig?.color }}
    >
      {/* Count badge */}
      <div className="flex justify-end pt-2 pr-2">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600">
          {data.count}
        </Badge>
      </div>

      {/* Main metric */}
      <div className="text-center px-2 pb-1">
        <div className="text-xl font-bold" style={{ color: mediaColor }}>
          {data.avg_engagement_rate?.toFixed(2) ?? '0.00'}%
        </div>
        <div className="text-[10px] text-gray-500">Eng. Rate</div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-1 px-2 pb-2 pt-1.5 border-t border-gray-100 mt-1">
        <div className="flex items-center gap-0.5 text-gray-500" title="Views">
          <Eye className="h-2.5 w-2.5" />
          <span className="text-[10px]">{formatNumber(data.avg_impressions ?? 0)}</span>
        </div>
        <div className="flex items-center gap-0.5 text-gray-500" title="Reach">
          <Users className="h-2.5 w-2.5" />
          <span className="text-[10px]">{formatNumber(data.avg_reach ?? 0)}</span>
        </div>
        <div className="flex items-center gap-0.5 text-gray-500" title="Clicks">
          <MousePointer className="h-2.5 w-2.5" />
          <span className="text-[10px]">{formatNumber(data.avg_clicks ?? 0)}</span>
        </div>
        <div className="flex items-center gap-0.5 text-gray-500" title="Comments">
          <MessageCircle className="h-2.5 w-2.5" />
          <span className="text-[10px]">{data.avg_comments?.toFixed(1) ?? '0'}</span>
        </div>
      </div>
    </div>
  )
}

// Media type row header for desktop
function MediaTypeLabel({ mediaType }: { mediaType: typeof MEDIA_TYPES[0] }) {
  const Icon = mediaType.icon
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm font-medium h-full"
      style={{ backgroundColor: mediaType.color }}
    >
      <Icon className="h-4 w-4" />
      <span>{mediaType.label}</span>
    </div>
  )
}

// Category header for desktop
function CategoryHeader({ category }: { category: typeof CATEGORIES[0] }) {
  return (
    <div
      className={`text-center py-2 px-3 rounded-lg text-xs font-semibold ${category.bgColor}`}
      style={{ color: category.color }}
    >
      {category.label}
    </div>
  )
}

export function KpiMatrix({ data, isLoading }: KpiMatrixProps) {
  const [activeCategory, setActiveCategory] = useState<KpiCategory>('Positive')

  if (isLoading) {
    return <KpiMatrixSkeleton />
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">KPI Benchmarks</h3>
            <p className="text-xs text-gray-500">28-day rolling averages by type & category</p>
          </div>
          {data && (
            <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
              Updated {new Date(data.calculated_at).toLocaleDateString()}
            </Badge>
          )}
        </div>

        {/* Mobile View */}
        <div className="md:hidden">
          <CategoryTabs active={activeCategory} onChange={setActiveCategory} />
          <div className="space-y-3 mt-4">
            {MEDIA_TYPES.map((mediaType) => (
              <MobileKpiCard
                key={mediaType.key}
                mediaType={mediaType}
                category={activeCategory}
                cell={data?.kpi_matrix?.[mediaType.key]?.[activeCategory]}
              />
            ))}
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block">
          {/* Category column headers */}
          <div className="grid grid-cols-[100px_repeat(4,1fr)] gap-3 mb-3">
            <div /> {/* Empty corner */}
            {CATEGORIES.map((cat) => (
              <CategoryHeader key={cat.key} category={cat} />
            ))}
          </div>

          {/* Rows */}
          {MEDIA_TYPES.map((mediaType) => (
            <div key={mediaType.key} className="grid grid-cols-[100px_repeat(4,1fr)] gap-3 mb-3">
              <MediaTypeLabel mediaType={mediaType} />
              {CATEGORIES.map((cat) => (
                <DesktopKpiCell
                  key={`${mediaType.key}-${cat.key}`}
                  cell={data?.kpi_matrix?.[mediaType.key]?.[cat.key]}
                  category={cat.key}
                  mediaColor={mediaType.color}
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
