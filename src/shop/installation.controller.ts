import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InstallationOptionsQueryDto } from './dtos/checkout.dto';
import { InstallationService } from './installation.service';

@ApiTags('Installation')
@Controller('api/v1/installation')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class InstallationController {
  constructor(private readonly installationService: InstallationService) {}

  @Get('options')
  @ApiOperation({ summary: 'Installation options and charges for a product and pincode' })
  getOptions(@Query() query: InstallationOptionsQueryDto) {
    return this.installationService.getOptions(
      query.productId,
      query.pincode,
      query.productType,
    );
  }
}
