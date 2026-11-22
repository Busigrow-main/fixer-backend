import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../../common/swagger';
import { TechnicianGuard } from '../common/technician.guard';
import { RequireActiveTechnician } from '../common/require-active.decorator';
import { CurrentTechnician } from '../common/decorators';
import {
  CreateTechnicianPartRequestDto,
  TechnicianPartRequestOperationDto,
  TechnicianPartRequestReturnDto,
} from '../../visits/dtos/technician-part-request.dto';
import { TechnicianPartRequestsService } from '../../visits/technician-part-requests.service';

@ApiTags('Technician part requests')
@ApiBearerAuth(JWT_AUTH)
@Controller('v1/jobs/:jobId/part-requests')
@UseGuards(AuthGuard('jwt'), TechnicianGuard)
@RequireActiveTechnician()
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class TechnicianPartRequestsController {
  constructor(private readonly partRequestsService: TechnicianPartRequestsService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.partRequestsService.listForTechnician(
      technician._id.toString(), jobId, Number(page), Number(limit),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Request Fixxer inventory parts for an accepted job visit' })
  create(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Body() body: CreateTechnicianPartRequestDto,
  ) {
    return this.partRequestsService.create(technician._id.toString(), jobId, body);
  }

  @Post(':requestId/issue')
  issue(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Param('requestId') requestId: string,
    @Body() body: TechnicianPartRequestOperationDto,
  ) {
    return this.partRequestsService.issue(technician._id.toString(), jobId, requestId, body);
  }

  @Post(':requestId/consume')
  consume(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Param('requestId') requestId: string,
    @Body() body: TechnicianPartRequestOperationDto,
  ) {
    return this.partRequestsService.consume(technician._id.toString(), jobId, requestId, body);
  }

  @Post(':requestId/returns')
  @ApiOperation({ summary: 'Return unused or defective parts from a request' })
  returnPart(
    @CurrentTechnician() technician: any,
    @Param('jobId') jobId: string,
    @Param('requestId') requestId: string,
    @Body() body: TechnicianPartRequestReturnDto,
  ) {
    return this.partRequestsService.returnPart(technician._id.toString(), jobId, requestId, body);
  }
}
