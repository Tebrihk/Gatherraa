import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchEventsDto } from '../dto/search-events.dto';

@Injectable()
export class SearchService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async indexEvent(event: any) {
    return this.elasticsearchService.index({
      index: 'events',
      id: event.id,
      document: {
        title: event.title,
        description: event.description,
        category: event.category,
        tags: event.tags,
        location: {
          lat: event.latitude,
          lon: event.longitude,
        },
        startDate: event.startDate,
        organizerId: event.organizerId,
        createdAt: new Date(),
      },
    });
  }

  async search(dto: SearchEventsDto, userId?: string) {
    const must: any[] = [];
    const filter: any[] = [];

    if (dto.query) {
      must.push({
        multi_match: {
          query: dto.query,
          fields: ['title^3', 'description', 'tags'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (dto.category) {
      filter.push({ term: { category: dto.category } });
    }

    if (dto.tags?.length) {
      filter.push({ terms: { tags: dto.tags } });
    }

    if (dto.lat && dto.lon && dto.radius) {
      filter.push({
        geo_distance: {
          distance: dto.radius,
          location: {
            lat: dto.lat,
            lon: dto.lon,
          },
        },
      });
    }

    return this.elasticsearchService.search({
      index: 'events',
      from: (dto.page - 1) * dto.size,
      size: dto.size,
      query: {
        bool: {
          must,
          filter,
        },
      },
      aggs: {
        categories: {
          terms: { field: 'category' },
        },
        tags: {
          terms: { field: 'tags' },
        },
      },
    });
  }

  async autocomplete(query: string) {
    return this.elasticsearchService.search({
      index: 'events',
      size: 5,
      query: {
        match: {
          'title.autocomplete': query,
        },
      },
    });
  }
}