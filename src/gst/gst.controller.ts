import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GstBreakdownDto, GstExtractDto } from './gst.dto';
import { GstService } from './gst.service';

@ApiTags('GST')
@Controller('api/v1/gst')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GstController {
  constructor(private readonly gstService: GstService) {}

  @Get('rates')
  @ApiOperation({
    summary: 'Standard GST slabs + inclusive pricing defaults',
  })
  rates() {
    return this.gstService.listStandardRates();
  }

  @Post('extract')
  @ApiOperation({
    summary:
      'Reverse-calculate taxable value from a GST-inclusive amount (CGST Rule 35)',
  })
  extract(@Body() body: GstExtractDto) {
    return this.gstService.extractFromInclusive(body);
  }

  @Post('breakdown')
  @ApiOperation({
    summary:
      'Full invoice GST breakdown for line items (inclusive by default — grand total unchanged)',
  })
  breakdown(@Body() body: GstBreakdownDto) {
    return this.gstService.breakdown(body);
  }
}
