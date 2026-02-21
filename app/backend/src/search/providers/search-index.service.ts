import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchIndexService implements OnModuleInit {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit() {
    const exists = await this.elasticsearchService.indices.exists({
      index: 'events',
    });

    if (!exists) {
      await this.createEventsIndex();
    }
  }

  async createEventsIndex() {
    await this.elasticsearchService.indices.create({
      index: 'events',
      settings: {
        analysis: {
          analyzer: {
            autocomplete_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'edge_ngram_filter'],
            },
          },
          filter: {
            edge_ngram_filter: {
              type: 'edge_ngram',
              min_gram: 1,
              max_gram: 20,
            },
          },
        },
      },
      mappings: {
        properties: {
          title: {
            type: 'text',
            fields: {
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
              },
            },
          },
          description: { type: 'text' },
          category: { type: 'keyword' },
          tags: { type: 'keyword' },
          location: { type: 'geo_point' },
          startDate: { type: 'date' },
          organizerId: { type: 'keyword' },
          createdAt: { type: 'date' },
        },
      },
    });
  }
}
