import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchAnalyticsService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async logSearch(userId: string, query: string) {
    await this.elasticsearchService.index({
      index: 'search_analytics',
      document: {
        userId,
        query,
        createdAt: new Date(),
      },
    });
  }
}