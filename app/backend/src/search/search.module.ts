import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchService } from './providers/search.service';
import { SearchController } from './search.controller';
import { SearchIndexService } from './providers/search-index.service';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: 'http://localhost:9200',
    }),
  ],
  providers: [SearchService, SearchIndexService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}