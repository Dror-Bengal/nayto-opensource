export interface DashboardStats {
  total_posts: number
  impressions: number
  viewers: number
  reactions: number
  comments: number
  shares: number
  saves: number
  net_follows: number
  watch_time_hrs: number
  avg_engagement: number
}

export type KpiCategory = 'Positive' | 'Negative' | 'Activation' | 'Agenda Setting'
export type KpiMediaType = 'reel' | 'photo' | 'status'

export interface KpiCell {
  count: number
  has_data: boolean
  avg_impressions: number | null
  avg_reach: number | null
  avg_clicks: number | null
  avg_comments: number | null
  avg_engagement_rate: number | null
  avg_distribution: number | null  // Only for reels
}

export interface KpiMatrixResponse {
  kpi_matrix: Record<KpiMediaType, Record<KpiCategory, KpiCell>>
  period_days: number
  calculated_at: string
  categories: KpiCategory[]
}
