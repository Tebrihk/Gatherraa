import { Controller, Get, Query } from '@nestjs/common';
import { SearchEventsDto } from './dto/search-events.dto';
import { SearchService } from './providers/search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query() dto: SearchEventsDto) {
    return this.searchService.search(dto);
  }

  @Get('autocomplete')
  async autocomplete(@Query('q') query: string) {
    return this.searchService.autocomplete(query);
  }
}
