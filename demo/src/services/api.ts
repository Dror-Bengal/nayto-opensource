import type { Post } from '@/pages/Dashboard'
import type { DashboardStats, KpiMatrixResponse } from '@/types'
import fixtures from './posts.json'
import matrices from './benchmarks.json'

type Filters = {page_id?: string; time_filter?: string; start_date?: string; end_date?: string}
const posts = fixtures as unknown as Post[]
const snapshots = matrices as unknown as Record<string, KpiMatrixResponse>
const reference = Date.parse(snapshots.all.calculated_at)
const day = 86_400_000

function matching(filters: Filters) {
  let start = -Infinity
  let end = Infinity
  if (filters.start_date && filters.end_date) {
    start = Date.parse(filters.start_date)
    end = Date.parse(filters.end_date) + day
  } else if (filters.time_filter === 'today') {
    start = Math.floor(reference / day) * day
  } else if (['7d', '30d', '90d'].includes(filters.time_filter ?? '')) {
    start = reference - parseInt(filters.time_filter!, 10) * day
  }
  return posts.filter(post => {
    const date = Date.parse(post.created_time)
    return (!filters.page_id || filters.page_id === 'all' || post.page_name === filters.page_id)
      && date >= start && date < end
  })
}

export async function getPages() {
  return {pages: Object.keys(snapshots).map(id => ({id, name: id === 'all' ? 'All Pages' : id}))}
}

export async function getKpiMatrix(filters: Filters) {
  return snapshots[filters.page_id || 'all']
}

export async function getDashboardStats(filters: Filters): Promise<DashboardStats> {
  const rows = matching(filters)
  const sum = (field: keyof Post['metrics']) => rows.reduce((n, p) => n + Number(p.metrics[field] || 0), 0)
  const impressions = sum('impressions')
  const reactions = sum('reactions')
  const comments = sum('comments')
  const shares = sum('shares')
  return {
    total_posts: rows.length, impressions, viewers: sum('reach'), reactions, comments, shares,
    saves: sum('saves'), net_follows: sum('net_follows'),
    watch_time_hrs: Number((sum('total_watch_time') / 3600).toFixed(1)),
    avg_engagement: Number((100 * (reactions + comments + shares) / (impressions || 1)).toFixed(2)),
  }
}

function sortValue(post: Post, key: string): number | string {
  if (key === 'title') return post.analysis?.title_english || ''
  if (key === 'category') return post.analysis?.meta_category || ''
  if (key === 'media_type') return post.media_type
  if (key === 'engagement') {
    const {impressions, reactions, comments, shares} = post.metrics
    return impressions ? (reactions + comments + shares) / impressions : 0
  }
  const value = post.metrics[key as keyof Post['metrics']]
  if (typeof value === 'number' || typeof value === 'string') return value
  return Date.parse(post.created_time)
}

export async function getPosts(params: Filters & {page: number; limit: number; sort_by: string; sort_order: string}) {
  const rows = matching(params)
  const direction = params.sort_order === 'desc' ? -1 : 1
  rows.sort((a, b) => {
    const left = sortValue(a, params.sort_by)
    const right = sortValue(b, params.sort_by)
    if (left === right) return direction * a._id.localeCompare(b._id)
    return direction * (left < right ? -1 : 1)
  })
  const start = (params.page - 1) * params.limit
  return {posts: rows.slice(start, start + params.limit), total: rows.length, pages: Math.ceil(rows.length / params.limit)}
}

export async function getPost(id: string) {
  return posts.find(post => post._id === id) ?? null
}
