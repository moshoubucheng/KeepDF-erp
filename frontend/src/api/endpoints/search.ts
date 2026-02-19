import { api } from '../client'
import type { SearchResponse, SearchEntityType } from '../types'

interface SearchParams {
  q: string
  type?: SearchEntityType | SearchEntityType[]
  limit?: number
}

export const searchApi = {
  search: (params: SearchParams) => {
    const query = new URLSearchParams()
    query.set('q', params.q)
    if (params.type) {
      const types = Array.isArray(params.type) ? params.type.join(',') : params.type
      query.set('type', types)
    }
    if (params.limit) query.set('limit', String(params.limit))
    return api.get<SearchResponse>(`/search?${query.toString()}`)
  },
}
