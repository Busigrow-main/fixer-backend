import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JWT_AUTH } from '../common/swagger';

@ApiTags('Leads')
@ApiBearerAuth(JWT_AUTH)
@UseGuards(AuthGuard('jwt'))
@Controller('api/v1/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a shop or technician lead' })
  async createLead(
    @Request() req: any,
    @Body() createLeadDto: CreateLeadDto,
  ) {
    return this.leadsService.create(
      createLeadDto,
      req.user.userId,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all leads (admin)' })
  async findAll() {
    return this.leadsService.findAll();
  }
}