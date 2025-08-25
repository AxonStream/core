import { Controller, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable, fromEventPattern, map } from 'rxjs';
import { EventStreamService } from '../services/event-stream.service';

@Controller('api/v1')
export class SseController {
  constructor(private readonly eventStreamService: EventStreamService) {}

  @Sse('stream')
  stream(@Query('orgId') organizationId?: string, @Query('channels') channelsCsv?: string): Observable<MessageEvent> {
    const channels = channelsCsv ? channelsCsv.split(',') : ['system_events'];

    return fromEventPattern<any>(
      (handler) => {
        this.eventStreamService
          .subscribeToEvents(
            { channels, organizationId, acknowledgment: false },
            (event) => handler(event),
          )
          .catch(() => {});
      },
      () => {},
    ).pipe(
      map((event) => ({ data: event } as MessageEvent)),
    );
  }
}