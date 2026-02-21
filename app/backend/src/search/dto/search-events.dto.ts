export class SearchEventsDto {
    
  query?: string;
  category?: string;
  tags?: string[];
  lat?: number;
  lon?: number;
  radius?: string;
  page: number = 1;
  size: number = 10;
}